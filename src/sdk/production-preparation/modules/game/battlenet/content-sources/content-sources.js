/** Shared desktop catalogue: authenticated publications and explicitly saved public revisions. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { readBounded } from "./local-files.js";
import { compilePublicationPackage, localeDocument } from "../publishing/package-compiler.js";
import { battleNetPublicationName } from "./vfs-provider.js";
import { categoryMaskOf, composePublicationHeader, DEFAULT_VARIANT } from "../publishing/header-composer.js";
import { readDeclaredDependencies } from "./document-dependencies.js";
import { openMpqReader } from '@modkit/blizzard-mpq/reader';
import { protectMpqHeader } from '@modkit/blizzard-mpq/header-protection';
import { array, blob, decodeCacheHeader, field, number } from "./cache-header.js";
import { DEFAULT_VFS_LIMITS } from '@modkit/vfs';
import { BattleNetAccountsProvider } from "../accounts/account-provider.js";
import { BattleNetVfsProvider, checkedPublication, normalizeBattleNetRegion } from "./vfs-provider.js";
/** `package.json#modkit.credentials`: the web ticket of the official sign-in page, kept per region. */
export const BATTLENET_CREDENTIAL = 'blizzard/battlenet';
const regions = [{ id: 'us', label: 'NA / Americas', credentialId: BATTLENET_CREDENTIAL },
    { id: 'eu', label: 'EU / Europe', credentialId: BATTLENET_CREDENTIAL },
    { id: 'kr', label: 'KR / Korea', credentialId: BATTLENET_CREDENTIAL }];
const key = (account, region) => createHash('sha256').update(JSON.stringify([account, region])).digest('hex');
const savedKey = (item) => `${item.region}:${item.publication.id}:${item.publication.version}`;
const cachedKey = (sourceId, publication) => `${sourceId}:${publication.id}@${publication.version}`;
/** Structurally implements @modkit/vfs/content-sources without depending on a desktop framework. */
export class BattleNetContentSources {
    options;
    accounts;
    saved = new Map();
    results = new Map();
    mounts = new Map();
    publicProviders = new Set();
    lifetime = new AbortController();
    writeQueue = Promise.resolve();
    ready;
    statePath;
    publishReviews = new Map();
    deleteReviews = new Map();
    /** Whether a publication's archive is already on disk; a listing must not ask the depot per row. */
    cachedFlags = new Map();
    constructor(options) {
        this.options = options;
        this.accounts = new BattleNetAccountsProvider(options);
        this.statePath = join(options.stateDirectory, 'public-mods-v1.json');
        this.ready = this.load();
    }
    async load() {
        let raw;
        try {
            raw = await readFile(this.statePath, 'utf8');
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return;
            throw error;
        }
        if (raw.length > 1024 * 1024)
            throw new Error('Saved public catalogue exceeds its limit');
        const state = JSON.parse(raw);
        if (state.schema !== 1 || !Array.isArray(state.items) || state.items.length > 1000)
            throw new Error('Invalid saved public catalogue');
        for (const rawItem of state.items) {
            const item = { region: normalizeBattleNetRegion(rawItem.region), publication: checkedPublication(rawItem.publication) };
            if (item.publication.private !== false)
                throw new Error('Saved public catalogue contains a non-public publication');
            this.saved.set(savedKey(item), item);
        }
    }
    ensure() { this.lifetime.signal.throwIfAborted(); }
    async snapshot() {
        await this.ready;
        this.ensure();
        const connections = this.accounts.listConnections().map(connection => ({
            id: key(connection.accountId, connection.region), accountId: connection.accountId,
            label: `${connection.accountName} / ${connection.profileName}`, region: connection.region,
        }));
        return { label: 'Battle.net', publishing: this.options.publishing === true, deletion: this.options.deletion === true, regions: regions.filter(region => this.accounts.supportedRegions.includes(region.id)),
            connections, roots: [
                ...connections.map(connection => ({ id: `mine:${connection.id}`, label: `${connection.label} · ${connection.region.toUpperCase()}`,
                    region: connection.region, kind: 'mine' })),
                ...regions.map(region => ({ id: `public:${region.id}`, label: `Public mods · ${region.label}`,
                    region: region.id, kind: 'public' })),
            ] };
    }
    /**
     * Connect an account. The broker's kept ticket for this region is used instead of a login page;
     * a refused one is forgotten and the page opens. A fresh ticket goes only to the broker; without
     * a broker every sign-in opens the page and nothing is kept.
     */
    async connect(region, accountId) {
        await this.ready;
        this.ensure();
        const regionId = normalizeBattleNetRegion(region), credentials = this.options.credentials;
        const kept = await credentials?.secret(BATTLENET_CREDENTIAL, regionId, this.lifetime.signal)
            .then(bytes => bytes === undefined ? undefined : new TextDecoder().decode(bytes));
        const login = (ticket) => this.accounts.login({ region: regionId,
            ...(accountId === undefined ? {} : { accountId }),
            ...(ticket === undefined ? {} : { ticket }), signal: this.lifetime.signal });
        let connection;
        try {
            connection = await login(kept);
        }
        catch (error) {
            if (kept === undefined || credentials === undefined || this.lifetime.signal.aborted)
                throw error;
            await credentials.forget(BATTLENET_CREDENTIAL, regionId, this.lifetime.signal);
            connection = await login(undefined);
        }
        if (connection.webTicket !== undefined && credentials !== undefined)
            await credentials.remember(BATTLENET_CREDENTIAL, connection.webTicket, regionId, this.lifetime.signal);
    }
    connection(id) {
        this.ensure();
        const connection = this.accounts.listConnections().find(item => key(item.accountId, item.region) === id);
        if (!connection)
            throw new Error('This Battle.net connection has ended. Sign in again.');
        return connection;
    }
    async disconnect(id) {
        const connection = this.connection(id);
        await this.accounts.logout(connection.accountId, connection.region);
        await this.options.credentials?.forget(BATTLENET_CREDENTIAL, connection.region, this.lifetime.signal);
        await this.refresh(`mine:${id}`);
        this.results.clear();
        for (const [token, review] of this.publishReviews)
            if (review.connectionId === id)
                this.publishReviews.delete(token);
        for (const [token, review] of this.deleteReviews)
            if (review.connectionId === id)
                this.deleteReviews.delete(token);
    }
    /** Choices are freshly read from the selected account, never from public bookmarks/search results. */
    async deletionCandidates(connectionId) {
        if (!this.options.deletion)
            throw new Error('Publication deletion is not configured');
        const connection = this.connection(connectionId);
        const mount = await this.accounts.open(this.accounts.uri(connection), { limits: DEFAULT_VFS_LIMITS, signal: this.lifetime.signal });
        try {
            for (const [id, item] of this.deleteReviews)
                if (item.expires < Date.now() || item.connectionId === connectionId)
                    this.deleteReviews.delete(id);
            const rows = [];
            for await (const node of mount.list('', this.lifetime.signal)) {
                const publication = node.publication;
                if (!publication)
                    continue;
                if (this.deleteReviews.size >= 1000)
                    throw new Error('Too many pending deletion choices');
                const id = randomUUID();
                this.deleteReviews.set(id, { connectionId, expires: Date.now() + 15 * 60_000, publication: checkedPublication(publication) });
                rows.push({ id, label: publication.name, description: `#${publication.id} · ${publication.version >>> 16}.${publication.version & 65535} · ${connection.region.toUpperCase()}` });
            }
            this.connection(connectionId);
            return rows;
        }
        finally {
            await mount.dispose();
        }
    }
    async deletePublication(reviewId) {
        const review = this.deleteReviews.get(reviewId);
        this.deleteReviews.delete(reviewId);
        if (!review || review.expires < Date.now())
            throw new Error('Deletion selection expired; reload your publications');
        const connection = this.connection(review.connectionId);
        const receipt = await this.accounts.deletePublication({ ...connection, publication: review.publication,
            operationId: reviewId, signal: this.lifetime.signal });
        await this.refresh(`mine:${review.connectionId}`).catch(() => undefined);
        return receipt;
    }
    /** Re-resolve an own root row before any cache or server mutation. */
    async ownPublication(sourceId, path) {
        if (!sourceId.startsWith('mine:') || !path || path.includes('/'))
            throw new Error('Select a published mod or map');
        const connectionId = sourceId.slice(5);
        const connection = this.connection(connectionId);
        const node = await (await this.mount(sourceId)).stat(path, this.lifetime.signal);
        if (!node?.publication)
            throw new Error('Published mod or map was not found');
        return { connectionId, connection, publication: checkedPublication(node.publication) };
    }
    /**
     * A downloaded publication is a real file in this profile's cache, so a host can reveal it or
     * open it with the game's own tools. One that is not downloaded has no local target.
     */
    async resolveLocalPath(sourceId, path) {
        if (!sourceId.startsWith('mine:') || !path || path.includes('/'))
            return undefined;
        const item = await this.ownPublication(sourceId, path).catch(() => undefined);
        if (!item)
            return undefined;
        const local = await this.accounts.cachedArchivePath({ ...item.connection, publication: item.publication,
            signal: this.lifetime.signal }).catch(() => undefined);
        return local === undefined ? undefined : { path: local, kind: 'file' };
    }
    async download(sourceId, path) {
        const item = await this.ownPublication(sourceId, path);
        await this.accounts.download({ ...item.connection, publication: item.publication, signal: this.lifetime.signal });
        this.cachedFlags.set(cachedKey(sourceId, item.publication), true);
    }
    async clearCache(sourceId, path) {
        const item = await this.ownPublication(sourceId, path);
        await this.accounts.clearCache({ ...item.connection, publication: item.publication, signal: this.lifetime.signal });
        this.cachedFlags.set(cachedKey(sourceId, item.publication), false);
    }
    /** Produce a one-use review token for exactly the row selected in the own-publications tree. */
    async prepareDeletePublication(sourceId, path) {
        if (!this.options.deletion)
            throw new Error('Publication deletion is not configured');
        const item = await this.ownPublication(sourceId, path);
        for (const [id, review] of this.deleteReviews)
            if (review.expires < Date.now())
                this.deleteReviews.delete(id);
        if (this.deleteReviews.size >= 1000)
            throw new Error('Too many pending deletion choices');
        const id = randomUUID();
        this.deleteReviews.set(id, { connectionId: item.connectionId, expires: Date.now() + 15 * 60_000, publication: item.publication });
        return { id, label: item.publication.name,
            description: `#${item.publication.id} · ${item.publication.version >>> 16}.${item.publication.version & 65535} · ${item.connection.region.toUpperCase()}` };
    }
    /**
     * Compile the next revision of one of this account's publications and hand back a review.
     *
     * A revision is not a new publication: everything the catalogue reports about how the mod is
     * listed — its names per locale, its preview images, its attributes — is carried over from the
     * header the publication already has, and only the archive and the two flags the author chose
     * are new. What no query reports back (the arcade category mask, the undependable flag) cannot
     * be preserved, and a publication listed with labels or cluster membership is refused rather
     * than silently stripped.
     */
    async prepareRevision(sourceId, path, options = {}) {
        if (!this.options.publishing)
            throw new Error('Publishing is not configured');
        const depot = this.options.publicApi;
        if (depot.readComponent === undefined)
            throw new Error('This installation cannot read publication headers');
        const item = await this.ownPublication(sourceId, path);
        const { publication } = item;
        const region = item.connection.region;
        const signal = this.lifetime.signal;
        const header = await depot.readComponent({ region, handle: publication.headerHandle, signal });
        const tree = decodeCacheHeader(header);
        const root = field(tree, 0);
        const info = field(root, 4);
        const nameReference = field(info, 0);
        const descriptionReference = info.value.get(1n);
        const texts = [];
        for (const table of array(field(root, 8))) {
            const locale = new TextDecoder().decode(blob(field(table, 0)));
            const first = array(field(table, 1))[0];
            if (first === undefined)
                continue;
            const bytes = await depot.readComponent({ region, handle: Buffer.from(blob(first)).toString('hex'), signal });
            const text = new TextDecoder().decode(bytes);
            const read = (id) => new RegExp(`<e id="${id}"[^>]*>([^]*?)</e>`, 'u').exec(text)?.[1];
            const name = read(number(field(nameReference, 2)));
            const description = descriptionReference === undefined ? undefined : read(number(field(descriptionReference, 2)));
            if (name !== undefined)
                texts.push({ locale, name, ...(description === undefined ? {} : { description }) });
        }
        if (texts.length === 0)
            throw new Error('The publication header carries no locale table with a name');
        // Preview images belong to the publication, not to this revision: carried over byte for byte.
        const visuals = [];
        for (const entry of array(info.value.get(7n) ?? { kind: 0, value: [] })) {
            const handle = Buffer.from(blob(entry)).toString('hex');
            const bytes = await depot.readComponent({ region, handle, signal });
            const digest = createHash('sha256').update(bytes).digest('hex');
            if (digest !== handle.slice(16))
                throw new Error('A preview component does not match its handle');
            visuals.push({ sha256: digest, bytes });
        }
        const attributes = publication.attributes;
        if (!attributes)
            throw new Error('The catalogue reported no publish attributes for this publication');
        const archivePath = options.archivePath ?? await this.accounts.cachedArchivePath({
            ...item.connection, publication, signal
        });
        if (archivePath === undefined || !isAbsolute(archivePath)) {
            throw new Error('Select the archive to publish, or download this publication first');
        }
        const original = await readBounded(dirname(archivePath), basename(archivePath), 256 * 1024 * 1024);
        const output = join(this.options.stateDirectory, 'publish', `${publication.id}-${randomUUID()}`);
        /*
         * Protection is applied to the copy that is published, never to the author's own file, and
         * before the package is compiled: the manifest binds the digest of exactly the bytes sent.
         */
        let archiveBytes = original;
        let publishedPath = archivePath;
        /*
         * The publisher takes a document, not a cache entry: a downloaded copy is stored under its
         * digest and has to be named like the document it is before it can be sent back.
         */
        const named = /\.(sc2map|sc2mod)$/iu.test(basename(archivePath))
            ? basename(archivePath)
            : battleNetPublicationName(publication);
        if (options.protectHeader === true)
            archiveBytes = protectMpqHeader(original);
        if (options.protectHeader === true || !named.endsWith(basename(archivePath))) {
            publishedPath = join(output, named);
            await mkdir(output, { recursive: true });
            await writeFile(publishedPath, archiveBytes);
        }
        const compiled = await compilePublicationPackage({
            archive: { path: publishedPath, bytes: archiveBytes },
            baseHeader: header,
            namespace: number(field(root, 3)),
            region,
            kind: publication.isMod ? 'mod' : 'map',
            locale: texts[0].locale,
            texts,
            isExtensionMod: attributes.extensionMod,
            isMelee: attributes.melee,
            isHiddenLobby: attributes.hiddenLobby,
            isSkipInitialDownload: attributes.skipInitialDownload,
            cluster: attributes.cluster,
            clusterParent: attributes.clusterParent,
            labels: attributes.labels,
            visuals,
            target: { mode: 'update', id: publication.id, expectedVersion: publication.version },
            categoryMask: options.categoryMask ?? categoryMaskOf(array(field(root, 13)).map(entry => ({
                categoryId: number(field(field(entry, 0), 0)),
                modeId: number(field(field(entry, 0), 1)),
                maxTeamSize: number(field(entry, 8)),
            }))),
            visibility: options.visibility ?? (publication.private === false ? 'public' : 'private'),
            locked: options.locked ?? publication.locked === true,
            ...(options.majorRevision === undefined ? {} : { majorRevision: options.majorRevision }),
        }, output);
        return this.preparePublish(item.connectionId, publishedPath, compiled.packagePath);
    }
    /**
     * The publication a document means when it names a dependency.
     *
     * A document names its dependencies — `bnet:Liberty (Mod)/0.0/999` — while a header carries their
     * publication ids, and only the catalogue knows which is which. An exact name match is required:
     * publishing against a mod that merely resembles the named one would produce a document that
     * loads the wrong data.
     */
    async resolveDependency(connectionId, name) {
        const connection = this.connection(connectionId);
        const mount = await this.accounts.open(this.accounts.uri({ ...connection, scope: 'search', name }), { limits: DEFAULT_VFS_LIMITS, signal: this.lifetime.signal });
        try {
            for await (const node of mount.list('', this.lifetime.signal)) {
                const publication = node.publication;
                if (publication?.name === name)
                    return checkedPublication(publication).id;
            }
        }
        finally {
            await Promise.resolve(mount.dispose()).catch(() => undefined);
        }
        throw new Error(`Battle.net does not publish a document named “${name}” in ${connection.region.toUpperCase()}, which this document depends on`);
    }
    /**
     * What the archive says about itself: the documents it depends on, and whether it is a map.
     *
     * A map's publication header carries the lobby variants and attribute definitions the editor
     * compiles from the document, and Modkit composes neither yet. Publishing one anyway would put a
     * map on Battle.net that offers no way to start it, so the document is read before anything is
     * sent and a map is refused while that is true.
     */
    async inspectDocument(archive) {
        const reader = await openMpqReader(archive, { maxArchiveBytes: 256 * 1024 * 1024,
            maxEntries: 20000, maxEntryBytes: 64 * 1024 * 1024 });
        try {
            const named = (suffix) => reader.entries.find(item => item.path.toLowerCase().endsWith(suffix));
            const header = named('documentheader');
            if (header === undefined)
                throw new Error('This archive carries no DocumentHeader; it is not a saved StarCraft II document');
            return {
                dependencies: readDeclaredDependencies(await reader.read(header.id)),
                isMap: named('mapinfo') !== undefined,
            };
        }
        finally {
            reader.dispose();
        }
    }
    /**
     * Compile a document that has never been published, and hand back a review.
     *
     * Everything a first publication needs that only the server knows is asked for first: PrePublish
     * answers with the attribute namespace the header must carry, and says whether the name is
     * already taken — which is what makes this a creation rather than a revision. The header itself
     * is composed here; until now it could only come from the StarCraft II Editor.
     *
     * The dependency chain is declared by the caller. Resolving it from the document's own
     * DocumentHeader is not done yet, so a document whose dependencies are not stated is published
     * with the standard core only.
     */
    async prepareFirstPublication(connectionId, options) {
        if (!this.options.publishing)
            throw new Error('Publishing is not configured');
        const connection = this.connection(connectionId);
        if (!isAbsolute(options.archivePath))
            throw new Error('Select the archive to publish');
        const name = options.name.trim();
        if (!name || name.length > 80)
            throw new Error('A publication name is 1 to 80 characters');
        const locale = options.locale ?? 'enUS';
        const signal = this.lifetime.signal;
        const kind = basename(options.archivePath).toLowerCase().endsWith('.sc2map') ? 'map' : 'mod';
        const original = await readBounded(dirname(options.archivePath), basename(options.archivePath), 256 * 1024 * 1024);
        // What cannot be published is decided from the document itself, before the server is asked.
        const document = await this.inspectDocument(original);
        if (document.isMap || kind === 'map') {
            throw new Error('Modkit cannot publish a map for the first time yet: its header carries the lobby variants and attribute definitions the StarCraft II Editor compiles from the document. Publish the map once from the editor; Modkit can then compile its revisions.');
        }
        const prepared = await this.accounts.prepublish({ ...connection, names: [name], signal });
        if (prepared.prior !== null) {
            throw new Error(`Battle.net already publishes “${name}”; publish a revision of it instead`);
        }
        const output = join(this.options.stateDirectory, 'publish', `new-${randomUUID()}`);
        await mkdir(output, { recursive: true });
        let archiveBytes = original;
        let publishedPath = options.archivePath;
        if (options.protectHeader === true) {
            archiveBytes = protectMpqHeader(original);
            publishedPath = join(output, basename(options.archivePath));
            await writeFile(publishedPath, archiveBytes);
        }
        const texts = [{ locale, name, ...(options.description === undefined ? {} : { description: options.description }) }];
        /*
         * The header names the locale documents by digest, so they are produced first and the compiler
         * then writes the very same ones — the package that is sent describes itself consistently.
         */
        const locales = texts.map(item => {
            const strings = new Map([[1, item.name]]);
            if (item.description !== undefined)
                strings.set(2, item.description);
            return { locale: item.locale, sha256: createHash('sha256').update(localeDocument(item.locale, strings)).digest('hex') };
        });
        /*
         * A header carries dependency ids; a document names them. Resolving the document's own list is
         * what keeps the publication loading the data it was built against — an explicit list is
         * honoured, but nothing is assumed when neither is available.
         */
        const dependencies = options.dependencies ?? await Promise.all(document.dependencies.map(async (item) => ({
            id: await this.resolveDependency(connectionId, item.name), version: 0,
        })));
        const previews = (options.previews ?? []).map(item => ({
            sha256: createHash('sha256').update(item.bytes).digest('hex'), bytes: item.bytes,
        }));
        const baseHeader = composePublicationHeader({
            identity: { id: 0, version: 0 },
            fileName: basename(options.archivePath),
            region: connection.region,
            archiveSha256: createHash('sha256').update(archiveBytes).digest('hex'),
            namespace: prepared.namespace,
            locales,
            dependencies,
            previews: previews.map(item => ({ sha256: item.sha256 })),
        });
        const compiled = await compilePublicationPackage({
            archive: { path: publishedPath, bytes: archiveBytes },
            baseHeader,
            namespace: prepared.namespace,
            region: connection.region,
            kind,
            locale,
            texts,
            target: { mode: 'create' },
            categoryMask: options.categoryMask ?? categoryMaskOf([DEFAULT_VARIANT]),
            visibility: options.visibility ?? 'private',
            locked: options.locked ?? false,
            visuals: previews,
        }, output);
        return this.preparePublish(connectionId, publishedPath, compiled.packagePath);
    }
    /** What this account has left to publish into: free slots and bytes. */
    async storage(connectionId) {
        const connection = this.connection(connectionId);
        return this.accounts.storage({ ...connection, signal: this.lifetime.signal });
    }
    async preparePublish(connectionId, filePath, packagePath) {
        if (!this.options.publishing)
            throw new Error('Publishing is not configured');
        const connection = this.connection(connectionId);
        if (!isAbsolute(filePath) || !isAbsolute(packagePath))
            throw new Error('Select absolute archive and prepared manifest paths');
        const raw = await readBounded(dirname(packagePath), basename(packagePath), 1024 * 1024);
        const manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
        if (manifest.schema !== 1 || manifest.region !== connection.region || !manifest.name ||
            !['map', 'mod'].includes(manifest.kind) || !/^[a-f0-9]{64}$/u.test(manifest.archiveSha256) ||
            !manifest.target || !['create', 'update'].includes(manifest.target.mode) ||
            !['private', 'public'].includes(manifest.visibility) || typeof manifest.locked !== 'boolean')
            throw new Error('Invalid prepared publication manifest or region');
        if (typeof manifest.name !== 'string' || manifest.name.length > 80 || /[\u0000-\u001f]/u.test(manifest.name) ||
            typeof manifest.locale !== 'string' || !/^[a-z]{2}[A-Z]{2}$/u.test(manifest.locale) ||
            (manifest.target.mode === 'update' && [manifest.target.id, manifest.target.expectedVersion].some(value => !Number.isInteger(value) || value <= 0 || value > 0xffffffff))) {
            throw new Error('Invalid publication name, locale or expected version');
        }
        const bytes = await readBounded(dirname(filePath), basename(filePath), 256 * 1024 * 1024, manifest.archiveSha256);
        this.connection(connectionId);
        const id = randomUUID();
        for (const [token, item] of this.publishReviews)
            if (item.expires < Date.now())
                this.publishReviews.delete(token);
        if (this.publishReviews.size >= 64)
            throw new Error('Too many pending publication reviews');
        this.publishReviews.set(id, { connectionId, expires: Date.now() + 15 * 60_000, options: {
                accountId: connection.accountId, region: connection.region, filePath, packagePath,
                packageSha256: createHash('sha256').update(raw).digest('hex'), name: manifest.name, locale: manifest.locale,
                target: manifest.target, visibility: manifest.visibility, locked: manifest.locked, operationId: id,
            } });
        return { id, name: manifest.name, account: `${connection.accountName} / ${connection.profileName}`, region: connection.region,
            bytes: bytes.length, sha256: manifest.archiveSha256, target: manifest.target, visibility: manifest.visibility, locked: manifest.locked };
    }
    async publish(reviewId) {
        const review = this.publishReviews.get(reviewId);
        this.publishReviews.delete(reviewId);
        if (!review || review.expires < Date.now())
            throw new Error('Publication review expired; prepare it again');
        this.connection(review.connectionId);
        const receipt = await this.accounts.publish({ ...review.options, signal: this.lifetime.signal });
        await this.refresh(`mine:${review.connectionId}`).catch(() => undefined);
        return receipt;
    }
    async search(connectionId, name) {
        await this.ready;
        const connection = this.connection(connectionId);
        const mount = await this.accounts.open(this.accounts.uri({ ...connection, scope: 'search', name }), { limits: DEFAULT_VFS_LIMITS, signal: this.lifetime.signal });
        try {
            this.results.clear();
            const output = [];
            for await (const node of mount.list('', this.lifetime.signal)) {
                const publication = node.publication;
                // The public source never adopts private results, even if a server returns one to its owner.
                if (!publication || publication.private !== false)
                    continue;
                const id = randomUUID();
                this.results.set(id, { region: connection.region, publication });
                output.push({ id, label: publication.name,
                    description: `${publication.isMod ? 'Mod' : 'Map'} · ${connection.region.toUpperCase()} · ${publication.id} · ${publication.version >>> 16}.${publication.version & 65535}` });
            }
            return output;
        }
        finally {
            await mount.dispose();
        }
    }
    async add(resultId) {
        await this.ready;
        this.ensure();
        const item = this.results.get(resultId);
        if (!item)
            throw new Error('Search result expired. Repeat the search before adding it.');
        await this.mutateSaved(() => {
            if (this.saved.size >= 1000 && !this.saved.has(savedKey(item)))
                throw new Error('Public catalogue limit reached');
            this.saved.set(savedKey(item), item);
        });
        await this.refresh(`public:${item.region}`);
    }
    async remove(sourceId, path) {
        await this.ready;
        this.ensure();
        if (!sourceId.startsWith('public:') || !path || path.includes('/'))
            throw new Error('Select a saved public map/mod to remove');
        const mount = await this.mount(sourceId);
        const publication = (await mount.stat(path));
        if (!publication?.publication)
            throw new Error('Saved publication was not found');
        const region = normalizeBattleNetRegion(sourceId.slice(7));
        await this.mutateSaved(() => { this.saved.delete(savedKey({ region, publication: publication.publication })); });
        await this.refresh(sourceId);
    }
    mutateSaved(change) {
        const task = this.writeQueue.then(async () => {
            this.ensure();
            const previous = new Map(this.saved);
            const temp = `${this.statePath}.${randomUUID()}.part`;
            try {
                change();
                await mkdir(this.options.stateDirectory, { recursive: true });
                await writeFile(temp, JSON.stringify({ schema: 1, items: [...this.saved.values()] }), { flag: 'wx' });
                await rename(temp, this.statePath);
            }
            catch (error) {
                this.saved.clear();
                for (const [id, item] of previous)
                    this.saved.set(id, item);
                throw error;
            }
            finally {
                await unlink(temp).catch(() => undefined);
            }
        });
        this.writeQueue = task.catch(() => undefined);
        return task;
    }
    async refresh(sourceId) {
        for (const key of [...this.cachedFlags.keys()]) {
            if (key.startsWith(`${sourceId}:`))
                this.cachedFlags.delete(key);
        }
        const task = this.mounts.get(sourceId);
        this.mounts.delete(sourceId);
        if (task)
            await task.then(mount => mount.dispose(), () => undefined);
    }
    async mount(sourceId) {
        await this.ready;
        this.ensure();
        // Recheck live identity on each read, even when a mount is cached.
        if (sourceId.startsWith('mine:'))
            this.connection(sourceId.slice(5));
        let task = this.mounts.get(sourceId);
        if (!task) {
            task = this.createMount(sourceId);
            this.mounts.set(sourceId, task);
            const current = task;
            void task.catch(() => { if (this.mounts.get(sourceId) === current)
                this.mounts.delete(sourceId); });
        }
        return task;
    }
    async createMount(sourceId) {
        let provider;
        let mount;
        if (sourceId.startsWith('mine:')) {
            const connection = this.connection(sourceId.slice(5));
            mount = await this.accounts.open(this.accounts.uri(connection), { limits: DEFAULT_VFS_LIMITS, signal: this.lifetime.signal });
        }
        else if (/^public:(us|eu|kr)$/u.test(sourceId)) {
            const region = normalizeBattleNetRegion(sourceId.slice(7));
            const items = [...this.saved.values()].filter(item => item.region === region).map(item => item.publication);
            provider = new BattleNetVfsProvider({ api: { ...this.options.publicApi, listPublished: async () => ({ items }) },
                region, profileKey: 'public-revisions', cacheDirectory: this.options.cacheDirectory });
            this.publicProviders.add(provider);
            try {
                mount = await provider.open(`battlenet://${region}/mine`, { limits: DEFAULT_VFS_LIMITS, signal: this.lifetime.signal });
            }
            catch (error) {
                this.publicProviders.delete(provider);
                await provider.dispose();
                throw error;
            }
        }
        else
            throw new Error('Unknown content source');
        const owned = provider;
        return { id: mount.id, rootUri: mount.rootUri, revision: mount.revision,
            stat: (path, signal) => mount.stat(path, signal), list: (path, signal) => mount.list(path, signal),
            open: (path, signal) => mount.open(path, signal), dispose: async () => {
                await mount.dispose();
                if (owned) {
                    this.publicProviders.delete(owned);
                    await owned.dispose();
                }
            } };
    }
    async list(sourceId, path) {
        const mount = await this.mount(sourceId);
        const entries = [];
        for await (const node of mount.list(path, this.lifetime.signal)) {
            const publication = node.publication;
            const ownRootPublication = sourceId.startsWith('mine:') && path === '' && publication !== undefined;
            // Asking the depot per row turns one listing into one request per publication. A publication
            // is immutable, so whether its archive is on disk is remembered until it is downloaded,
            // cleared, or the source is refreshed.
            let cached = false;
            if (ownRootPublication) {
                const key = cachedKey(sourceId, publication);
                const known = this.cachedFlags.get(key);
                cached = known ?? await this.accounts.isCached({ ...this.connection(sourceId.slice(5)),
                    publication: checkedPublication(publication), signal: this.lifetime.signal }).catch(() => false);
                if (known === undefined)
                    this.cachedFlags.set(key, cached);
            }
            entries.push({ path: node.path, name: node.name, directory: node.kind === 'directory',
                ...(node.size === undefined ? {} : { size: Number(node.size) }),
                ...(ownRootPublication ? { actions: [cached ? { id: 'clear-cache' } : { id: 'download' },
                        ...(this.options.deletion ? [{ id: 'delete-publication' }] : [])],
                    publication: checkedPublication(publication) } : {}) });
        }
        await this.noteMaterialized(sourceId, path);
        return entries;
    }
    /**
     * Reading anything inside a publication materializes its archive, whoever asked for it: browsing
     * a mod downloads it just as the download action does. Without this the row keeps claiming it is
     * not downloaded until something clears the answer.
     */
    async noteMaterialized(sourceId, path) {
        if (!sourceId.startsWith('mine:') || !path)
            return;
        const root = path.split('/')[0];
        if (!root)
            return;
        const node = await (await this.mount(sourceId)).stat(root, this.lifetime.signal)
            .catch(() => undefined);
        if (node?.publication)
            this.cachedFlags.set(cachedKey(sourceId, node.publication), true);
    }
    async read(sourceId, path, maxBytes) {
        if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > 64 * 1024 * 1024)
            throw new Error('Read limit exceeded');
        const source = await (await this.mount(sourceId)).open(path, this.lifetime.signal);
        try {
            const size = await source.size(this.lifetime.signal);
            if (size > maxBytes)
                throw new Error('File exceeds the preview size limit');
            const bytes = new Uint8Array(size);
            for (let offset = 0; offset < size; offset += 1024 * 1024) {
                bytes.set(await source.readAt(offset, Math.min(1024 * 1024, size - offset), this.lifetime.signal), offset);
            }
            await this.noteMaterialized(sourceId, path);
            return bytes;
        }
        finally {
            await source.dispose();
        }
    }
    async dispose() {
        this.lifetime.abort(new Error('Content sources closed'));
        this.publishReviews.clear();
        this.deleteReviews.clear();
        await this.accounts.dispose();
        await Promise.allSettled([...this.mounts.keys()].map(id => this.refresh(id)));
        await Promise.allSettled([...this.publicProviders].map(provider => provider.dispose()));
        await this.writeQueue;
    }
}
//# sourceMappingURL=content-sources.js.map
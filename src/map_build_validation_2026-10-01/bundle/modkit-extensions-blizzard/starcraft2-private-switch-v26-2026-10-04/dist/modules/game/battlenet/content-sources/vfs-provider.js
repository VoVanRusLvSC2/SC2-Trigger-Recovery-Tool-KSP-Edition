/** Node/Electron main-process entry. Credentials stay in the session-bound API adapter. */
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { openMpqReader } from '@modkit/blizzard-mpq/reader';
import { BattleNetVfsError } from '../shared/errors.js';
import { deleteBattleNetPublication } from '../publishing/deletion.js';
export { BattleNetDeleteOutcomeUnknownError } from '../publishing/deletion.js';
import { publishBattleNetArchive } from '../publishing/publisher.js';
export { BattleNetVfsError } from '../shared/errors.js';
export { BattleNetPublishOutcomeUnknownError, BattleNetPublishRejectedError } from '../publishing/publisher.js';
import { clampVfsLimits, normalizeVfsPath, } from '@modkit/vfs';
/** NA/Americas is represented as US in depot handles and native API requests. */
export function normalizeBattleNetRegion(region) {
    const normalized = region.toLowerCase();
    if (normalized === 'na')
        return 'us';
    if (normalized === 'us' || normalized === 'eu' || normalized === 'kr')
        return normalized;
    throw new BattleNetVfsError('blizzard.battlenet/invalid-region', 'Supported regions: na/us, eu, kr');
}
function fail(code, message) {
    throw new BattleNetVfsError(`blizzard.battlenet/${code}`, message);
}
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const combine = (...signals) => AbortSignal.any(signals.filter((signal) => signal !== undefined));
const positive = (value, label) => {
    if (!Number.isSafeInteger(value) || value <= 0)
        fail('invalid-option', `${label} must be a positive safe integer`);
    return value;
};
function locationOf(uri) {
    // URL normalizes dot segments, so reject them before parsing as well as in VFS paths.
    const decoded = decodeURIComponent(uri);
    if (/(?:^|[/\\])\.{1,2}(?:[/\\?#]|$)/u.test(decoded))
        fail('invalid-uri', 'Dot segments are not allowed');
    const url = new URL(uri);
    if (url.protocol !== 'battlenet:' || url.username || url.password || url.port || url.hash) {
        fail('invalid-uri', 'Expected battlenet://<region>/mine or /search?name=...');
    }
    const region = normalizeBattleNetRegion(url.hostname);
    if ([...url.searchParams.keys()].some(key => key !== 'name' && key !== 'account') ||
        url.searchParams.getAll('name').length > 1 || url.searchParams.getAll('account').length > 1) {
        fail('invalid-uri', 'Only one name and one account query parameter are supported');
    }
    const accountId = url.searchParams.get('account');
    if (accountId === '')
        fail('invalid-uri', 'The account selector must not be empty');
    const [scope = 'mine', ...parts] = (normalizeVfsPath(decodeURIComponent(url.pathname)) || 'mine').split('/');
    if (scope !== 'mine' && scope !== 'search')
        fail('invalid-uri', 'Expected /mine or /search');
    const name = (url.searchParams.get('name') ?? '').trim();
    if (name.length > 256 || (scope === 'search' && !name))
        fail('invalid-search', 'Search needs a name of 1–256 characters');
    return { region, scope, name, root: parts.join('/'), ...(accountId === null ? {} : { accountId }) };
}
export function checkedPublication(value) {
    if (!value || !Number.isInteger(value.id) || value.id <= 0 || value.id > 0xffffffff ||
        !Number.isInteger(value.version) || value.version <= 0 || value.version > 0xffffffff ||
        typeof value.name !== 'string' || value.name.length > 1024 || typeof value.isMod !== 'boolean' ||
        typeof value.headerHandle !== 'string' || !/^73326d68[0-9a-f]{72}$/iu.test(value.headerHandle)) {
        fail('invalid-publication', 'The API must supply a concrete id/version and .s2mh CacheHandle40');
    }
    const attributes = value.attributes;
    if (attributes !== undefined) {
        const flags = [attributes.extensionMod, attributes.melee, attributes.hiddenLobby,
            attributes.skipInitialDownload, attributes.cluster];
        if (flags.some(flag => typeof flag !== 'boolean') ||
            !(attributes.clusterParent === null || (Number.isInteger(attributes.clusterParent) &&
                attributes.clusterParent > 0 && attributes.clusterParent <= 0xffffffff)) ||
            !Array.isArray(attributes.labels) || attributes.labels.length > 32 ||
            attributes.labels.some(label => typeof label !== 'string' || !label || label.length > 64)) {
            fail('invalid-publication', 'The API reported unusable publish attributes');
        }
    }
    return Object.freeze({ ...value, headerHandle: value.headerHandle.toLowerCase(),
        ...(attributes === undefined ? {} : { attributes: Object.freeze({ ...attributes, labels: Object.freeze([...attributes.labels]) }) }) });
}
/** The publication's own name as a package file name; two publications may share it. */
export function battleNetPublicationName(item) {
    return `${battleNetPublicationDirectory(item).split('--').slice(1).join('--')}`;
}
/**
 * What a catalogue calls each publication: its own name, and the identified form only for the few
 * that would otherwise collide. A reader never has to know an id to address a publication, and two
 * publications that share a name stay addressable.
 */
export function battleNetPublicationNames(items) {
    const counts = new Map();
    for (const item of items) {
        const name = battleNetPublicationName(item).toLowerCase();
        counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const names = new Map();
    for (const item of items) {
        const own = battleNetPublicationName(item);
        names.set(item, counts.get(own.toLowerCase()) === 1 ? own : battleNetPublicationDirectory(item));
    }
    return names;
}
/** Stable ID/version prefix prevents collisions and keeps names out of local cache paths. */
export function battleNetPublicationDirectory(item) {
    const label = item.name.normalize('NFC').replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_')
        .replace(/[. ]+$/u, '').slice(0, 100) || 'Untitled';
    return `${item.id}@${item.version}--${label}.${item.isMod ? 'SC2Mod' : 'SC2Map'}`;
}
/** One cancelled caller must not cancel a download still needed by another mount. */
class SharedJobs {
    jobs = new Map();
    run(key, signal, work) {
        signal.throwIfAborted();
        let job = this.jobs.get(key);
        if (!job || job.controller.signal.aborted) {
            const controller = new AbortController();
            job = { controller, users: 0, promise: Promise.resolve().then(() => work(controller.signal)) };
            this.jobs.set(key, job);
            const current = job;
            const remove = () => { if (this.jobs.get(key) === current)
                this.jobs.delete(key); };
            void job.promise.then(remove, remove);
        }
        const current = job;
        current.users += 1;
        return new Promise((resolveJob, rejectJob) => {
            let done = false;
            const finish = (error, value) => {
                if (done)
                    return;
                done = true;
                signal.removeEventListener('abort', aborted);
                if (--current.users === 0)
                    current.controller.abort();
                if (error)
                    rejectJob(value);
                else
                    resolveJob(value);
            };
            const aborted = () => finish(true, signal.reason);
            signal.addEventListener('abort', aborted, { once: true });
            void current.promise.then(value => finish(false, value), error => finish(true, error));
            if (signal.aborted)
                aborted();
        });
    }
}
/**
 * Read-only MK3 VFS provider. /mine lists the selected profile's publications; ?name filters them.
 * /search?name= delegates public name search to the backend. Neither listing downloads archives.
 * Opening a publication directory downloads its .s2ma once and indexes the MPQ on demand.
 */
export class BattleNetVfsProvider {
    options;
    id = 'blizzard.starcraft2.vfs.battlenet';
    scheme = 'battlenet';
    limits;
    cacheRoot;
    maxArchiveBytes;
    maxPages;
    downloads = new SharedJobs();
    lifetime = new AbortController();
    mounts = new Set();
    publicationsInFlight = new Set();
    publishingRegions = new Set();
    disposal;
    constructor(options) {
        this.options = options;
        if (!options.profileKey.trim() || !options.cacheDirectory.trim())
            fail('invalid-option', 'profileKey and cacheDirectory are required');
        this.limits = clampVfsLimits(options.limits);
        this.maxArchiveBytes = Math.min(positive(options.maxArchiveBytes ?? 128 * 1024 * 1024, 'maxArchiveBytes'), 1024 ** 3);
        this.maxPages = positive(options.maxCataloguePages ?? 100, 'maxCataloguePages');
        this.cacheRoot = join(resolve(options.cacheDirectory), 'battlenet-v1', digest(options.profileKey));
    }
    async open(uri, context) {
        const location = locationOf(uri);
        if (location.accountId !== undefined && location.accountId !== this.options.accountId) {
            fail('account-mismatch', 'This provider is not bound to the account selected by the URI');
        }
        if (this.options.region !== undefined && location.region !== this.options.region) {
            fail('region-mismatch', 'This provider is bound to a different authenticated region');
        }
        const signal = combine(context.signal, this.lifetime.signal);
        signal.throwIfAborted();
        const limits = clampVfsLimits(context.limits, this.limits);
        const api = this.options.api;
        if (location.scope === 'search' && !api.searchMods) {
            fail('search-unavailable', 'This Battle.net API adapter does not implement public name search');
        }
        const publications = new Map();
        const cursors = new Set();
        let cursor;
        let complete = false;
        for (let pageNumber = 0; pageNumber < this.maxPages; pageNumber += 1) {
            signal.throwIfAborted();
            const request = { region: location.region, signal, ...(cursor === undefined ? {} : { cursor }) };
            const page = location.scope === 'mine'
                ? await api.listPublished(request)
                : await api.searchMods({ ...request, name: location.name });
            signal.throwIfAborted();
            if (!page || !Array.isArray(page.items))
                fail('invalid-page', 'The API returned an invalid catalogue page');
            for (const raw of page.items) {
                const item = checkedPublication(raw);
                const key = `${item.id}@${item.version}`;
                const previous = publications.get(key);
                if (previous && previous.headerHandle !== item.headerHandle)
                    fail('unstable-catalogue', 'Publication changed during pagination; reopen the catalogue');
                publications.set(key, item);
                if (publications.size > limits.maxEntries)
                    fail('entry-limit', 'Catalogue exceeds VFS maxEntries; narrow the search');
            }
            if (page.nextCursor === undefined) {
                complete = true;
                break;
            }
            if (typeof page.nextCursor !== 'string' || !page.nextCursor || cursors.has(page.nextCursor)) {
                fail('invalid-cursor', 'The API returned an empty or repeated catalogue cursor');
            }
            cursor = page.nextCursor;
            cursors.add(cursor);
        }
        if (!complete)
            fail('page-limit', 'Catalogue pagination exceeded maxCataloguePages');
        const selected = [...publications.values()].filter(item => location.scope !== 'mine' ||
            !location.name || item.name.toLocaleLowerCase('en-US').includes(location.name.toLocaleLowerCase('en-US')));
        const inner = new BattleNetMount(uri, location, selected, limits, signal, (item, activeSignal) => this.cachedArchive(location.region, item, limits, activeSignal));
        const mount = {
            id: inner.id, rootUri: inner.rootUri, revision: inner.revision,
            stat: (path, activeSignal) => inner.stat(path, activeSignal),
            list: (path, activeSignal) => inner.list(path, activeSignal),
            open: (path, activeSignal) => inner.open(path, activeSignal),
            dispose: () => { this.mounts.delete(mount); inner.dispose(); },
        };
        try {
            if (!await mount.stat('', signal))
                fail('not-found', 'The requested Battle.net directory does not exist');
            this.mounts.add(mount);
            return mount;
        }
        catch (error) {
            mount.dispose();
            throw error;
        }
    }
    /** Publish through this adapter's authenticated profile; native allocation/upload is never retried here. */
    publish(options) {
        const task = this.performPublish(options);
        this.publicationsInFlight.add(task);
        void task.then(() => this.publicationsInFlight.delete(task), () => this.publicationsInFlight.delete(task));
        return task;
    }
    /** What this account has left to publish into. */
    async storage(region, signal) {
        const active = combine(signal, this.lifetime.signal);
        active.throwIfAborted();
        const normalized = normalizeBattleNetRegion(region);
        const ask = this.options.api.storage;
        if (!ask)
            fail('publish-unavailable', 'This Battle.net backend cannot report publication storage');
        return ask({ region: normalized, signal: active });
    }
    /**
     * What the server says about a publication name before anything is compiled. A first publication
     * needs the namespace it answers with; an author also learns from it whether the name is taken.
     */
    async prepublish(region, names, signal) {
        const active = combine(signal, this.lifetime.signal);
        active.throwIfAborted();
        const normalized = normalizeBattleNetRegion(region);
        if (this.options.region !== undefined && normalized !== this.options.region)
            fail('region-mismatch', 'This session is authenticated in another region');
        const ask = this.options.api.prepublish;
        if (!ask)
            fail('publish-unavailable', 'This Battle.net backend cannot prepare a publication');
        return ask({ region: normalized, names: [...names], signal: active });
    }
    async performPublish(options) {
        const signal = combine(options.signal, this.lifetime.signal);
        signal.throwIfAborted();
        const region = normalizeBattleNetRegion(options.region);
        if (this.options.region !== undefined && region !== this.options.region)
            fail('region-mismatch', 'This session is authenticated in another region');
        const backend = this.options.api.publish;
        if (!backend)
            fail('publish-unavailable', 'This Battle.net backend does not implement native publication');
        if (this.publishingRegions.has(region))
            fail('publish-in-progress', 'Another publication is already active for this profile and region');
        this.publishingRegions.add(region);
        try {
            return await publishBattleNetArchive(options, region, this.limits, this.maxArchiveBytes, signal, request => backend.call(this.options.api, request));
        }
        finally {
            this.publishingRegions.delete(region);
        }
    }
    /** Unlink a concrete own publication through the authenticated adapter; never retry automatically. */
    deletePublication(options) {
        const task = this.performDelete(options);
        this.publicationsInFlight.add(task);
        void task.then(() => this.publicationsInFlight.delete(task), () => this.publicationsInFlight.delete(task));
        return task;
    }
    async performDelete(options) {
        const signal = combine(options.signal, this.lifetime.signal);
        signal.throwIfAborted();
        const region = normalizeBattleNetRegion(options.region);
        if (this.options.region !== undefined && region !== this.options.region)
            fail('region-mismatch', 'This session is authenticated in another region');
        const backend = this.options.api.deletePublication;
        if (!backend)
            fail('delete-unavailable', 'Native publication deletion is not configured');
        if (this.publishingRegions.has(region))
            fail('publish-in-progress', 'Another publication operation is active');
        this.publishingRegions.add(region);
        try {
            return await deleteBattleNetPublication(options, region, signal, request => backend.call(this.options.api, request));
        }
        finally {
            this.publishingRegions.delete(region);
        }
    }
    /** Whether the verified current archive is present in this profile's local cache. */
    async isCached(region, publication, signal) {
        const active = combine(signal, this.lifetime.signal);
        active.throwIfAborted();
        const normalized = normalizeBattleNetRegion(region);
        if (this.options.region !== undefined && normalized !== this.options.region)
            fail('region-mismatch', 'This session is authenticated in another region');
        const archive = await this.options.api.resolveArchive({ region: normalized, publication: checkedPublication(publication), signal: active });
        active.throwIfAborted();
        if (!archive || !/^[0-9a-f]{64}$/iu.test(archive.sha256) || archive.kind !== 'mpq')
            return false;
        const maximum = Math.min(this.maxArchiveBytes, Number(this.limits.maxMaterializedBytes), Number(this.limits.maxFileBytes));
        if (archive.size !== undefined && (!Number.isSafeInteger(archive.size) || archive.size <= 0 || archive.size > maximum))
            return false;
        return validCacheFile(join(this.cacheRoot, normalized, `${archive.sha256.toLowerCase()}.s2ma`), archive.sha256.toLowerCase(), maximum, archive.size, active);
    }
    /**
     * Where this publication's archive sits in the local cache, when it is already downloaded and
     * still matches the published digest. A host reveals or opens that file; it never guesses a path.
     */
    async cachedArchivePath(region, publication, signal) {
        const active = combine(signal, this.lifetime.signal);
        active.throwIfAborted();
        const normalized = normalizeBattleNetRegion(region);
        if (this.options.region !== undefined && normalized !== this.options.region)
            fail('region-mismatch', 'This session is authenticated in another region');
        const archive = await this.options.api.resolveArchive({ region: normalized, publication: checkedPublication(publication), signal: active });
        active.throwIfAborted();
        if (!archive || !/^[0-9a-f]{64}$/iu.test(archive.sha256) || archive.kind !== 'mpq')
            return undefined;
        const maximum = Math.min(this.maxArchiveBytes, Number(this.limits.maxMaterializedBytes), Number(this.limits.maxFileBytes));
        const path = join(this.cacheRoot, normalized, `${archive.sha256.toLowerCase()}.s2ma`);
        return (await validCacheFile(path, archive.sha256.toLowerCase(), maximum, archive.size, active)) ? path : undefined;
    }
    /** Materialize a publication archive without requiring the user to browse inside it. */
    async download(region, publication, signal) {
        const active = combine(signal, this.lifetime.signal);
        await this.cachedArchive(normalizeBattleNetRegion(region), checkedPublication(publication), this.limits, active);
    }
    /** Remove only this archive from Modkit's profile-partitioned cache. */
    async clearCache(region, publication, signal) {
        const active = combine(signal, this.lifetime.signal);
        active.throwIfAborted();
        const normalized = normalizeBattleNetRegion(region);
        if (this.options.region !== undefined && normalized !== this.options.region)
            fail('region-mismatch', 'This session is authenticated in another region');
        const archive = await this.options.api.resolveArchive({ region: normalized, publication: checkedPublication(publication), signal: active });
        active.throwIfAborted();
        if (!archive || !/^[0-9a-f]{64}$/iu.test(archive.sha256))
            fail('invalid-archive', 'The API returned an invalid archive reference');
        await unlink(join(this.cacheRoot, normalized, `${archive.sha256.toLowerCase()}.s2ma`)).catch(error => {
            if (error.code !== 'ENOENT')
                throw error;
        });
    }
    /** Cancel VFS work and publication mutations. The session owner closes the native transport. */
    dispose() {
        if (this.disposal)
            return this.disposal;
        this.disposal = Promise.resolve().then(async () => {
            await Promise.allSettled([...this.mounts].map(mount => Promise.resolve().then(() => mount.dispose())));
            await Promise.allSettled([...this.publicationsInFlight]);
        });
        this.lifetime.abort(new BattleNetVfsError('blizzard.battlenet/provider-disposed', 'Battle.net VFS provider is disposed'));
        return this.disposal;
    }
    async cachedArchive(region, publication, limits, signal) {
        const archive = await this.options.api.resolveArchive({ region, publication, signal });
        signal.throwIfAborted();
        if (!archive || !/^[0-9a-f]{64}$/iu.test(archive.sha256))
            fail('invalid-archive', 'The API must return the archive SHA-256 from its verified header');
        if (archive.kind === 'standard-data')
            fail('standard-data-reference', 'This depot object refers to installed Standard Data; it is not an MPQ archive');
        if (archive.kind !== 'mpq')
            fail('invalid-archive', 'Unknown depot object kind');
        const maximum = Math.min(this.maxArchiveBytes, Number(limits.maxMaterializedBytes), Number(limits.maxFileBytes));
        if (archive.size !== undefined && (!Number.isSafeInteger(archive.size) || archive.size <= 0 || archive.size > maximum)) {
            fail('archive-size-limit', 'Archive exceeds the download limit or has an invalid exact size');
        }
        const hash = archive.sha256.toLowerCase();
        const directory = join(this.cacheRoot, region);
        const destination = join(directory, `${hash}.s2ma`);
        return this.downloads.run(`${destination}:${maximum}:${archive.size ?? ''}`, signal, async (activeSignal) => {
            if (await validCacheFile(destination, hash, maximum, archive.size, activeSignal))
                return destination;
            await mkdir(directory, { recursive: true, mode: 0o700 });
            const temporary = join(directory, `${hash}.${randomUUID()}.part`);
            const file = await open(temporary, 'wx', 0o600);
            try {
                const checksum = createHash('sha256');
                let size = 0;
                for await (const chunk of this.options.api.downloadArchive({ region, archive, signal: activeSignal })) {
                    activeSignal.throwIfAborted();
                    if (!(chunk instanceof Uint8Array))
                        fail('invalid-download', 'Archive stream must contain byte chunks');
                    size += chunk.byteLength;
                    if (!Number.isSafeInteger(size) || size > maximum)
                        fail('archive-size-limit', 'Archive stream exceeded the download limit');
                    checksum.update(chunk);
                    let offset = 0;
                    while (offset < chunk.byteLength) {
                        activeSignal.throwIfAborted();
                        const written = await file.write(chunk, offset, chunk.byteLength - offset);
                        if (!written.bytesWritten)
                            fail('cache-write', 'Cache write made no progress');
                        offset += written.bytesWritten;
                    }
                }
                activeSignal.throwIfAborted();
                if (!size || (archive.size !== undefined && size !== archive.size) || checksum.digest('hex') !== hash) {
                    fail('integrity', 'Downloaded archive length or SHA-256 does not match the verified header');
                }
                await file.sync();
                await file.close();
                activeSignal.throwIfAborted();
                await rename(temporary, destination);
                return destination;
            }
            finally {
                await file.close();
                await unlink(temporary).catch(error => { if (error.code !== 'ENOENT')
                    throw error; });
            }
        });
    }
}
async function validCacheFile(path, hash, maximum, exact, signal) {
    try {
        const info = await stat(path);
        signal.throwIfAborted();
        if (!info.isFile() || info.size <= 0 || info.size > maximum || (exact !== undefined && exact !== info.size))
            return false;
        const checksum = createHash('sha256');
        let size = 0;
        for await (const chunk of createReadStream(path, { signal })) {
            size += chunk.length;
            if (size > maximum)
                return false;
            checksum.update(chunk);
        }
        return size === info.size && checksum.digest('hex') === hash;
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return false;
        throw error;
    }
}
class BattleNetMount {
    rootUri;
    location;
    limits;
    parentSignal;
    getArchive;
    id;
    revision;
    lifetime = new AbortController();
    publications = new Map();
    archives = new Map();
    sources = new Set();
    preparing = new SharedJobs();
    serial = Promise.resolve();
    materialized = 0;
    readBytes = 0n;
    entryCount;
    constructor(rootUri, location, items, limits, parentSignal, getArchive) {
        this.rootUri = rootUri;
        this.location = location;
        this.limits = limits;
        this.parentSignal = parentSignal;
        this.getArchive = getArchive;
        this.id = rootUri;
        // The catalogue is named by the publications themselves; an id appears only where two collide.
        const names = battleNetPublicationNames(items);
        for (const item of items)
            this.publications.set(this.path(names.get(item)), item);
        this.entryCount = items.length;
        this.revision = `sha256:${digest(JSON.stringify([...this.publications].sort()))}`;
        this.path(location.root);
    }
    active(signal) {
        const result = combine(this.parentSignal, this.lifetime.signal, signal);
        result.throwIfAborted();
        return result;
    }
    path(value) {
        const path = normalizeVfsPath(value);
        if (Buffer.byteLength(path, 'utf8') > this.limits.maxPathBytes)
            fail('path-limit', 'VFS path exceeds maxPathBytes');
        return path;
    }
    absolute(path) {
        const relative = this.path(path);
        return this.path([this.location.root, relative].filter(Boolean).join('/'));
    }
    relative(path) {
        return this.location.root ? path.slice(this.location.root.length).replace(/^\//u, '') : path;
    }
    node(path, kind, publication) {
        return Object.freeze({ path, name: path.split('/').at(-1) ?? '', kind, revision: this.revision,
            ...(publication ? { publication } : {}) });
    }
    async stat(path, signal) {
        const active = this.active(signal);
        const absolute = this.absolute(path);
        if (!absolute)
            return this.node('', 'directory');
        const [directory = '', ...parts] = absolute.split('/');
        const item = this.publications.get(directory);
        if (!item)
            return undefined;
        if (!parts.length)
            return this.node(this.relative(directory), 'directory', item);
        const archive = await this.prepare(directory, item, active);
        const node = archive.nodes.get(parts.join('/'));
        return node ? { ...node, path: this.relative(`${directory}/${node.path}`) } : undefined;
    }
    async *list(path, signal) {
        const active = this.active(signal);
        const absolute = this.absolute(path);
        if (!absolute) {
            for (const [directory, item] of [...this.publications].sort(([a], [b]) => a.localeCompare(b))) {
                active.throwIfAborted();
                yield this.node(directory, 'directory', item);
            }
            return;
        }
        const [directory = '', ...parts] = absolute.split('/');
        const item = this.publications.get(directory);
        if (!item)
            fail('not-found', 'Publication directory was not found');
        const archive = await this.prepare(directory, item, active);
        const internal = parts.join('/');
        const current = internal ? archive.nodes.get(internal) : { kind: 'directory' };
        if (!current)
            fail('not-found', 'Archive directory was not found');
        if (current.kind !== 'directory')
            fail('not-a-directory', 'Cannot list an archive file');
        const prefix = internal ? `${internal}/` : '';
        for (const node of archive.nodes.values()) {
            active.throwIfAborted();
            if (!node.path.startsWith(prefix) || node.path.slice(prefix.length).includes('/'))
                continue;
            yield { ...node, path: this.relative(`${directory}/${node.path}`) };
        }
    }
    async open(path, signal) {
        const active = this.active(signal);
        const [directory = '', ...parts] = this.absolute(path).split('/');
        const item = this.publications.get(directory);
        if (!item || !parts.length)
            fail('not-a-file', 'Select a file inside a publication');
        const archive = await this.prepare(directory, item, active);
        const entry = archive.nodes.get(parts.join('/'));
        const entryId = archive.ids.get(parts.join('/'));
        if (!entry || entry.kind !== 'file' || entryId === undefined)
            fail('not-a-file', 'Archive file was not found');
        const size = Number(entry.size);
        this.reserve(size);
        let bytes;
        try {
            bytes = await archive.reader.read(entryId, active);
            active.throwIfAborted();
            if (bytes.byteLength !== size)
                fail('entry-size', 'Decoded MPQ entry size differs from its table');
        }
        catch (error) {
            this.materialized -= size;
            throw error;
        }
        const source = this.source(`${this.rootUri}#${encodeURIComponent(path)}`, bytes, size);
        this.sources.add(source);
        return source;
    }
    prepare(directory, item, signal) {
        const existing = this.archives.get(directory);
        if (existing)
            return Promise.resolve(existing);
        return this.preparing.run(directory, signal, workSignal => {
            // Serial indexing makes the mount-wide retained-byte/entry budget independent of races.
            const work = this.serial.then(async () => {
                const active = this.active(workSignal);
                const cached = this.archives.get(directory);
                if (cached)
                    return cached;
                const file = await this.getArchive(item, active);
                const info = await stat(file);
                active.throwIfAborted();
                this.reserve(info.size);
                let reservation = info.size;
                let reader;
                try {
                    const bytes = await readFile(file, { signal: active });
                    active.throwIfAborted();
                    // Recheck the bytes consumed by the parser, including cache changes between reads.
                    if (bytes.byteLength !== info.size || `${digest(bytes)}.s2ma` !== file.split(/[\\/]/u).at(-1)) {
                        fail('integrity', 'Cached archive changed before it could be opened');
                    }
                    if (bytes.subarray(0, 14).toString() === 'Standard Data:') {
                        fail('standard-data-reference', 'This depot object refers to installed Standard Data');
                    }
                    reader = await openMpqReader(bytes, {
                        maxArchiveBytes: Math.max(1, info.size), maxEntries: this.limits.maxEntries,
                        maxEntryBytes: Math.min(1024 ** 3, Number(this.limits.maxFileBytes), Number(this.limits.maxMaterializedBytes)),
                        signal: active,
                    });
                    active.throwIfAborted();
                    this.reserve(reader.retainedBytes - reservation);
                    reservation = reader.retainedBytes;
                    const nodes = new Map();
                    const ids = new Map();
                    for (const entry of reader.entries) {
                        const path = this.path(entry.path);
                        this.path(`${directory}/${path}`);
                        if (!path || nodes.has(path))
                            fail('archive-path-conflict', 'MPQ contains conflicting file paths');
                        ids.set(path, entry.id);
                        nodes.set(path, { ...this.node(path, 'file'), size: BigInt(entry.size) });
                    }
                    for (const path of ids.keys()) {
                        const parts = path.split('/');
                        parts.pop();
                        while (parts.length) {
                            const parent = parts.join('/');
                            if (ids.has(parent))
                                fail('archive-path-conflict', 'An MPQ path is both a file and a directory');
                            nodes.set(parent, this.node(parent, 'directory'));
                            parts.pop();
                        }
                        if (this.entryCount + nodes.size > this.limits.maxEntries)
                            fail('entry-limit', 'Mounted archive entries exceed maxEntries');
                    }
                    const result = { reader, nodes: new Map([...nodes].sort(([a], [b]) => a.localeCompare(b))), ids };
                    this.entryCount += nodes.size;
                    this.archives.set(directory, result);
                    return result;
                }
                catch (error) {
                    reader?.dispose();
                    this.materialized -= reservation;
                    throw error;
                }
            });
            this.serial = work.catch(() => undefined);
            return work;
        });
    }
    reserve(bytes) {
        if (!Number.isSafeInteger(bytes) || bytes < 0 || BigInt(this.materialized + bytes) > this.limits.maxMaterializedBytes) {
            fail('memory-limit', 'Mount exceeds maxMaterializedBytes; close files or open a smaller catalogue');
        }
        this.materialized += bytes;
    }
    source(id, initial, size) {
        let bytes = initial;
        let disposed = false;
        const live = (signal) => {
            this.active(signal);
            if (disposed)
                fail('source-disposed', 'VFS file source is disposed');
        };
        const range = (offset, length) => {
            if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || length > size - offset) {
                fail('read-range', 'Read range is outside the file');
            }
        };
        const consume = (length) => {
            if (this.readBytes + BigInt(length) > this.limits.maxReadBytes)
                fail('read-limit', 'Mount exceeds cumulative maxReadBytes');
            this.readBytes += BigInt(length);
        };
        const source = {
            id,
            size: async (signal) => { live(signal); return size; },
            readAt: async (offset, length, signal) => {
                live(signal);
                range(offset, length);
                if (length > this.limits.maxReadRangeBytes)
                    fail('range-limit', 'Read exceeds maxReadRangeBytes');
                consume(length);
                return bytes.slice(offset, offset + length);
            },
            stream: (start = 0, end = size, signal) => {
                live(signal);
                range(start, end - start);
                if (BigInt(end - start) > this.limits.maxStreamBytes)
                    fail('stream-limit', 'Stream exceeds maxStreamBytes');
                let position = start;
                return new ReadableStream({
                    pull: controller => {
                        live(signal);
                        if (position === end) {
                            controller.close();
                            return;
                        }
                        const next = Math.min(position + 64 * 1024, end);
                        consume(next - position);
                        controller.enqueue(bytes.slice(position, next));
                        position = next;
                    },
                });
            },
            dispose: () => {
                if (disposed)
                    return;
                disposed = true;
                bytes = new Uint8Array();
                this.materialized -= size;
                this.sources.delete(source);
            },
        };
        return source;
    }
    dispose() {
        this.lifetime.abort(new BattleNetVfsError('blizzard.battlenet/mount-disposed', 'Battle.net mount is disposed'));
        for (const source of this.sources)
            void source.dispose();
        for (const archive of this.archives.values()) {
            this.materialized -= archive.reader.retainedBytes;
            archive.reader.dispose();
        }
        this.archives.clear();
    }
}
export function createBattleNetVfsProvider(options) {
    return new BattleNetVfsProvider(options);
}
//# sourceMappingURL=vfs-provider.js.map
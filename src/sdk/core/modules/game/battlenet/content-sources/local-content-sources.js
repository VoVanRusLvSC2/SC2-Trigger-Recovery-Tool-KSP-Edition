import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { BattleNetCacheSource } from "./cache-source.js";
import { MAX_FILE, Sc2FolderSource, Sc2MapsCacheSource } from "./local-files.js";
import { Sc2CascSource } from "./casc-source.js";
import { BattleNetContentSources } from "./content-sources.js";
import { createPublicDepotApi } from "./public-depot.js";
import { documentsDirectory, editorWizardDirectories, knownFolder } from "./windows-folders.js";
const MOD_SOURCE_TYPES = ['mods', 'zip', 'json', 'casc'];
/**
 * MK2's rules for a source list merged across settings levels: an entry with `disabled` removes
 * every entry of the same type and path and resolves nothing itself; a path that is not absolute
 * (a token VS Code could not resolve) is skipped; lower `priority` is tried first, ties keep the
 * given order; a `casc` source, a base game, comes after every other.
 */
export function modSourceChain(sources) {
    const key = (source) => `${source.type}\0${resolve(source.path).toLowerCase()}`;
    const dropped = new Set(sources.filter(source => source.disabled === true).map(key));
    return sources
        .map((source, order) => ({ source, order }))
        .filter(({ source }) => isAbsolute(source.path) && !dropped.has(key(source)))
        .sort((a, b) => Number(a.source.type === 'casc') - Number(b.source.type === 'casc') ||
        (a.source.priority ?? 0) - (b.source.priority ?? 0) ||
        a.order - b.order)
        .map(({ source }) => source);
}
/** The folders the loader looks for packages in; a `mods` source answers under each of them. */
const PACKAGE_FOLDERS = ['Mods', 'Maps', 'Campaigns'];
/**
 * A folder of packages as the loader's storage, found by name as in MK2: `Mods/Foo.SC2Mod` and
 * `Mods/any/where/Foo.SC2Mod` are both `<folder>/Foo.SC2Mod`.
 */
function packageFolderStorage(source) {
    const inner = (path) => {
        const names = path.split('/');
        if (!PACKAGE_FOLDERS.some(name => name.toLowerCase() === names[0]?.toLowerCase()))
            return undefined;
        const at = names.findIndex(name => /\.sc2(?:mod|map|campaign)$/iu.test(name));
        return at < 0 ? '' : names.slice(at).join('/');
    };
    return {
        id: source.root.id,
        async list(path) {
            if (path === '')
                return PACKAGE_FOLDERS.map(name => ({ name, directory: true }));
            const at = inner(path);
            return at === undefined ? [] : source.list(at);
        },
        async read(path, maxBytes) {
            const at = inner(path);
            if (at === undefined)
                throw new Error(`${path} is not in ${source.root.id}`);
            return source.read(at, maxBytes);
        },
    };
}
const PACKAGE_NAME = /\.sc2(?:mod|map|campaign)$/iu;
/**
 * A folder of zip archives holding mod folders (MK2's `zip` source) as the loader's storage: each
 * package found by name at any depth of any archive, the first archive in name order winning.
 * Archives are read by ranges when first asked, and closed with the content sources.
 */
function zipModFolderStorage(id, directory) {
    let loaded;
    const load = () => loaded ??= (async () => {
        const [{ readZipByRanges }, { containerEntryLayer }, { fileRangeSource }] = await Promise.all([
            import('modkit-extension-archives/formats/zip/codec'),
            import('@modkit/codec-kit'),
            import('@modkit/vfs/content-sources/node'),
        ]);
        const packages = new Map();
        const layers = [];
        for (const name of (await readdir(directory)).filter(item => /\.zip$/iu.test(item)).sort()) {
            const source = fileRangeSource(join(directory, name));
            const { containerEntries } = await readZipByRanges(source, { maxInputBytes: MAX_FILE, maxNodes: 100_000 });
            const layer = containerEntryLayer(name, containerEntries, source, () => source.close());
            layers.push(layer);
            for (const entry of layer.entries) {
                const parts = entry.path.split('/');
                const at = parts.findIndex(part => PACKAGE_NAME.test(part));
                const key = parts[at]?.toLowerCase();
                if (at >= 0 && key !== undefined && !packages.has(key)) {
                    packages.set(key, { layer, root: parts.slice(0, at + 1).join('/'), name: parts[at] });
                }
            }
        }
        return { packages, layers };
    })();
    /** The package a loader path names and the path inside it, or undefined outside the package folders. */
    const locate = async (path) => {
        const names = path.split('/');
        if (!PACKAGE_FOLDERS.some(name => name.toLowerCase() === names[0]?.toLowerCase()))
            return undefined;
        const at = names.findIndex(name => PACKAGE_NAME.test(name));
        const { packages } = await load();
        if (at < 0)
            return { packages };
        const found = packages.get(names[at].toLowerCase());
        return found === undefined ? undefined : { found, inner: names.slice(at + 1).join('/').toLowerCase() };
    };
    return {
        id,
        async list(path) {
            if (path === '')
                return PACKAGE_FOLDERS.map(name => ({ name, directory: true }));
            const at = await locate(path);
            if (at === undefined)
                return [];
            if ('packages' in at)
                return [...at.packages.values()].map(item => ({ name: item.name, directory: true }));
            const prefix = `${at.found.root}/${at.inner === '' ? '' : `${at.inner}/`}`.toLowerCase();
            const children = new Map();
            for (const entry of at.found.layer.entries) {
                if (!entry.path.toLowerCase().startsWith(prefix))
                    continue;
                const [name, ...rest] = entry.path.slice(prefix.length).split('/');
                if (name === undefined || name === '')
                    continue;
                children.set(name.toLowerCase(), rest.length > 0 ? { name, directory: true } : { name, directory: false, size: Number(entry.size) });
            }
            return [...children.values()];
        },
        async read(path, maxBytes) {
            const at = await locate(path);
            if (at !== undefined && !('packages' in at)) {
                const wanted = `${at.found.root}/${at.inner}`.toLowerCase();
                const entry = at.found.layer.entries.find(item => item.path.toLowerCase() === wanted);
                if (entry !== undefined)
                    return at.found.layer.read(entry.path, maxBytes);
            }
            throw new Error(`${path} is not in ${id}`);
        },
        async dispose() {
            const current = loaded;
            loaded = undefined;
            if (current !== undefined)
                await Promise.allSettled((await current).layers.map(layer => layer.close()));
        },
    };
}
/** A folder of JSON mods (`*.json`) as the loader's storage, read when first asked. */
function jsonModFolderStorage(id, directory) {
    let loaded;
    const load = () => loaded ??= (async () => {
        const { jsonModContentSource, parseJsonMod } = await import("../../../mod/shared/json-mod.js");
        const mods = new Map();
        for (const name of (await readdir(directory)).filter(item => /\.json$/iu.test(item)).sort()) {
            const file = join(directory, name);
            if ((await stat(file)).size > MAX_FILE)
                throw new RangeError(`${file} is larger than ${MAX_FILE} bytes`);
            mods.set(name.replace(/\.json$/iu, ''), parseJsonMod(await readFile(file, 'utf8')));
        }
        return jsonModContentSource(id, mods);
    })();
    return {
        id,
        list: async (path) => (await load()).list(path),
        read: async (path, maxBytes) => (await load()).read(path, maxBytes),
    };
}
/**
 * Where the installed game's CASC name index is kept: the host's shared index cache directory, the
 * codec's too, else this source's own `casc-index`, which the shared one replaces and removes.
 */
function cascIndexCache(options) {
    const own = options.cacheDirectory === undefined || !isAbsolute(options.cacheDirectory)
        ? undefined : join(options.cacheDirectory, 'casc-index');
    const directory = options.indexCacheDirectory ?? own;
    if (directory === undefined)
        return undefined;
    return { directory,
        ...(options.indexCacheDirectory !== undefined && own !== undefined ? { legacy: own } : {}),
        ...(options.indexCaches === undefined ? {} : { switches: options.indexCaches }) };
}
/** Where packages are looked for, in this order: the player's install over the game's own storage. */
const PACKAGE_SOURCE_IDS = ['local:installation', 'local:casc', 'local:documents'];
/** Combines independently usable local providers with the optional authenticated online catalogue. */
export class Sc2DesktopContentSources {
    options;
    online;
    locals = new Map();
    cache;
    modContexts;
    /** The source that opens a ModContext also advertises its game-owned Runtime projection.
     * This is a trusted local capability: no live context or private bindings enter a worker.
     */
    runtimePreparer = Object.freeze({
        major: 1, gameId: 'blizzard/starcraft-2',
        adapter: Object.freeze({ id: 'blizzard.sc2/galaxy-runtime', version: '0.1.0' }),
        prepare: async (request) => {
            if (!request.selection || typeof request.selection !== 'object'
                || Array.isArray(request.selection))
                throw new TypeError('SC2 Runtime requires a selected unit, map, Galaxy source and roster');
            // Keep the runtime lane out of the Battle.net/content-source TypeScript build graph.
            const runtimeModule = '@modkit/blizzard-starcraft2/runtime/subject-composition';
            const { prepareSc2RuntimeProjection } = await import(runtimeModule);
            return prepareSc2RuntimeProjection({ ...request.selection,
                context: request.context, services: request.services, budgets: request.budgets,
                quantizeFixed64Decimal: request.quantizeFixed64Decimal });
        },
    });
    constructor(options, online) {
        this.options = options;
        this.online = online;
        const programData = process.env['ProgramData'] ?? 'C:\\ProgramData';
        this.cache = new BattleNetCacheSource(options.battleNetCacheDirectory ?? join(programData, 'Blizzard Entertainment', 'Battle.net', 'Cache'), options.locale);
        const sources = [
            this.cache,
            new Sc2MapsCacheSource(options.sc2MapsCacheDirectory ?? join(programData, 'Blizzard Entertainment', 'StarCraft II', 'Maps', 'Cache'), () => this.cache.archiveDisplayNames()),
            new Sc2FolderSource(options.documentsDirectory ?? join(homedir(), 'Documents', 'StarCraft II'), 'local:documents', 'StarCraft II — данные игрока и настройки'),
        ];
        if (options.installationDirectory)
            sources.splice(1, 0, new Sc2FolderSource(options.installationDirectory, 'local:installation', 'StarCraft II — Maps, Mods и Campaigns', ['Maps', 'Mods', 'Campaigns']), 
            // The stock packages (Core first of all) live in the game's CASC storage, not in `Mods`.
            ...existsSync(join(options.installationDirectory, '.build.info')) ? [new Sc2CascSource(options.installationDirectory, cascIndexCache(options))] : []);
        for (const [index, directory] of (options.wizardDirectories ?? []).entries()) {
            const source = new Sc2FolderSource(directory, `local:editor-wizards:${index}`, `StarCraft II Editor — мастера (${directory})`);
            sources.push(source);
            this.wizardSourceIds.push(source.root.id);
        }
        // Configured package sources: shown like the others, tried before the installation (casc is
        // the installation itself, see `localOptions`).
        for (const [index, extra] of modSourceChain(options.sources ?? []).entries()) {
            if (extra.type === 'mods') {
                const folder = new Sc2FolderSource(extra.path, `local:mods:${index}`, `StarCraft II — моды (${extra.path})`);
                sources.push(folder);
                this.extraStorages.set(folder.root.id, packageFolderStorage(folder));
            }
            else if (extra.type === 'json') {
                this.extraStorages.set(`local:json:${index}`, jsonModFolderStorage(`local:json:${index}`, extra.path));
            }
            else if (extra.type === 'zip') {
                this.extraStorages.set(`local:zip:${index}`, zipModFolderStorage(`local:zip:${index}`, extra.path));
            }
        }
        for (const source of sources)
            this.locals.set(source.root.id, source);
    }
    wizardSourceIds = [];
    /** The loader's view of configured package sources, in the order they are tried. */
    extraStorages = new Map();
    async snapshot() {
        const online = await this.online?.snapshot();
        return { label: 'StarCraft II', publishing: online?.publishing ?? false, deletion: online?.deletion ?? false, regions: online?.regions ?? [], connections: online?.connections ?? [],
            roots: [...Array.from(this.locals.values(), source => source.root), ...(online?.roots ?? [])] };
    }
    remote() { if (!this.online)
        throw new Error('Online Battle.net is not configured'); return this.online; }
    connect(region, accountId) { return this.remote().connect(region, accountId); }
    disconnect(id) { return this.remote().disconnect(id); }
    storage(id) { return this.remote().storage(id); }
    preparePublish(id, filePath, packagePath) { return this.remote().preparePublish(id, filePath, packagePath); }
    /** Compile the next revision of a publication this account owns, from a local archive. */
    prepareRevision(sourceId, path, options) {
        return this.remote().prepareRevision(sourceId, path, options);
    }
    /** Compile a document Battle.net has never seen. */
    prepareFirstPublication(connectionId, options) {
        return this.remote().prepareFirstPublication(connectionId, options);
    }
    publish(id) { return this.remote().publish(id); }
    deletionCandidates(id) { return this.remote().deletionCandidates(id); }
    deletePublication(id) { return this.remote().deletePublication(id); }
    prepareDeletePublication(sourceId, path) { return this.remote().prepareDeletePublication(sourceId, path); }
    download(sourceId, path) { return this.remote().download(sourceId, path); }
    clearCache(sourceId, path) { return this.remote().clearCache(sourceId, path); }
    search(id, name) { return this.remote().search(id, name); }
    add(id) { return this.remote().add(id); }
    remove(id, path) { return this.remote().remove(id, path); }
    async refresh(id) {
        // The loader caches package listings and parsed catalogs across editor documents.
        // A source refresh must invalidate those shared values before a loaded mod is reopened.
        ;
        (await this.modContexts)?.invalidate();
        if (id === 'host')
            return;
        return this.locals.get(id)?.refresh() ?? this.remote().refresh(id);
    }
    list(id, path) { return this.locals.get(id)?.list(path) ?? this.remote().list(id, path); }
    read(id, path, maximum) { return this.locals.get(id)?.read(path, maximum) ?? this.remote().read(id, path, maximum); }
    /** Bulk file listing for a workspace search; a source that cannot answers undefined and is walked. */
    async files(id, path, query) { return this.locals.get(id)?.files?.(path, query); }
    resolveLocalPath(id, path) { return this.locals.get(id)?.resolveLocalPath(path); }
    resolveCacheHandle(handle) {
        return this.cache.resolveArchive(handle);
    }
    /**
     * Open a file, folder or package inside the mods it belongs to — the one loader every host and
     * consumer goes through (see `@modkit/vfs` `ContentSources.openModContext`).
     */
    async openModContext(request) {
        return (await this.loader()).open(request);
    }
    /**
     * Where that same loader would place a target, without opening a context (see `@modkit/vfs`
     * `ContentSources.locateModPackage`).
     */
    async locateModPackage(target, signal) {
        return (await this.loader()).locateModPackage(target, signal);
    }
    loader() {
        // Loaded on first use: a session that never opens a mod context never loads the mod reader.
        this.modContexts ??= import("../../../mod/shared/workspace/mod-contexts.js").then(module => module.createSc2ModContexts({
            // The cache last: it holds no package by name, only the archives a replay names.
            sources: () => this.storages([...this.extraStorages.keys(), ...PACKAGE_SOURCE_IDS, this.cache.root.id]),
            addOns: () => this.storages(this.wizardSourceIds),
            // A path below the installation that is no file there is a member of the game's CASC.
            storagePathOf: hostPath => {
                const root = this.options.installationDirectory;
                if (root === undefined || !this.locals.has('local:casc'))
                    return undefined;
                const inside = relative(root, hostPath).replaceAll('\\', '/');
                return inside === '' || inside.startsWith('..') || isAbsolute(inside)
                    ? undefined
                    : { sourceId: 'local:casc', path: inside };
            },
            replayLayers: async (bytes) => {
                const { readReplayDependencySet } = await import("../../../replay/services/dependencies/cache-handles.js");
                const set = await readReplayDependencySet(bytes);
                const layers = [];
                const unresolved = [];
                for (const dependency of set.dependencies) {
                    const archive = await this.cache.resolveArchive(dependency.handle);
                    if (archive.state === 'resolved' && archive.path !== undefined) {
                        layers.push({
                            sourceId: archive.sourceId,
                            path: archive.path,
                            fingerprint: `content-hash.sha256:${dependency.handle.sha256}`,
                        });
                    }
                    else
                        unresolved.push(dependency.id);
                }
                return { layers, unresolved };
            },
            hostFolder: directory => {
                const folder = new Sc2FolderSource(directory, 'host', 'Opened package');
                return {
                    id: 'host',
                    list: path => folder.list(path),
                    read: (path, maxBytes) => folder.read(path, maxBytes),
                    dispose: () => folder.dispose(),
                };
            },
        }));
        return this.modContexts;
    }
    /** Local sources as the mod loader's storages, in the given order; absent ones are skipped. */
    storages(ids) {
        return new Map(ids.flatMap(id => {
            const extra = this.extraStorages.get(id);
            if (extra !== undefined)
                return [[id, extra]];
            const source = this.locals.get(id);
            return source === undefined ? [] : [[id, {
                        id,
                        list: (path) => source.list(path),
                        read: (path, maxBytes) => source.read(path, maxBytes),
                    }]];
        }));
    }
    async dispose() {
        const contexts = this.modContexts;
        this.modContexts = undefined;
        await Promise.allSettled([...this.locals.values()].map(source => source.dispose())
            .concat([...this.extraStorages.values()].flatMap(storage => storage.dispose === undefined ? [] : [storage.dispose()]))
            .concat(this.online ? [this.online.dispose()] : [])
            .concat(contexts === undefined ? [] : [contexts.then(loader => loader.dispose())]));
    }
}
export function localOptions(raw) {
    const result = {};
    const wizardDirectories = raw['wizardDirectories'];
    if (wizardDirectories !== undefined) {
        if (!Array.isArray(wizardDirectories) || wizardDirectories.length > 64 || !wizardDirectories.every(item => typeof item === 'string' && item.length > 0 && item.length <= 4096))
            throw new Error('Invalid local source option: wizardDirectories');
        result.wizardDirectories = Object.freeze([...wizardDirectories]);
    }
    for (const key of ['battleNetCacheDirectory', 'sc2MapsCacheDirectory', 'installationDirectory', 'documentsDirectory', 'locale', 'cacheDirectory']) {
        const value = raw[key];
        if (value !== undefined) {
            if (typeof value !== 'string' || !value || value.length > 4096)
                throw new Error(`Invalid local source option: ${key}`);
            result[key] = value;
        }
    }
    const sources = raw['sources'];
    if (sources !== undefined) {
        if (!Array.isArray(sources) || sources.length > 64)
            throw new Error('Invalid local source option: sources');
        result.sources = Object.freeze(sources.map((item, index) => {
            const source = item;
            if (source === null || typeof source !== 'object' || !MOD_SOURCE_TYPES.includes(source.type) ||
                typeof source.path !== 'string' || !source.path || source.path.length > 4096 ||
                (source.priority !== undefined && !Number.isFinite(source.priority)) ||
                (source.disabled !== undefined && typeof source.disabled !== 'boolean')) {
                throw new Error(`Invalid local source option: sources[${index}]`);
            }
            return Object.freeze({ type: source.type, path: source.path,
                ...(source.priority === undefined ? {} : { priority: source.priority }),
                ...(source.disabled === undefined ? {} : { disabled: source.disabled }) });
        }));
        // MK2's `casc` source was the base game: the first one in the chain is the installation.
        const casc = modSourceChain(result.sources).find(source => source.type === 'casc');
        if (casc !== undefined)
            result.installationDirectory = casc.path;
    }
    return result;
}
/**
 * Standalone entry point: local sources work without Python, Electron login helper or a network connection.
 * A trusted host hands its installation probes beside the options (`ContentSourceModuleContext`).
 */
export async function createContentSources(raw, context) {
    const local = await hostLocalOptions(raw, context);
    /*
     * The public half of Battle.net needs no account.
     *
     * A publication addresses its own header, the header addresses its archive, and the depot
     * serves both over HTTPS by digest — so published maps and mods are readable, and anything the
     * game already downloaded is readable with no network at all. Signing in, listing an account's
     * own publications, searching by name, publishing and deleting are a different matter: they
     * speak the game's service, which lives in the native backend. Advertising no regions is how
     * this provider says so, rather than offering a login that could only fail.
     */
    const stateDirectory = typeof raw['stateDirectory'] === 'string' ? raw['stateDirectory'] : undefined;
    if (stateDirectory === undefined || !isAbsolute(stateDirectory)) {
        return new Sc2DesktopContentSources(local);
    }
    const cacheDirectory = typeof raw['cacheDirectory'] === 'string' && isAbsolute(raw['cacheDirectory'])
        ? raw['cacheDirectory']
        : join(stateDirectory, 'battlenet-depot');
    const online = new BattleNetContentSources({
        stateDirectory,
        cacheDirectory,
        publishing: false,
        deletion: false,
        authentication: {
            supportedRegions: [],
            login: () => {
                throw new Error('Signing in to Battle.net needs the native runtime; only public content is available');
            },
        },
        publicApi: createPublicDepotApi(local.battleNetCacheDirectory === undefined
            ? {}
            : { cacheDirectory: local.battleNetCacheDirectory }),
    });
    return new Sc2DesktopContentSources(local, online);
}
/**
 * The local sources' options from a module's raw options and the host's context: the shared index
 * cache and its switches, then what the probes discover. Every entry point (this module's and the
 * desktop backend's) takes them from here, so the CASC name index stays one copy.
 */
export function hostLocalOptions(raw, context) {
    const shared = context?.indexCacheDirectory;
    return discoverLocalOptions({ ...localOptions(raw),
        ...(shared !== undefined && isAbsolute(shared) ? { indexCacheDirectory: shared } : {}),
        ...(context?.indexCaches === undefined ? {} : { indexCaches: context.indexCaches }) }, context?.installationProbes);
}
export async function discoverLocalOptions(options, probes) {
    const documents = options.documentsDirectory ?? join(await documentsDirectory(probes), 'StarCraft II');
    const programData = options.battleNetCacheDirectory === undefined || options.sc2MapsCacheDirectory === undefined
        ? await knownFolder(probes, 'program-data') : undefined;
    const blizzard = programData === undefined ? undefined : join(programData, 'Blizzard Entertainment');
    return { ...options, documentsDirectory: documents,
        ...(options.battleNetCacheDirectory === undefined && blizzard !== undefined
            ? { battleNetCacheDirectory: join(blizzard, 'Battle.net', 'Cache') } : {}),
        ...(options.sc2MapsCacheDirectory === undefined && blizzard !== undefined
            ? { sc2MapsCacheDirectory: join(blizzard, 'StarCraft II', 'Maps', 'Cache') } : {}),
        wizardDirectories: options.wizardDirectories ?? await editorWizardDirectories(documents, probes) };
}
//# sourceMappingURL=local-content-sources.js.map
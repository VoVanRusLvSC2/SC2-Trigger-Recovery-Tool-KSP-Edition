/**
 * StarCraft II's dependency chain over the host's content sources: which packages a package — or a
 * file that belongs to none — loads beneath it, in load order, and the files of each layer.
 *
 * Nothing is parsed here. Every read goes through one virtual file system: the content sources
 * (installation folder, CASC, documents, the Battle.net cache) by protocol, add-on sources the
 * editor loads whatever is open (wizard folders), the folder an opened package sits in as one more
 * content source (a packed package reads as a folder there), and a loose root that declares only
 * its base mods. Merged data is the Data language's own analysis of these files (see
 * `context-catalog.ts`).
 */
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { ModResolver } from "./resolver.js";
import { FsReader, VirtualFileSystem } from "./vfs.js";
import { ContentSourceReader, contentSourceResolver, } from "./content-source-provider.js";
import { parseComponentList, parseSc2ComponentList, } from "../../codecs/document-metadata/core/component-list.js";
import { sc2BuiltinDirectDependencies } from "./implicit-dependencies.js";
/** The source id of a layer on the host's disk: an opened package, its siblings, a loose root. */
export const HOST_SOURCE_ID = 'host';
const MOD_ROOT_RE = /\.(sc2mod|sc2map|sc2campaign)$/i;
/** Protocol prefix of a root opened outside any package (see {@link ModContextManager.resolveLoose}). */
const LOOSE_ROOT = /^loose\d+:/iu;
const trim = (p) => p.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
const lastSegment = (p) => trim(p).slice(trim(p).lastIndexOf('/') + 1);
/** Paths of one reader under a folder of another: `prefixed(vfs, 'content-source0:')`. */
function prefixed(vfs, protocol) {
    return {
        list: p => vfs.list(`${protocol}${trim(p)}`),
        get: p => vfs.get(`${protocol}${trim(p)}`),
        getText: p => vfs.getText(`${protocol}${trim(p)}`),
        exists: p => vfs.exists(`${protocol}${trim(p)}`),
    };
}
/**
 * A file — or a folder of files — that belongs to no package, as the root of a package whose
 * DocumentInfo declares nothing but `baseMods`. A folder serves every file under it; the
 * declaration exists only so the chain resolves and is not listed as a file. `reader` holds the
 * file: the host disk or a content source.
 */
function looseFileReader(rootName, reader, rootPath, baseMods) {
    const documentInfo = `<?xml version="1.0" encoding="utf-8"?>
<DocInfo><Dependencies>${baseMods
        .map(name => `<Value>file:${normalizeDependencyRef(name)}</Value>`)
        .join('')}</Dependencies></DocInfo>
`;
    // A folder lists; a single file does not.
    let listing;
    const folderFiles = () => (listing ??= reader.list(rootPath).then(files => files, () => undefined));
    /** Files served, by their path relative to the loose root. */
    const files = async () => (await folderFiles()) ?? [lastSegment(rootPath)];
    const inner = (filePath) => {
        const normalized = trim(filePath);
        if (normalized.toLowerCase() === rootName.toLowerCase())
            return '';
        const prefix = `${rootName.toLowerCase()}/`;
        return normalized.toLowerCase().startsWith(prefix) ? normalized.slice(prefix.length) : undefined;
    };
    /** The reader's path behind a relative path, or undefined when the root does not serve it. */
    const sourceFileOf = async (relative) => {
        const wanted = relative.toLowerCase();
        const hit = (await files()).find(file => file.toLowerCase() === wanted);
        if (hit === undefined)
            return undefined;
        return (await folderFiles()) === undefined ? rootPath : `${forward(rootPath)}/${hit}`;
    };
    const read = async (filePath) => {
        const relative = inner(filePath);
        if (relative === 'DocumentInfo')
            return new TextEncoder().encode(documentInfo);
        const file = relative === undefined ? undefined : await sourceFileOf(relative);
        if (file === undefined)
            throw new Error(`${filePath} is not part of ${rootName}`);
        return reader.get(file);
    };
    return {
        list: async (filePath) => {
            const relative = inner(filePath);
            if (relative === undefined)
                return [];
            const start = relative === '' ? '' : `${relative.toLowerCase()}/`;
            return (await files())
                .filter(file => file.toLowerCase().startsWith(start))
                .map(file => file.slice(start.length));
        },
        get: read,
        getText: async (filePath) => new TextDecoder().decode(await read(filePath)),
        exists: async (filePath) => {
            const relative = inner(filePath);
            if (relative === undefined)
                return false;
            return relative === '' || relative === 'DocumentInfo' || (await sourceFileOf(relative)) !== undefined;
        },
    };
}
/** A path as a lookup key: forward slashes, no trailing slash, lower-case. */
function pathKey(p) {
    return forward(p).toLowerCase();
}
/** A host path with forward slashes and no trailing slash. */
function forward(p) {
    return p.replace(/\\/g, '/').replace(/\/+$/, '');
}
function normalizeDependencyRef(ref) {
    return ref
        .replace(/^[a-z][a-z0-9+.-]*:/i, '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '');
}
/** The last path segment of a reference — the package name. */
function depName(ref) {
    const normalized = normalizeDependencyRef(ref);
    return normalized.slice(normalized.lastIndexOf('/') + 1);
}
function dependencyRef(ref) {
    const normalized = normalizeDependencyRef(ref);
    return { name: depName(normalized), ref: normalized };
}
/** The `file:` dependency references of a DocumentInfo. */
function docInfoDepRefs(xml, publishedDependencies) {
    const out = [];
    const dependencies = publishedDependencies &&
        xml.match(/<Dependencies(?:\s[^>]*)?>([\s\S]*?)<\/Dependencies>/iu)?.[1];
    const hasPublished = dependencies && /<Value>\s*bnet:[^<]+\/\d+\.\d+\/\d+\s*<\/Value>/iu.test(dependencies);
    for (const m of (hasPublished ? dependencies : xml).matchAll(/<Value>([^<]+)<\/Value>/g)) {
        const val = m[1]?.trim();
        if (!val)
            continue;
        const idx = val.lastIndexOf('file:');
        if (idx !== -1)
            out.push(dependencyRef(val.slice(idx + 5)));
        else if (hasPublished && /^bnet:.+\/\d+\.\d+\/\d+$/iu.test(val)) {
            const local = publishedDependencies.get(val);
            out.push(local ? dependencyRef(local) : { name: val, missingPublication: true });
        }
    }
    return out;
}
/** One shared promise per key; a failed one is dropped so the next caller retries. */
function memo(cache, key, start) {
    const existing = cache.get(key);
    if (existing)
        return existing;
    const promise = start();
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
    return promise;
}
async function exists(p) {
    return fs.access(p).then(() => true, () => false);
}
async function isDir(p) {
    return fs.stat(p).then(s => s.isDirectory(), () => false);
}
/** Resolves and caches packages' chains and layer listings over the host's content sources. */
export class ModContextManager {
    contentSources;
    hostFolder;
    addOnSources;
    env;
    envKey = '';
    resolved = new Map();
    /** Layer listings by VFS path: a layer is listed once however many chains share it. */
    layerFiles = new Map();
    constructor(
    /** Read on every resolve: a source added in the host is seen by the next one. */
    contentSources, 
    /** A host folder as a content source, packed packages in it read as folders. */
    hostFolder, 
    /** Sources the editor loads whatever is open (wizard folders): a layer of every chain. */
    addOnSources = () => new Map(), publishedDependencies) {
        this.contentSources = contentSources;
        this.hostFolder = hostFolder;
        this.addOnSources = addOnSources;
        this.publishedDependencies = publishedDependencies;
    }
    /** The file system over the current content sources; rebuilt, dropping every cache, when they change. */
    environment() {
        const storages = this.contentSources();
        const addOns = this.addOnSources();
        const key = [...storages.keys(), '|', ...addOns.keys()].join('\n');
        if (this.env !== undefined && key === this.envKey)
            return this.env;
        const previous = this.env;
        this.invalidate();
        this.envKey = key;
        this.env = (async () => {
            await previous?.then(env => env.vfs.close()).catch(() => { });
            const vfs = new VirtualFileSystem();
            const resolvers = [];
            const sources = [];
            for (const storage of storages.values()) {
                const protocol = `content-source${sources.length}:`;
                const reader = new ContentSourceReader(storage);
                vfs.register(protocol, reader);
                resolvers.push(contentSourceResolver(protocol, reader, storage.id));
                sources.push({ id: storage.id, protocol, addOn: false });
            }
            for (const storage of addOns.values()) {
                const protocol = `add-on${sources.length}:`;
                vfs.register(protocol, new ContentSourceReader(storage));
                sources.push({ id: storage.id, protocol, addOn: true });
            }
            const resolver = new ModResolver({ sources: resolvers });
            return { vfs, resolver, sources, hostFolders: new Map(), roots: new Map(), serial: 0 };
        })();
        return this.env;
    }
    /** Where a layer this manager resolved lives. */
    async sourceOf(layer) {
        const env = await this.environment();
        const protocol = layer.slice(0, layer.indexOf(':') + 1).toLowerCase();
        const rest = trim(layer.slice(protocol.length));
        const source = env.sources.find(item => item.protocol === protocol);
        if (source !== undefined)
            return { id: source.id, path: rest, ...(source.addOn ? { addOn: true } : {}) };
        const root = env.roots.get(protocol);
        if (root === undefined)
            throw new Error(`${layer} is not a layer this loader resolved`);
        return { id: root.id, path: root.exact || rest === '' ? root.path : `${root.path}/${rest}` };
    }
    /** Forget resolved chains and listings (after a package changed on disk). */
    invalidate() {
        this.resolved.clear();
        this.layerFiles.clear();
    }
    async dispose() {
        const current = this.env;
        this.env = undefined;
        this.envKey = '';
        this.invalidate();
        await current?.then(env => env.vfs.close()).catch(() => { });
    }
    /**
     * Walk up from a file to the nearest enclosing package directory: a `.SC2Mod`/`.SC2Map`/
     * `.SC2Campaign` folder, or one with `ComponentList.SC2Components`/`DocumentInfo`. A folder that
     * only holds `GameData`/`Base.SC2Data` counts when nothing stronger encloses it (an unpacked mod
     * without marker files) — taken eagerly it would stop at `Base.SC2Data` itself.
     */
    async findModRoot(filePath) {
        let dir = path.dirname(filePath);
        let fallback;
        for (let i = 0; i < 64; i++) {
            if (MOD_ROOT_RE.test(path.basename(dir)))
                return dir;
            if (await exists(path.join(dir, 'ComponentList.SC2Components')))
                return dir;
            if (await exists(path.join(dir, 'DocumentInfo')))
                return dir;
            if (fallback === undefined &&
                ((await isDir(path.join(dir, 'GameData'))) || (await isDir(path.join(dir, 'Base.SC2Data'))))) {
                fallback = dir;
            }
            const parent = path.dirname(dir);
            if (parent === dir)
                break;
            dir = parent;
        }
        return fallback;
    }
    /** The chain of the package at `hostPath` — a folder, or a packed file read as one. */
    resolve(hostPath) {
        return memo(this.resolved, pathKey(hostPath), async () => {
            const env = await this.environment();
            const folder = forward(path.dirname(hostPath));
            let protocol = env.hostFolders.get(folder.toLowerCase());
            if (protocol === undefined) {
                protocol = `host${env.serial++}:`;
                env.vfs.register(protocol, new ContentSourceReader(this.hostFolder(path.dirname(hostPath))));
                env.hostFolders.set(folder.toLowerCase(), protocol);
                env.roots.set(protocol, { id: HOST_SOURCE_ID, path: folder, exact: false });
            }
            return this.resolveChain(env, `${protocol}${path.basename(hostPath)}`);
        });
    }
    /**
     * The chain of a file or folder that belongs to no package, read as though it lived inside
     * `baseMods` — a trigger script, a Galaxy script or a model opened on its own. It becomes the
     * primary layer of a package that declares nothing but those bases, so its chain resolves as any
     * other package's; the bases are recorded as chosen by a setting. `preset` are layers the subject
     * itself depends on (a replay's archives), resolved beneath it before anything it declares.
     */
    resolveLoose(hostPath, baseMods, preset) {
        return this.looseChain(`host:${pathKey(hostPath)}`, { id: HOST_SOURCE_ID, path: forward(hostPath) }, () => new FsReader(), hostPath, baseMods, preset);
    }
    /**
     * The chain of a path inside one of the content sources: the package the path is in (its first
     * `.SC2Mod`/`.SC2Map`/`.SC2Campaign` segment), else the path as a loose root inside `baseMods`.
     */
    resolveInSource(target, baseMods, preset) {
        const segments = trim(target.path).split('/').filter(Boolean);
        const packageAt = segments.findIndex(segment => MOD_ROOT_RE.test(segment));
        if (packageAt >= 0 && preset === undefined) {
            const root = segments.slice(0, packageAt + 1).join('/');
            return memo(this.resolved, `source:${target.sourceId}|${root.toLowerCase()}`, async () => {
                const env = await this.environment();
                return this.resolveChain(env, `${this.protocolOf(env, target.sourceId)}${root}`);
            });
        }
        return this.environment().then(env => this.looseChain(`source:${target.sourceId}|${segments.join('/').toLowerCase()}`, { id: target.sourceId, path: segments.join('/') }, () => prefixed(env.vfs, this.protocolOf(env, target.sourceId)), segments.join('/'), baseMods, preset));
    }
    protocolOf(env, sourceId) {
        const source = env.sources.find(item => item.id === sourceId && !item.addOn);
        if (source === undefined)
            throw new Error(`no content source '${sourceId}' is configured`);
        return source.protocol;
    }
    looseChain(identity, root, reader, rootPath, baseMods, preset) {
        const key = `loose:${identity}|${baseMods
            .map(name => normalizeDependencyRef(name).toLowerCase())
            .join(',')}|${(preset?.layers ?? []).map(item => `${item.sourceId}:${item.path}`).join(',')}`;
        return memo(this.resolved, key, async () => {
            const env = await this.environment();
            const protocol = `loose${env.serial++}:`;
            const rootName = `${lastSegment(rootPath)}.loose`;
            env.vfs.register(protocol, looseFileReader(rootName, reader(), rootPath, baseMods));
            env.roots.set(protocol, { ...root, exact: true });
            const layers = (preset?.layers ?? []).map(item => ({
                ...item,
                vfsPath: `${this.protocolOf(env, item.sourceId)}${trim(item.path)}`,
            }));
            return this.resolveChain(env, `${protocol}${rootName}`, layers.map(item => item.vfsPath), preset?.unresolved ?? [], new Map(layers.flatMap(item => item.fingerprint === undefined ? [] : [[item.vfsPath.toLowerCase(), item.fingerprint]])));
        });
    }
    /**
     * The flattened chain (deepest first) of the package at `activePath`: first the `preset` layers
     * and what they load, then each declared dependency resolved by the content sources in order —
     * its path-qualified reference, then its name — and, last, next to the package that declares it
     * (a mod collection folder keeps its parts side by side). Unresolved dependencies are recorded
     * and skipped. Core, the implicit base of everything, is prepended when a source holds it; the
     * add-on sources come after the dependencies, beneath the package itself.
     */
    async resolveChain(env, activePath, preset = [], presetUnresolved = [], fingerprints = new Map()) {
        const ordered = [];
        const unresolved = [...presetUnresolved];
        const provenance = new Map();
        const seen = new Set();
        const loose = LOOSE_ROOT.test(activePath);
        const add = (layer, how) => {
            if (ordered.some(p => p.toLowerCase() === layer.toLowerCase()))
                return;
            ordered.push(layer);
            provenance.set(layer.toLowerCase(), how);
        };
        const visit = async (vfsPath) => {
            const key = vfsPath.toLowerCase();
            if (seen.has(key))
                return;
            seen.add(key);
            const slash = vfsPath.lastIndexOf('/');
            const parent = slash >= 0 ? vfsPath.slice(0, slash + 1) : vfsPath.slice(0, vfsPath.indexOf(':') + 1);
            const sibling = async (name) => {
                if (!MOD_ROOT_RE.test(name))
                    return undefined;
                const candidate = `${parent}${name}`;
                return (await env.vfs.exists(candidate).catch(() => false)) ? candidate : undefined;
            };
            for (const { name, ref, implicit, missingPublication } of await this.readDepRefs(env, vfsPath)) {
                const resolved = missingPublication ? undefined :
                    (await env.resolver.resolve(ref)) ?? (await env.resolver.resolve(name)) ?? (await sibling(name));
                if (!resolved) {
                    if (!unresolved.includes(name))
                        unresolved.push(name);
                    continue;
                }
                await visit(resolved);
                add(resolved, loose && vfsPath === activePath ? 'setting' : implicit === true ? 'implicit' : 'declared');
            }
        };
        for (const layer of preset) {
            await visit(layer);
            add(layer, 'declared');
        }
        await visit(activePath);
        const core = await env.resolver.resolve('Mods/Core.SC2Mod');
        if (core &&
            depName(activePath).toLowerCase() !== 'core.sc2mod' &&
            !ordered.some(p => p.toLowerCase() === core.toLowerCase())) {
            ordered.unshift(core);
            provenance.set(core.toLowerCase(), 'implicit');
        }
        for (const source of env.sources)
            if (source.addOn)
                add(source.protocol, 'setting');
        const order = Object.freeze([...ordered, activePath]);
        const inChain = new Set(order.map(pathKey));
        const files = (layer) => {
            const key = pathKey(layer);
            if (!inChain.has(key))
                return Promise.reject(new Error(`${layer} is not a layer of this chain`));
            return memo(this.layerFiles, key, async () => {
                const list = (await env.vfs.list(layer)).sort((left, right) => (left < right ? -1 : 1));
                return Object.freeze({
                    list: Object.freeze(list),
                    byPath: new Map(list.map(file => [file.toLowerCase(), file])),
                });
            });
        };
        return Object.freeze({
            order,
            unresolved: Object.freeze(unresolved),
            layerProvenance: provenance,
            fingerprints,
            files,
            read: async (layer, filePath) => {
                const listed = (await files(layer)).byPath.get(filePath.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase());
                return listed === undefined ? undefined : env.vfs.get(`${layer.replace(/\/+$/, '')}/${listed}`);
            },
        });
    }
    /** A package's declared dependencies, and the engine's implicit layering for Blizzard's packages. */
    async readDepRefs(env, vfsPath) {
        const base = vfsPath.replace(/\/+$/, '');
        const declared = [];
        try {
            declared.push(...docInfoDepRefs(await env.vfs.getText(`${base}/DocumentInfo`), this.publishedDependencies));
        }
        catch {
            /* no DocumentInfo */
        }
        if (declared.length === 0) {
            try {
                const text = await env.vfs.getText(`${base}/ComponentList.SC2Components`);
                // A real ComponentList declares data components, not dependencies (DocumentInfo does);
                // only the legacy flat-text form lists dependency paths, one per line.
                if (!parseComponentList(text).isXml) {
                    declared.push(...parseSc2ComponentList(text)
                        .filter(line => MOD_ROOT_RE.test(line))
                        .map(dependencyRef));
                }
            }
            catch {
                /* no ComponentList */
            }
        }
        // Blizzard's packages ship no DocumentInfo; the engine layers them (Void → Swarm → Liberty → Core).
        for (const dependency of sc2BuiltinDirectDependencies(base)) {
            const name = depName(dependency).toLowerCase();
            if (!declared.some(d => d.name.toLowerCase() === name)) {
                declared.push({ ...dependencyRef(dependency), implicit: true });
            }
        }
        return declared;
    }
}
//# sourceMappingURL=mod-context.js.map

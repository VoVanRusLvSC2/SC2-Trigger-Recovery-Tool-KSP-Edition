/**
 * StarCraft II's one mod loader, as the host sees it: `openModContext` of `@modkit/vfs`'s
 * `ContentSources`, implemented structurally over {@link ModContextManager}.
 *
 * Every consumer — map worlds, the data and strings languages, triggers, Galaxy, models — loads
 * mods through this and nothing else. A context is:
 *
 *  - the load order (dependencies first, the opened package last), each layer with the content
 *    source it came from and its original path there, and why it is in the chain;
 *  - each layer's file list, and reads gated by it — a path the layer does not list is refused;
 *  - resolved catalog entities by reference, from the Data language's analysis of the chain,
 *    kept here in the host process and never handed over whole.
 *
 * A file that belongs to no package opens inside `baseMods`: the host's setting for that file or
 * folder, or Void when there is none — almost every mod targets Void. A target is a host path (a
 * package, a file in one — also inside a packed package — or a loose file) or a path inside one of
 * the content sources. A replay opens inside the cache archives it names, and the editor's add-on
 * folders (wizards) are a layer of every context.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ModContextManager } from './mod-context.js';
import { buildContextCatalog, catalogKey } from './context-catalog.js';
export const SC2_GAME_ID = 'blizzard/starcraft-2';
/** What a file outside any package is read inside when the host sets nothing. */
export const SC2_DEFAULT_BASE_MODS = Object.freeze(['Mods/Void.SC2Mod']);
const PACKAGE = /\.(sc2mod|sc2map|sc2campaign)$/iu;
const REPLAY = /\.sc2replay$/iu;
/** The largest replay whose archives a context reads out of it. */
const MAXIMUM_REPLAY = 64 * 1024 * 1024;
const MAXIMUM_PAGE = 10_000;
const MAXIMUM_QUERY_REFS = 1024;
/** The references of a `data.entities` query, or a refusal. */
function entityRefs(request) {
    const value = request;
    if (value?.kind !== 'data.entities')
        throw new Error('StarCraft II mod contexts answer only data.entities');
    const refs = value.refs;
    if (!Array.isArray(refs) ||
        refs.length > MAXIMUM_QUERY_REFS ||
        !refs.every(ref => typeof ref?.namespace === 'string' && ref.namespace !== '' &&
            typeof ref?.entityId === 'string' && ref.entityId !== '')) {
        throw new Error(`data.entities needs up to ${MAXIMUM_QUERY_REFS} namespace/entityId references`);
    }
    return refs;
}
const canonical = (value) => value.replace(/\\/gu, '/').replace(/\/+$/u, '');
async function statOf(target) {
    try {
        const info = await fs.stat(target);
        return info.isDirectory() ? 'directory' : info.isFile() ? 'file' : undefined;
    }
    catch {
        return undefined;
    }
}
export function createSc2ModContexts(options) {
    const manager = new ModContextManager(options.sources, options.hostFolder, options.addOns);
    /** One catalog per resolved chain, shared by every context over it. */
    const catalogs = new WeakMap();
    const defaults = options.defaultBaseMods ?? SC2_DEFAULT_BASE_MODS;
    /**
     * Where a host path is: a package (itself, the nearest enclosing root, or the packed package a
     * path inside one names — `C:/Maps/Foo.SC2Map/MapScript.galaxy`), a path inside storage the
     * sources read, or neither (a loose file). A member of a container the sources cannot read — a
     * file inside a `.zip` — is a loose file too: it has no package to name, only its base mods; so
     * is a file not yet saved into an existing folder. A path under nothing that exists is refused.
     */
    const locate = async (target) => {
        const kind = await statOf(target);
        if (kind === undefined) {
            let outer = path.dirname(target);
            while ((await statOf(outer)) === undefined && path.dirname(outer) !== outer)
                outer = path.dirname(outer);
            const outerKind = await statOf(outer);
            if (outerKind === 'file' && PACKAGE.test(path.basename(outer)))
                return { root: outer };
            const source = options.storagePathOf?.(target);
            if (source !== undefined)
                return { source };
            if (outerKind === 'file')
                return { member: true };
            if (outerKind === 'directory' && outer === path.dirname(target)) {
                const root = await manager.findModRoot(target);
                return root === undefined ? { member: true } : { root };
            }
            throw new Error(`${target} does not exist`);
        }
        if (PACKAGE.test(path.basename(target)))
            return { root: target };
        // `findModRoot` starts from a file's folder; a folder target starts from itself.
        const root = await manager.findModRoot(kind === 'directory' ? path.join(target, 'x') : target);
        return root === undefined ? {} : { root };
    };
    /** A replay's archives, when the target is a replay and the game can find them. */
    const replayPreset = async (name, read) => REPLAY.test(name) && options.replayLayers !== undefined ? options.replayLayers(await read()) : undefined;
    /** A path inside one of the sources: its package, a replay inside its archives, or a loose file. */
    const inSource = async (target, baseMods) => {
        const storage = options.sources().get(target.sourceId);
        const preset = await replayPreset(target.path, () => {
            if (storage === undefined)
                throw new Error(`no content source '${target.sourceId}' is configured`);
            return storage.read(canonical(target.path).replace(/^\/+/u, ''), MAXIMUM_REPLAY);
        });
        return manager.resolveInSource(target, preset === undefined ? baseMods : [], preset);
    };
    async function open(request) {
        const target = request?.target;
        if (request?.schemaVersion !== 1 ||
            !((typeof target === 'string' && target !== '') ||
                (typeof target === 'object' && target !== null &&
                    typeof target.sourceId === 'string' && target.sourceId !== '' && typeof target.path === 'string'))) {
            throw new Error('Invalid StarCraft II mod context request');
        }
        const baseMods = request.baseMods ?? defaults;
        let root;
        let resolved;
        if (typeof target === 'string') {
            const located = await locate(target);
            root = located.root;
            if (root !== undefined)
                resolved = await manager.resolve(root);
            else if (located.source !== undefined)
                resolved = await inSource(located.source, baseMods);
            else {
                const preset = located.member === true
                    ? undefined
                    : await replayPreset(target, async () => new Uint8Array(await fs.readFile(target)));
                resolved = await manager.resolveLoose(target, preset === undefined ? baseMods : [], preset);
            }
        }
        else
            resolved = await inSource(target, baseMods);
        const order = resolved.order;
        const layers = await Promise.all(order.map(async (vfsPath, index) => {
            const source = await manager.sourceOf(vfsPath);
            const opened = index === order.length - 1;
            const provenance = opened ? 'opened' : (resolved.layerProvenance.get(vfsPath.toLowerCase()) ?? 'declared');
            const fingerprint = resolved.fingerprints.get(vfsPath.toLowerCase());
            return Object.freeze({
                ...(fingerprint === undefined ? {} : { fingerprint }),
                id: `layer:${index}`,
                displayName: source.path === '' ? source.id : path.posix.basename(source.path),
                sourceId: source.id,
                sourcePath: source.path,
                role: opened ? 'primary' : provenance === 'setting' && source.addOn !== true ? 'base' : 'dependency',
                provenance,
            });
        }));
        const vfsPathOf = (layerId) => {
            const index = layers.findIndex(layer => layer.id === layerId);
            if (index < 0)
                throw new Error(`no layer '${layerId}' in this context`);
            return order[index];
        };
        const listing = async (layerId) => (await resolved.files(vfsPathOf(layerId))).list;
        const readFile = async (layerId, filePath, maxBytes) => {
            const bytes = await resolved.read(vfsPathOf(layerId), filePath);
            if (bytes === undefined)
                throw new Error(`${filePath} is not a file of ${layerId}`);
            if (bytes.byteLength > maxBytes)
                throw new Error(`${filePath} is larger than ${maxBytes} bytes`);
            return bytes;
        };
        const context = {
            schemaVersion: 1,
            gameId: SC2_GAME_ID,
            contextId: JSON.stringify([
                order.map(item => item.toLowerCase()),
                root === undefined
                    ? [
                        typeof target === 'string'
                            ? canonical(target).toLowerCase()
                            : [target.sourceId, canonical(target.path).toLowerCase()],
                        baseMods,
                    ]
                    : [],
                request.locales ?? [],
            ]),
            layers: Object.freeze(layers),
            unresolved: resolved.unresolved,
            diagnostics: Object.freeze(resolved.unresolved.map(name => Object.freeze({
                code: 'blizzard/sc2-dependency-unresolved',
                severity: 'warning',
                message: `${name} is declared but no configured source provides it.`,
            }))),
            async files(layerId, page) {
                const limit = Math.max(1, Math.min(MAXIMUM_PAGE, Math.trunc(page.limit)));
                const listed = await listing(layerId);
                const prefix = page.prefix?.toLowerCase();
                const all = prefix ? listed.filter(file => file.toLowerCase().startsWith(prefix)) : listed;
                const start = page.cursor === undefined ? 0 : Number(page.cursor);
                if (!Number.isSafeInteger(start) || start < 0)
                    throw new Error('Invalid mod context cursor');
                const items = all.slice(start, start + limit);
                return Object.freeze({
                    items,
                    ...(start + items.length < all.length ? { nextCursor: String(start + items.length) } : {}),
                });
            },
            read: readFile,
            async locate(filePath) {
                const relative = canonical(filePath).replace(/^\/+/u, '').toLowerCase();
                for (let index = order.length - 1; index >= 0; index -= 1) {
                    const listed = (await resolved.files(order[index])).byPath.get(relative);
                    if (listed !== undefined)
                        return Object.freeze({ layerId: layers[index].id, path: listed });
                }
                return undefined;
            },
            async query(request, signal) {
                const refs = entityRefs(request);
                let catalog = catalogs.get(resolved);
                if (catalog === undefined) {
                    catalog = buildContextCatalog({
                        workspaceId: 'sc2-mod-context',
                        layers,
                        files: listing,
                        read: readFile,
                    });
                    catalogs.set(resolved, catalog);
                    catalog.catch(() => catalogs.delete(resolved));
                }
                const index = await catalog;
                signal?.throwIfAborted();
                return Object.freeze({
                    entities: Object.freeze(refs.flatMap(ref => index.get(catalogKey(ref.namespace, ref.entityId)) ?? [])),
                });
            },
            async dispose() {
                // Chains, listings and catalogs are shared and cached by the manager; a context holds nothing of its own.
            },
        };
        return Object.freeze(context);
    }
    return Object.freeze({
        open,
        /** Drop what is cached for packages that changed on disk. */
        invalidate: () => manager.invalidate(),
        dispose: () => manager.dispose(),
    });
}

/** The resource tree of one loaded mod, calculated over the loader's exact dependency chain. */
import { pathToFileURL } from 'node:url';
import { gameDataNamespaceSummaries, isSemanticModEntry, SC2ModReader } from '../../../shared/core/index.js';
import { parseLayout } from '../../../../layout/shared/layout-engine/sc2-layout-core/simple-parse/index.js';
import { MOD_DOCUMENT_ROUTES } from '../../../shared/core/document-routes.js';
import { modResourceTree } from './mod-card.js';
const MAX_TEXT_BYTES = 32 * 1024 * 1024;
const layoutFile = (path) => /\.sc2layout$/iu.test(path);
/** A layer's address, as the loader opens it: a folder on disk by its URL, else in its content source. */
export function layerRoot(layer) {
    const uri = layer.sourceId === 'host'
        ? pathToFileURL(layer.sourcePath).href
        : `modkit-source://battlenet/${[layer.sourceId, ...layer.sourcePath.split('/')]
            .map(encodeURIComponent).join('/')}`;
    return { id: uri, uri };
}
/**
 * A mod chain read into one canonical SC2 mod, dependencies first: the catalog-engine view of the
 * layers the loader resolved. `lists` holds each layer's listed files in `order`.
 */
export async function readChainMod(order, lists, readFile, cache) {
    const byBase = new Map(order.map((path, index) => [path.toLowerCase(), index]));
    const bytes = cache.bytes;
    const entryPath = (base, path) => `${base.toLowerCase()}/${path.toLowerCase()}`;
    const read = (base, path) => {
        const key = entryPath(base, path);
        const known = bytes.get(key);
        if (known !== undefined)
            return known;
        const opening = readFile(base, path).then(value => {
            if (value === undefined)
                throw new Error(`missing mod resource ${base}/${path}`);
            if (value.byteLength > MAX_TEXT_BYTES)
                throw new RangeError(`mod resource is too large: ${path}`);
            return value;
        }).catch(error => {
            bytes.delete(key);
            throw error;
        });
        bytes.set(key, opening);
        return opening;
    };
    const split = (fullPath) => {
        const found = [...order].reverse().find(base => fullPath.toLowerCase().startsWith(`${base.toLowerCase()}/`));
        if (found === undefined)
            throw new Error(`unknown mod resource ${fullPath}`);
        return { base: found, path: fullPath.slice(found.length + 1) };
    };
    // CASC may list languages whose encoding keys are not installed locally. Keep every readable
    // semantic file and let the canonical reader merge those; one optional locale cannot hide a mod.
    const available = order.map(() => []);
    for (let index = 0; index < order.length; index += 1) {
        const base = order[index];
        const candidates = (lists[index] ?? []).filter(isSemanticModEntry);
        for (let start = 0; start < candidates.length; start += 8) {
            const batch = candidates.slice(start, start + 8);
            const results = await Promise.all(batch.map(async (path) => read(base, path).then(() => path, () => undefined)));
            for (const path of results)
                if (path !== undefined)
                    available[index].push(path);
        }
    }
    const reader = new SC2ModReader({
        vfs: {
            async list(base) {
                return [...(available[byBase.get(base.toLowerCase()) ?? -1] ?? [])];
            },
            async get(fullPath) {
                const { base, path } = split(fullPath);
                return read(base, path);
            },
            async getText(fullPath) {
                return new TextDecoder().decode(await this.get(fullPath));
            },
            async exists(fullPath) {
                if (byBase.has(fullPath.toLowerCase()))
                    return true;
                const { base, path } = split(fullPath);
                const index = byBase.get(base.toLowerCase()) ?? -1;
                return available[index]?.some(item => item.toLowerCase() === path.toLowerCase()) ?? false;
            },
        },
        includeOpaqueFile: isSemanticModEntry,
        listFiles: base => available[byBase.get(base.toLowerCase()) ?? -1],
        modParseCache: cache.parsed,
    });
    const mod = await reader.read(order.at(-1), { deps: order.slice(0, -1) });
    return { mod, available, read };
}
export async function effectiveModResourceTree(resolved, layers, revision, cache, locale) {
    const order = resolved.order;
    const listings = await Promise.all(order.map(path => resolved.files(path)));
    const byBase = new Map(order.map((path, index) => [path.toLowerCase(), index]));
    const { mod, available, read } = await readChainMod(order, listings.map(listing => listing.list), (base, path) => resolved.read(base, path), cache);
    // One path denotes the last layer that supplies it. The winning bytes and source travel
    // together, so a click opens the declaration that supplied the effective value.
    const winners = new Map();
    for (let index = 0; index < order.length; index += 1) {
        const layer = layers[index];
        if (layer === undefined)
            continue;
        for (const path of available[index] ?? [])
            winners.set(path.toLowerCase(), { path, layer });
    }
    const files = new Map();
    const roots = new Map();
    const selected = [...winners.values()];
    for (let start = 0; start < selected.length; start += 8) {
        const batch = selected.slice(start, start + 8);
        const loaded = await Promise.all(batch.map(async (winner) => {
            const index = layers.indexOf(winner.layer);
            return { winner, bytes: await read(order[index], winner.path) };
        }));
        for (const item of loaded) {
            files.set(item.winner.path, item.bytes);
            roots.set(item.winner.path.toLowerCase(), layerRoot(item.winner.layer));
        }
    }
    const layouts = new Map(mod.layouts);
    for (const [path, value] of files) {
        if (!layoutFile(path) || layouts.has(path))
            continue;
        try {
            layouts.set(path, parseLayout(new TextDecoder().decode(value)));
        }
        catch { /* A broken layout remains visible under Files. */ }
    }
    const primary = layers.at(-1);
    if (primary === undefined)
        throw new Error('resolved mod has no primary layer');
    const root = layerRoot(primary);
    // Files lists every file each layer lists, assets included, not only what the reader loaded.
    const layerFiles = layers.map((layer, index) => ({
        path: layer.sourcePath, root: layerRoot(layer), paths: listings[index]?.list ?? [],
    }));
    const entries = [...files].map(([path, value]) => ({
        path, kind: 'file', size: BigInt(value.byteLength),
    }));
    const layeredSources = [];
    for (let index = 0; index < order.length; index += 1) {
        const layer = layers[index];
        if (layer === undefined)
            continue;
        for (const path of available[index] ?? []) {
            if (!MOD_DOCUMENT_ROUTES.localizedStrings.pathPattern.test(path) &&
                !MOD_DOCUMENT_ROUTES.fontStyles.pathPattern.test(path) &&
                !MOD_DOCUMENT_ROUTES.editorCategories.pathPattern.test(path) &&
                !MOD_DOCUMENT_ROUTES.assetStrings.pathPattern.test(path))
                continue;
            layeredSources.push({ path, bytes: await read(order[index], path), root: layerRoot(layer) });
        }
    }
    return modResourceTree({
        root,
        rootForPath: path => roots.get(path.toLowerCase()) ?? root,
        rootForMod: modPath => {
            const layer = layers[byBase.get(modPath.toLowerCase()) ?? -1];
            return layer === undefined ? undefined : layerRoot(layer);
        },
        revision,
        ...(locale === undefined ? {} : { locale }),
        entries,
        files,
        layeredSources,
        layerFiles,
        dependencies: [],
        dependencyChain: layers.slice(0, -1).map(layer => ({
            path: layer.sourcePath, required: true, basis: layer.provenance,
            // The loader's own address of the package: a folder on disk by its path, else in its source.
            subjectId: layer.sourceId === 'host' ? layer.sourcePath : `content-source://${layer.sourceId}/${layer.sourcePath}`,
        })),
        mod: {
            locales: mod.locales,
            loadOrder: mod.loadOrder,
            layouts,
            fontStyles: mod.fontStyles,
            editorCategories: mod.editorCategories,
            assetAliases: mod.assetAliases,
            malformedCatalogs: mod.malformedCatalogs,
            namespaces: () => mod.namespaces(),
            all: namespace => mod.all(namespace),
            getResolved: (namespace, id) => mod.getResolved(namespace, id),
            structureDefaults: namespace => mod.structureDefaults(namespace),
        },
        namespaces: gameDataNamespaceSummaries(mod),
    });
}
//# sourceMappingURL=effective-tree.js.map
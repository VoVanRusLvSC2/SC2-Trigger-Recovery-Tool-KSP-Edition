/**
 * The dependency TriggerData and Galaxy declarations of one mod, read through the one mod loader.
 *
 * A layer's `LibraryList.xml` names the libraries the editor loads with it, so the list is read
 * from every layer rather than through the context's last-layer-wins `locate`: Liberty's list
 * replaces Core's when a single path is resolved, but the editor loads NativeLib *and* LibertyLib.
 * A Galaxy `include`, in contrast, names one file, and there the last layer rightly wins.
 */
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;
const LIBRARY_LIST = 'Base.SC2Data/TriggerLibs/LibraryList.xml';
/** A library keeps its own extension: `NativeLib.TriggerLib`, but `LibertyLib.SC2Lib`. */
const LIBRARY_EXTENSIONS = ['.SC2Lib', '.TriggerLib'];
const EXTERNAL = /<library\b[^>]*\bexternal="([^"]+)"/giu;
const decoder = new TextDecoder();
export async function readTriggerDependencies(context, options = {}) {
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const locales = options.locales ?? ['enUS'];
    /** A file a layer does not list is not an error here: most layers carry no triggers at all. */
    const text = async (layerId, path) => {
        try {
            return decoder.decode(await context.read(layerId, path, maxBytes));
        }
        catch {
            return undefined;
        }
    };
    const first = async (layerId, paths) => {
        for (const path of paths) {
            const found = await text(layerId, path);
            if (found !== undefined)
                return [path, found];
        }
        return undefined;
    };
    const stringsOf = async (layerId) => (await first(layerId, locales.map(locale => `${locale}.SC2Data/LocalizedData/TriggerStrings.txt`)))?.[1];
    const libraries = [];
    for (const layer of context.layers) {
        const strings = await stringsOf(layer.id);
        const add = (sourcePath, triggerData) => {
            libraries.push({ triggerData, sourcePath, ...(strings === undefined ? {} : { triggerStrings: strings }) });
        };
        // A mod authored in the editor keeps its triggers in the package root, next to its components.
        const own = await text(layer.id, 'Triggers');
        if (own !== undefined)
            add('Triggers', own);
        const list = await text(layer.id, LIBRARY_LIST);
        if (list === undefined)
            continue;
        for (const [, external] of list.matchAll(EXTERNAL)) {
            const base = `Base.SC2Data/${external.replaceAll('\\', '/')}`;
            const found = await first(layer.id, LIBRARY_EXTENSIONS.map(extension => `${base}${extension}`));
            if (found !== undefined)
                add(found[0], found[1]);
        }
    }
    return libraries;
}
const DATA_ROOT = 'Base.SC2Data/';
const NATIVE_DECLARATIONS = ['natives.galaxy', 'natives_missing.galaxy', 'NativeLib_h.galaxy'];
const GAME_DATA = 'Base.SC2Data/TriggerLibs/GameData/';
const INCLUDE = /\binclude\s+"([^"]+)"/gu;
/** A library header sits in the data root of the mod that owns it: `LibLbty_h.galaxy`. */
const LIBRARY_HEADER = /^Base\.SC2Data\/Lib[A-Za-z0-9_]+_h\.galaxy$/iu;
/**
 * The Galaxy declarations a conversion needs: library headers, the natives of the chain, and
 * everything the sources include, followed transitively.
 */
export async function readTriggerDeclarations(context, options = {}) {
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    const declarations = [];
    const seen = new Set();
    /** A path the chain does not hold is not an error: most of these files are optional. */
    const add = async (path) => {
        const key = path.toLowerCase();
        if (seen.has(key))
            return undefined;
        const found = await context.locate(path);
        if (found === undefined)
            return undefined;
        seen.add(key);
        const text = decoder.decode(await context.read(found.layerId, found.path, maxBytes));
        declarations.push({ fileName: found.path, text });
        return text;
    };
    const listed = async (layerId, prefix) => {
        const items = [];
        let cursor;
        do {
            const page = await context.files(layerId, { limit: 10_000, prefix, ...(cursor === undefined ? {} : { cursor }) });
            items.push(...page.items);
            cursor = page.nextCursor;
        } while (cursor !== undefined);
        return items;
    };
    for (const layer of context.layers) {
        for (const file of await listed(layer.id, DATA_ROOT)) {
            if (LIBRARY_HEADER.test(file))
                await add(file);
        }
    }
    const pending = (options.sources ?? []).flatMap(source => [...source.matchAll(INCLUDE)].map(match => match[1]));
    while (pending.length > 0) {
        const include = pending.shift().replaceAll('\\', '/');
        for (const candidate of [`${DATA_ROOT}${include}_h.galaxy`, `${DATA_ROOT}${include}.galaxy`]) {
            const text = await add(candidate);
            if (text !== undefined)
                pending.push(...[...text.matchAll(INCLUDE)].map(match => match[1]));
        }
    }
    for (const name of NATIVE_DECLARATIONS)
        await add(`${DATA_ROOT}TriggerLibs/${name}`);
    // The generated GameData declarations are one logical unit, and the converter takes whole files.
    const parts = [];
    for (const layer of context.layers) {
        for (const file of (await listed(layer.id, GAME_DATA)).sort()) {
            if (!file.toLowerCase().endsWith('.galaxy'))
                continue;
            parts.push(decoder.decode(await context.read(layer.id, file, maxBytes)));
        }
    }
    if (parts.length > 0)
        declarations.push({ fileName: `${GAME_DATA}*.galaxy`, text: parts.join('\n') });
    return declarations;
}

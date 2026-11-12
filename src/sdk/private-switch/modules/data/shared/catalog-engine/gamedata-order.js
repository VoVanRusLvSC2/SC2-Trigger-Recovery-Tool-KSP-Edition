/**
 * Canonical per-mount ordering for SC2 GameData XML files.
 *
 * This is the same ordering used by `SC2ModReader`: schema/editor order for standard flat
 * catalogs, then remaining flat XML files, then the nested paths declared by GameData.xml.
 * Keeping the path calculation public lets resolver-backed semantic codecs consume exactly the
 * reader's ordering instead of guessing from VFS enumeration order.
 */
import { DATA_CLASS_SCHEMA } from "./sc2-schema/index.js";
import { parseCatalogXmlElements } from "./xml/parser.js";
/**
 * The catalogs a package's `Base.SC2Data/GameData.xml` declares (`<Includes><Catalog path=…/>`),
 * relative to `Base.SC2Data` and in declared order. Beyond the standard catalog files the game loads
 * a package's catalogs only through this list: Liberty declares CollectionSkin, SC2Events and its
 * WarChest seasons here, and a flat file nobody declares is not a catalog of the game.
 */
export function gameDataIncludePaths(text) {
    const paths = [];
    for (const root of parseCatalogXmlElements(text))
        for (const element of root.children) {
            const path = element.name === 'Catalog' ? element.attributes['path'] : undefined;
            if (path !== undefined && path !== '')
                paths.push(path.replaceAll('\\', '/').replace(/^\/+/u, ''));
        }
    return paths;
}
export async function orderGameDataFilePaths(allFiles, readText) {
    const byLower = new Map();
    for (const file of allFiles)
        byLower.set(file.toLowerCase(), file);
    const actual = (relativePath) => byLower.get(relativePath.toLowerCase());
    const hasBase = [...byLower.keys()].some(key => key.startsWith('base.sc2data/'));
    const prefix = hasBase ? 'Base.SC2Data/' : '';
    const ordered = [];
    const seen = new Set();
    const add = (relativePath) => {
        if (relativePath === undefined)
            return;
        const key = relativePath.toLowerCase();
        if (seen.has(key))
            return;
        seen.add(key);
        ordered.push(relativePath);
    };
    for (const typeId of Object.keys(DATA_CLASS_SCHEMA)) {
        const namespace = typeId.startsWith('C') ? typeId.slice(1) : typeId;
        add(actual(`${prefix}GameData/${namespace}Data.xml`));
    }
    const flatPattern = new RegExp(`^${hasBase ? 'base\\.sc2data/' : ''}gamedata/[^/]+\\.xml$`, 'i');
    for (const file of allFiles)
        if (flatPattern.test(file))
            add(file);
    const manifest = actual(`${prefix}GameData.xml`);
    if (manifest !== undefined) {
        const text = await readText(manifest);
        if (text !== undefined) {
            for (const path of gameDataIncludePaths(text))
                add(actual(`${prefix}${path}`));
        }
    }
    if (ordered.length === 0) {
        const fallbackPattern = /(?:^|\/)gamedata\/[^/]+\.xml$/i;
        for (const file of allFiles)
            if (fallbackPattern.test(file))
                add(file);
    }
    return ordered;
}
//# sourceMappingURL=gamedata-order.js.map
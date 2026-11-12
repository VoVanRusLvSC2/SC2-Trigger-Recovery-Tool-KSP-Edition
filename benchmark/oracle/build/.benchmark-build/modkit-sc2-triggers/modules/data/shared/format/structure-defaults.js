/**
 * Root-level SC2 structure defaults (`<SCost>…</SCost>` beside the entities of a catalog file).
 *
 * Kept apart from the document loader so every catalog loader — the GameData codec and the MK2
 * `SC2ModReader` chain loader — extracts and applies them the same way. The game rules themselves
 * live in `services/catalog/struct-defaults.js`, shared with the resolved-data provider.
 */
import { parseCatalogXml } from '../catalog-engine/xml/index.js';
import { scanXml } from './language/xml-scan.js';
import { applyStarcraft2StructureDefaults, isStarcraft2StructureDefaultTag, mergeStructureDefault, starcraft2StructureDefaultNamespace, } from '../../services/catalog/struct-defaults.js';
/** Root-level structure defaults of a catalog file, in document order. */
export function catalogStructureDefaults(text) {
    if (!/<S[A-Z]/u.test(text))
        return [];
    const catalog = scanXml(text).find(element => element.tag === 'Catalog');
    return (catalog?.children ?? [])
        .filter((element) => isStarcraft2StructureDefaultTag(element.tag))
        .map(element => {
        const source = text.slice(element.start, element.end);
        // The catalog parser only accepts `C…` entry tags, so parse the element under a stand-in
        // entry name; the field conversion stays the parser's own.
        const alias = `CX${element.tag}`;
        const opening = `<${alias}${source.slice(element.tag.length + 1)}`;
        const closing = `</${element.tag}>`;
        const renamed = opening.endsWith(closing)
            ? `${opening.slice(0, -closing.length)}</${alias}>`
            : opening;
        const parsed = parseCatalogXml(`<Catalog>${renamed}</Catalog>`);
        return {
            structureType: element.tag,
            text: source,
            fields: parsed.entries.get(alias)?.[0]?.fields ?? {},
        };
    });
}
/**
 * Structure defaults of one catalog file bound to their namespace (`AbilData.xml` → `Abil`, else
 * the namespace of the file's first entity class). Files naming no catalog yield nothing.
 */
export function catalogStructureDefaultEntries(text, path, rootTypes) {
    const defaults = catalogStructureDefaults(text);
    if (defaults.length === 0)
        return [];
    const namespace = starcraft2StructureDefaultNamespace(path, rootTypes);
    if (namespace === undefined)
        return [];
    return defaults.map(item => ({ namespace, structureType: item.structureType, fields: item.fields }));
}
/** SC2 structure-default rules for `TypedCatalog`. */
export const STARCRAFT2_STRUCTURE_DEFAULT_RULES = {
    merge: (previous, next) => mergeStructureDefault(previous, next),
    apply: (typeId, entityId, fields, defaultsFor) => applyStarcraft2StructureDefaults(typeId, entityId, fields, defaultsFor),
};

/**
 * exportWikiData — produce the witrina JSON consumed by `coding/website/wiki`
 * (`data.v3/<Mod>/data.json`):
 *
 *   {
 *     "Data.Unit":  { "Marine": { …typedFields… }, … },
 *     "Data.Abil":  { … }, …                       // one key per namespace
 *     "Const.Unit": { … }, …                       // CConst entities grouped by target ns
 *     "Mod":        { "locales": ["deDE","enUS", …] }
 *   }
 *
 * Field values are resolved (parent chain merged) and coerced to numbers / bools /
 * flag-objects / record-objects by `coerceBySchema` against the structure-types
 * schema. Empty / default-absent fields are pruned.
 */
import { resolveEntityTyped, substituteTokens, buildTokenMap, catalogConstantNamespace, } from '../../catalog-engine/sc2-catalog/index.js';
import { DATA_CLASS_SCHEMA, NAMESPACE_CLASS_MAP } from '../../catalog-engine/sc2-schema/index.js';
import { coerceBySchema } from './coerce.js';
/** Canonical SC2 locale id: "dede" → "deDE", "zhcn" → "zhCN". */
function canonicalLocale(code) {
    const lc = code.toLowerCase();
    if (lc.length === 4)
        return lc.slice(0, 2) + lc.slice(2).toUpperCase();
    return code;
}
/** Default (base) class for a namespace — entities of this class omit the `class` field. */
function defaultClass(ns) {
    return NAMESPACE_CLASS_MAP[ns]?.[0];
}
function mergedSchema(cls) {
    if (typeof cls !== 'function')
        return {};
    const c = cls;
    return (typeof c.getMergedSchema === 'function' ? c.getMergedSchema() : c.schema) ?? {};
}
/** Per-mod Const token map (`<CConst id="X" value="…">` → `##X##`), built once. */
const constTokenMaps = new WeakMap();
/**
 * Token map for one entity, mirroring `TypedCatalog.getResolved`'s stack:
 * mod-level Const tokens; `<?token id=… value=…?>` declarations along the
 * PARENT chain (leaf overrides root — SC2 actor/sound templating, e.g.
 * `GenericUnitMinimal` declares `unitName` and references `##unitName##`);
 * a like-named plain field/attribute on the entity supplies/overrides the
 * declared token's value; and the built-in `##id##`. `resolveEntityTyped`
 * does NOT substitute tokens, so the wiki does it here — otherwise cards
 * show literal `##id##` in field values and string keys like
 * `Button/Tooltip/##id##` never resolve, and every template-parented actor
 * keeps unsubstituted `##unitName##` links.
 */
function entityTokens(entity, mod, resolvedFields) {
    let base = constTokenMaps.get(mod);
    if (!base) {
        base = buildTokenMap(mod.all('Const'));
        constTokenMaps.set(mod, base);
    }
    const map = new Map(base);
    const chain = [];
    const guard = new Set();
    let cursor = entity;
    while (cursor !== undefined && !guard.has(cursor.id)) {
        guard.add(cursor.id);
        chain.unshift(cursor);
        cursor = cursor.parent !== undefined ? mod.get(entity.namespace, cursor.parent) : undefined;
    }
    for (const link of chain) {
        for (const t of link.tokens ?? []) {
            if (t.value !== undefined)
                map.set(t.id, t.value);
        }
    }
    for (const link of chain) {
        for (const t of link.tokens ?? []) {
            const supplied = resolvedFields[t.id];
            if (typeof supplied === 'string')
                map.set(t.id, supplied);
        }
    }
    map.set('id', entity.id);
    return map;
}
/** Coerce one entity's resolved data into the typed wiki object. */
export function coerceEntity(entity, mod) {
    const lookup = (ns, id) => mod.get(ns, id);
    const resolved = resolveEntityTyped(entity, lookup);
    const typed = substituteTokens(resolved, entityTokens(entity, mod, resolved));
    const cls = DATA_CLASS_SCHEMA[entity.class];
    const schema = mergedSchema(cls);
    const out = {};
    const def = defaultClass(entity.namespace);
    if (def !== undefined && entity.class !== def)
        out['class'] = entity.class;
    for (const [k, v] of Object.entries(typed)) {
        if (k === 'id' || k === 'class' || k === 'parent' || k === 'default')
            continue;
        const ft = schema[k];
        const coerced = ft !== undefined ? coerceBySchema(v, ft) : coerceBySchema(v, undefined);
        if (coerced === undefined)
            continue;
        if (typeof coerced === 'object' && coerced !== null && Object.keys(coerced).length === 0)
            continue;
        if (Array.isArray(coerced) && coerced.length === 0)
            continue;
        out[k] = coerced;
    }
    return out;
}
function coerceConst(entity) {
    const data = entity.data;
    const out = {};
    if (typeof data['path'] === 'string')
        out['path'] = data['path'];
    if (typeof data['type'] === 'string')
        out['type'] = data['type'];
    if (data['value'] !== undefined)
        out['value'] = data['value'];
    // fall back to copying remaining scalar attrs
    for (const [k, v] of Object.entries(data)) {
        if (k in out || k === 'index' || k === 'id' || k === 'class')
            continue;
        if (typeof v === 'string')
            out[k] = v;
    }
    return out;
}
export function exportWikiData(mod, opts = {}) {
    const out = {};
    const namespaces = opts.namespaces ?? mod.namespaces();
    for (const ns of namespaces) {
        if (ns === 'Const')
            continue;
        const bucket = {};
        for (const entity of mod.all(ns)) {
            if (!entity.id)
                continue;
            const coerced = coerceEntity(entity, mod);
            if (Object.keys(coerced).length === 0)
                continue;
            bucket[entity.id] = coerced;
        }
        if (Object.keys(bucket).length > 0)
            out[`Data.${ns}`] = bucket;
    }
    // Const entities grouped by the namespace they target.
    if (namespaces.includes('Const') || opts.namespaces === undefined) {
        const constBuckets = {};
        for (const entity of mod.all('Const')) {
            if (!entity.id)
                continue;
            const ns = catalogConstantNamespace(entity);
            if (!ns)
                continue;
            (constBuckets[ns] ??= {})[entity.id] = coerceConst(entity);
        }
        for (const [ns, bucket] of Object.entries(constBuckets)) {
            if (Object.keys(bucket).length > 0)
                out[`Const.${ns}`] = bucket;
        }
    }
    // Mod metadata.
    const locales = [...mod.locales.keys()].map(canonicalLocale);
    locales.sort((a, b) => a.localeCompare(b));
    out['Mod'] = { locales };
    return out;
}
//# sourceMappingURL=wiki.js.map
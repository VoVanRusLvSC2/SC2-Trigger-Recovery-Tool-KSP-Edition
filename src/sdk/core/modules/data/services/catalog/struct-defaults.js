/**
 * SC2 structure defaults: a root-level `<SCost>…</SCost>` in a catalog file gives every `SCost`
 * value of that catalog's entities its initial fields, e.g. core AbilData.xml
 * `<SCost><Charge Link="Abil/##id##"/></SCost>` versus BehaviorData.xml `Behavior/##id##`.
 * Defaults are the lowest layer: declared and inherited values always win, and `##id##` names the
 * owning entity.
 */
import { resolveStarcraft2SchemaFields, resolveStarcraft2StructureFields, STARCRAFT2_DATA_NAMESPACES, starcraft2NamespaceForType, starcraft2ResolutionField, } from "../schema/full-data-schema.js";
const STRUCTURE_TAG = /^S[A-Z]/u;
const MAX_DEPTH = 32;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isIndexed = value => isRecord(value) && typeof value.index === 'string';
const asList = value => (Array.isArray(value) ? value : [value]);
/** Whether a catalog root element is a structure default (`SCost`) rather than an entity. */
export function isStarcraft2StructureDefaultTag(tag) {
    return STRUCTURE_TAG.test(tag) && resolveStarcraft2StructureFields(tag) !== undefined;
}
/**
 * The catalog a file's structure defaults apply to: `AbilData.xml` → `Abil`, otherwise the
 * namespace of the file's first entity class.
 */
export function starcraft2StructureDefaultNamespace(path, rootTypes) {
    const base = String(path ?? '').split(/[\\/]/u).at(-1) ?? '';
    const named = /^(.+)Data\.xml$/iu.exec(base)?.[1];
    const known = STARCRAFT2_DATA_NAMESPACES.find(namespace => namespace.toLowerCase() === named?.toLowerCase());
    if (known !== undefined)
        return known;
    for (const type of rootTypes) {
        const namespace = starcraft2NamespaceForType(type);
        if (namespace !== undefined)
            return namespace;
    }
    return undefined;
}
function mergeRecords(defaults, value) {
    const merged = { ...structuredClone(defaults) };
    for (const [key, item] of Object.entries(value)) {
        merged[key] = key === 'index' ? item : mergeStructureDefault(merged[key], item);
    }
    return merged;
}
/** Deep-merge `value` over the default: records merge per key, `index`-keyed lists per index. */
export function mergeStructureDefault(defaults, value) {
    if (defaults === undefined)
        return value;
    if (value === undefined)
        return structuredClone(defaults);
    if (asList(defaults).every(isIndexed) && asList(value).every(isIndexed)) {
        const merged = asList(defaults).map(item => structuredClone(item));
        for (const item of asList(value)) {
            const at = merged.findIndex(candidate => candidate.index === item.index);
            if (at === -1)
                merged.push(item);
            else
                merged[at] = mergeRecords(merged[at], item);
        }
        return merged.length === 1 && !Array.isArray(value) ? merged[0] : merged;
    }
    // A positional list written with bare elements (`<MuteFadeOut/><MuteFadeOut Time=…/>` in
    // SSoundData) meets `index="1"` in the entity by slot, as catalog inheritance does.
    const items = [...asList(defaults), ...asList(value)];
    if ((Array.isArray(defaults) || Array.isArray(value)) &&
        items.some(item => isRecord(item) && /^\d+$/u.test(String(item.index ?? '')))) {
        const merged = asList(defaults).map(item => structuredClone(item));
        const keys = slotKeys(merged);
        const incoming = asList(value);
        slotKeys(incoming).forEach((key, position) => {
            const item = incoming[position];
            const at = keys.indexOf(key);
            if (at === -1) {
                merged.push(item);
                keys.push(key);
            }
            else
                merged[at] = isRecord(merged[at]) && isRecord(item) ? mergeRecords(merged[at], item) : item;
        });
        return merged;
    }
    if (isRecord(defaults) && isRecord(value))
        return mergeRecords(defaults, value);
    return value;
}
/** SC2 running slots: a bare element takes the next slot, `index="N"` takes slot N. */
function slotKeys(list) {
    let counter = 0;
    return list.map(item => {
        const index = isRecord(item) ? item.index : undefined;
        if (typeof index !== 'string')
            return String(counter++);
        counter = /^\d+$/u.test(index) ? Number(index) + 1 : counter + 1;
        return index;
    });
}
function substituteId(value, entityId) {
    if (typeof value === 'string')
        return value.replaceAll('##id##', entityId);
    if (Array.isArray(value))
        return value.map(item => substituteId(item, entityId));
    if (!isRecord(value))
        return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substituteId(item, entityId)]));
}
function applyToFields(fields, schemaFields, defaultsFor, entityId, wrapsIndexed, depth) {
    if (depth > MAX_DEPTH || !isRecord(fields))
        return fields;
    let result = fields;
    for (const declared of schemaFields) {
        // Resolved-data snapshots carry positional lists as indexed slots.
        const field = wrapsIndexed ? starcraft2ResolutionField(declared) : declared;
        if (field.structureType === undefined)
            continue;
        const defaults = defaultsFor(field.structureType);
        const nested = field.fields ?? resolveStarcraft2StructureFields(field.structureType) ?? [];
        const complete = value => applyToFields(defaults === undefined ? value : mergeStructureDefault(substituteId(defaults, entityId), value), nested, defaultsFor, entityId, wrapsIndexed, depth + 1);
        const current = result[field.fieldId];
        let next = current;
        if (field.cardinality === 'scalar') {
            // Every entity has each scalar structure, so a default materializes an undeclared one.
            if (current !== undefined || defaults !== undefined)
                next = complete(current);
        }
        else if (current !== undefined) {
            // Only existing list elements are structure instances; the default never adds elements.
            const element = item => {
                if (!isRecord(item))
                    return item;
                if (field.cardinality !== 'indexed' || !wrapsIndexed)
                    return complete(item);
                const value = complete(item.value);
                return value === item.value ? item : { ...item, value };
            };
            next = Array.isArray(current) ? current.map(element) : element(current);
        }
        if (next !== current)
            result = { ...result, [field.fieldId]: next };
    }
    return result;
}
/**
 * Apply a catalog's structure defaults to one resolved entity.
 *
 * @param typeId entity class (`CAbilEffectInstant`)
 * @param entityId owning entity id, substituted for `##id##`
 * @param fields resolved fields
 * @param defaultsFor structure type → default value for this entity's catalog
 * @param options.wrapsIndexed indexed list elements carry their struct under `value`
 *   (resolved-data snapshots) instead of beside `index` (legacy catalog RawFields)
 */
export function applyStarcraft2StructureDefaults(typeId, entityId, fields, defaultsFor, options = {}) {
    return applyToFields(fields, resolveStarcraft2SchemaFields(typeId), defaultsFor, entityId, options.wrapsIndexed === true, 0);
}
//# sourceMappingURL=struct-defaults.js.map
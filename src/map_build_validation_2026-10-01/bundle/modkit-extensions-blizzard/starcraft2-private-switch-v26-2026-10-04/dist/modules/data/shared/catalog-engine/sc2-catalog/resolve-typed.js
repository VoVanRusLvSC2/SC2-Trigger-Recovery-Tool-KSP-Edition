/**
 * Schema-typed entity resolution.
 *
 * Mirrors the old-parser's $$resolved pipeline:
 *   1. Walk the parent chain collecting raw data (root → leaf)
 *   2. Merge the chain using schema-driven rules:
 *      - Array fields (schema type is Array literal [Ctor]):
 *          accumulate all items, then resolve indexed arrays by item.index
 *      - CRecord fields ({ index, value }):
 *          merge by word-index key (last-wins per key)
 *      - Struct fields (Ctor with .schema):
 *          recursive deep merge
 *      - Scalars / links / enums / flags:
 *          last-wins (child overrides parent)
 *      - Fields absent from schema:
 *          same as scalar (last-wins) for safety
 *
 * Uses DATA_CLASS_SCHEMA from structure-types for full type coverage (2319 types).
 */
import { DATA_CLASS_SCHEMA } from '../sc2-schema/index.js';
import { buildChain } from './inheritance.js';
/**
 * Resolve a single entity's fields by merging its full parent chain using the
 * structure-types schema. Falls back to last-wins for fields not covered by
 * the schema.
 */
export function resolveEntityTyped(entity, lookup) {
    const chain = buildChain(entity, lookup);
    const cls = DATA_CLASS_SCHEMA[entity.class];
    const classSchema = cls ? getSchema(cls) : {};
    const dataChain = chain.map(e => e.data);
    return mergeChain(dataChain, classSchema);
}
// ─── Schema helpers ───────────────────────────────────────────────────────────
const _schemaCache = new Map();
function getSchema(cls) {
    if (_schemaCache.has(cls))
        return _schemaCache.get(cls);
    const schema = typeof cls.getMergedSchema === 'function'
        ? cls.getMergedSchema()
        : (cls.schema ?? {});
    _schemaCache.set(cls, schema);
    return schema;
}
/** True if the schema type is an Array literal [Ctor] — SC2 array field */
function isArrayType(t) {
    return Array.isArray(t) && t.length === 1;
}
/** True if { index: EEnum, value: Ctor } — CRecord-style word-indexed map */
function isRecordType(t) {
    return (t !== null &&
        typeof t === 'object' &&
        !Array.isArray(t) &&
        'index' in t &&
        'value' in t);
}
/** True if a class constructor with its own .schema — nested struct */
function isStructType(t) {
    return (typeof t === 'function' &&
        !!t.schema &&
        Object.keys(t.schema).length > 0);
}
// ─── Chain merge ─────────────────────────────────────────────────────────────
function mergeChain(chain, classSchema) {
    // Collect the union of all keys across the chain
    const allKeys = new Set();
    for (const data of chain) {
        for (const k of Object.keys(data))
            allKeys.add(k);
    }
    const result = {};
    for (const key of allKeys) {
        const fieldType = classSchema[key];
        const values = chain.map(d => d[key]).filter(v => v !== undefined);
        if (values.length === 0)
            continue;
        result[key] = mergeFieldValues(key, fieldType, values);
    }
    return result;
}
function mergeFieldValues(key, fieldType, values) {
    // --- Array field: [Ctor] ---
    if (isArrayType(fieldType)) {
        // Accumulate all items from every layer, then resolve indexed arrays.
        // Pass the item schema so nested indexed arrays merge by index too.
        const accumulated = flattenToItems(values);
        const inner = fieldType[0];
        return resolveIndexedArray(accumulated, isStructType(inner) ? getSchema(inner) : undefined);
    }
    // --- CRecord field: { index: EEnum, value: Ctor } ---
    // Word-indexed map: accumulate all items across the chain (single objects or
    // arrays of <Field index="Word" .../> items) and resolve by index like arrays.
    if (isRecordType(fieldType)) {
        const inner = fieldType.value;
        return resolveIndexedArray(flattenToItems(values), isStructType(inner) ? getSchema(inner) : undefined);
    }
    // --- Struct field: Ctor with .schema ---
    if (isStructType(fieldType)) {
        const nestedSchema = getSchema(fieldType);
        const objValues = values.filter(v => v !== null && typeof v === 'object' && !Array.isArray(v));
        if (objValues.length === 0)
            return values[values.length - 1];
        return mergeChain(objValues, nestedSchema);
    }
    // --- Flags / indexed collections typed as scalar classes (CFlags etc.) ---
    // Values carrying index attributes accumulate across the chain like indexed
    // arrays (old-parser deep-merges them); plain scalars stay last-wins.
    if (fieldType !== undefined) {
        const looksIndexed = values.some(v => Array.isArray(v)
            ? v.some(it => it !== null && typeof it === 'object' && 'index' in it)
            : (v !== null && typeof v === 'object' && 'index' in v));
        if (looksIndexed) {
            return resolveIndexedArray(flattenToItems(values));
        }
    }
    // --- Scalar / link / enum / flags: last-wins ---
    // --- Unknown (fieldType undefined): mirror old-parser deep() rules:
    //   - all values are arrays     → concat   ([...parent, ...child])
    //   - all values are objects    → deep-merge
    //   - string value OR type mix  → last wins (old-parser: value.constructor===String → target=value)
    if (fieldType === undefined) {
        const first = values[0];
        if (Array.isArray(first)) {
            // Only concat if every value is also an array; otherwise last wins (type mismatch)
            if (values.every(v => Array.isArray(v))) {
                return flattenToItems(values);
            }
            return values[values.length - 1];
        }
        if (first !== null && typeof first === 'object') {
            // Only deep-merge if every value is also a non-array object; otherwise last wins
            if (values.every(v => v !== null && typeof v === 'object' && !Array.isArray(v))) {
                let merged = {};
                for (const v of values) {
                    merged = deepMergeObjects(merged, v);
                }
                return merged;
            }
            return values[values.length - 1];
        }
    }
    return values[values.length - 1];
}
// ─── Array accumulation and resolution ───────────────────────────────────────
/**
 * Flatten accumulated values into a flat list of items.
 * Each value in `values` may be a single item or an array.
 */
function flattenToItems(values) {
    const result = [];
    for (const v of values) {
        if (Array.isArray(v)) {
            for (const item of v)
                result.push(item);
        }
        else {
            result.push(v);
        }
    }
    return result;
}
/**
 * Resolve accumulated array items by their `index` attribute.
 *
 * Mirrors old-parser's resolveArrays algorithm exactly:
 *   - items processed sequentially
 *   - no `index` → append to result (positional)
 *   - numeric `index` → merge into result[n] if that slot exists, else insert at n
 *   - word `index` → find existing slot by index value, merge or append
 *   - `removed` → null the slot (removed from final result)
 *
 * Single-key optimisation: if every resulting item is `{ value: x }`, unwrap
 * to a plain scalar array (mirrors old-parser's [type.value only] path).
 */
function resolveIndexedArray(items, itemSchema) {
    const result = [];
    for (const raw of items) {
        // Scalars (e.g. plain string links) — always positional
        if (typeof raw !== 'object' || raw === null) {
            result.push(raw);
            continue;
        }
        const item = raw;
        const idx = item['index'];
        const removed = Boolean(item['removed']);
        const rest = itemWithout(item, 'index', 'removed');
        if (idx === undefined) {
            // No index → append positional (old-parser: NaN >= 0 === false → push)
            if (!removed)
                result.push(Object.keys(rest).length > 0 ? rest : raw);
            continue;
        }
        const n = Number(idx);
        if (!isNaN(n) && n >= 0) {
            // Numeric index: merge into slot n
            if (removed) {
                result[n] = null;
            }
            else if (result[n] !== null && result[n] !== undefined) {
                // Only deep-merge if existing slot is an object; scalars get replaced
                const existing = result[n];
                result[n] = (typeof existing === 'object' && !Array.isArray(existing))
                    ? mergeItemObjects(existing, rest, itemSchema)
                    : (Object.keys(rest).length === 1 && 'value' in rest ? rest['value'] : rest);
            }
            else {
                result[n] = rest;
            }
        }
        else {
            // Word index: find existing slot by value of 'index' field, merge or append
            const word = String(idx);
            const existingIdx = result.findIndex(r => typeof r === 'object' && r !== null && r['index'] === word);
            if (removed) {
                if (existingIdx >= 0)
                    result[existingIdx] = null;
            }
            else if (existingIdx >= 0) {
                result[existingIdx] = mergeItemObjects(result[existingIdx], rest, itemSchema);
            }
            else {
                result.push({ ...rest, index: word });
            }
        }
    }
    // Preserve sparse numeric slot positions when there are real holes, but compact
    // explicit removed slots out of otherwise dense arrays. An item declared at
    // index 33 keeps its path; an item removed from index 1 of [0,1] disappears.
    // Struct items are resolved recursively (old-parser resolveArrays semantics).
    let hasSparseHoles = false;
    for (let i = 0; i < result.length; i++) {
        if (result[i] === undefined) {
            hasSparseHoles = true;
            break;
        }
    }
    const normalized = Array.from(result, r => r === undefined || r === null
        ? null
        : (itemSchema !== undefined ? resolveStructItem(r, itemSchema) : r));
    const nonNull = normalized.filter(r => r !== null);
    if (nonNull.length === 0)
        return [];
    // Single-key { value: x } optimisation — unwrap to scalar array
    if (nonNull.every(r => typeof r === 'object' && r !== null &&
        Object.keys(r).length === 1 && 'value' in r)) {
        return normalized.map(r => (r === null ? null : r['value']));
    }
    return !hasSparseHoles && normalized.includes(null) ? normalized.filter(r => r !== null) : normalized;
}
function itemWithout(obj, ...keys) {
    const result = {};
    for (const k of Object.keys(obj)) {
        if (!keys.includes(k))
            result[k] = obj[k];
    }
    return result;
}
/**
 * Recursively resolve a struct item's fields: indexed-array / record fields go
 * through resolveIndexedArray (slot positions, removed entries, word indexes),
 * nested structs recurse. Mirrors old-parser's recursive resolveArrays.
 */
function resolveStructItem(item, schema) {
    if (item === null || typeof item !== 'object' || Array.isArray(item))
        return item;
    const o = item;
    const out = {};
    for (const [k, v] of Object.entries(o)) {
        if (v === null || v === undefined) {
            out[k] = v;
            continue;
        }
        const ft = schema[k];
        if (isArrayType(ft) || isRecordType(ft)) {
            const inner = isArrayType(ft) ? ft[0] : ft.value;
            const innerSchema = isStructType(inner) ? getSchema(inner) : undefined;
            out[k] = resolveIndexedArray(flattenToItems([v]), innerSchema);
        }
        else if (isStructType(ft) && typeof v === 'object' && !Array.isArray(v)) {
            out[k] = resolveStructItem(v, getSchema(ft));
        }
        else {
            out[k] = v;
        }
    }
    return out;
}
/**
 * Merge two indexed-array items with schema awareness: fields that the item
 * schema types as indexed arrays / records accumulate and re-resolve by index
 * (so a child's single { index: 8, ... } entry merges into the parent's array
 * instead of replacing it). Other fields use plain deep merge.
 */
function mergeItemObjects(a, b, itemSchema) {
    if (!itemSchema)
        return deepMergeObjects(a, b);
    const result = { ...a };
    for (const [k, v] of Object.entries(b)) {
        const existing = result[k];
        const fieldType = itemSchema[k];
        if (existing !== undefined && existing !== null && (isArrayType(fieldType) || isRecordType(fieldType))) {
            const inner = isArrayType(fieldType) ? fieldType[0] : fieldType.value;
            const accumulated = flattenToItems([existing, v]);
            result[k] = resolveIndexedArray(accumulated, isStructType(inner) ? getSchema(inner) : undefined);
            continue;
        }
        if (existing !== null && typeof existing === 'object' && !Array.isArray(existing) &&
            v !== null && typeof v === 'object' && !Array.isArray(v)) {
            const nestedSchema = isStructType(fieldType) ? getSchema(fieldType) : undefined;
            result[k] = nestedSchema ? mergeItemObjects(existing, v, nestedSchema) : deepMergeObjects(existing, v);
            continue;
        }
        result[k] = v;
    }
    return result;
}
function deepMergeObjects(a, b) {
    const result = { ...a };
    for (const [k, v] of Object.entries(b)) {
        const existing = result[k];
        if (existing !== null && typeof existing === 'object' && !Array.isArray(existing) &&
            v !== null && typeof v === 'object' && !Array.isArray(v)) {
            result[k] = deepMergeObjects(existing, v);
        }
        else {
            result[k] = v;
        }
    }
    return result;
}
//# sourceMappingURL=resolve-typed.js.map
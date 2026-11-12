/**
 * Merge parent fields with child fields using schema-driven array strategies.
 * Child wins on scalar and object conflicts; arrays merge per ArrayMergeStrategy.
 * Used for both inheritance resolution (parent= chain) and within-mod file merging.
 */
export function mergeFields(parent, child, schema) {
    const result = { ...parent };
    for (const [key, childValue] of Object.entries(child)) {
        const field = schema[key];
        const parentValue = result[key];
        if (parentValue === undefined) {
            result[key] = field?.isArray && !Array.isArray(childValue) ? [childValue] : childValue;
            continue;
        }
        if (mergesAsArray(field, parentValue)) {
            // Normalise child to array — XML parser collapses single-element arrays to objects/scalars
            const childArr = Array.isArray(childValue) ? childValue : [childValue];
            const parentArr = Array.isArray(parentValue) ? parentValue : [parentValue];
            result[key] = mergeArrays(parentArr, childArr, field);
        }
        else if (isObj(childValue) && isObj(parentValue)) {
            result[key] = mergeObjects(parentValue, childValue, field?.fields);
        }
        else {
            result[key] = childValue;
        }
    }
    return result;
}
/**
 * Decide whether a field should be merged as an array. Uses the schema when it
 * marks the field as an array; otherwise falls back to the DATA: if the parent
 * value is already an array (repeated XML siblings), inheritance must index-merge
 * it rather than let the child replace the whole array. SC2 actor/sound fields
 * like `On` are not in the builtin schema yet rely on this index merge — e.g. a
 * child overriding `<On index="0" Terms=.../>` must keep the parent's `Send`.
 * Only `arrayMerge: 'replace'` opts out.
 */
function mergesAsArray(field, parentValue) {
    if (field?.arrayMerge === 'replace')
        return false;
    // A single XML child is parsed as an object/scalar, even for a declared array. It still
    // occupies a slot: merging it as a record would overwrite its `index` and lose that slot.
    if (field?.isArray)
        return true;
    if (field === undefined)
        return Array.isArray(parentValue);
    return false;
}
/** Default strategy for arrays the schema doesn't describe: index-merge by `index`. */
const DEFAULT_ARRAY_FIELD = { isArray: true, arrayMerge: 'indexed' };
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
/** `<X index="N" removed="1"/>` (or a bare `<X removed="1"/>`): the slot is deleted. */
export function isTombstone(item) {
    if (!isObj(item))
        return false;
    const removed = item['removed'];
    return removed === '1' || removed === 'true';
}
/**
 * Key of each element under the SC2 running-index rule: a bare element — object or scalar —
 * takes the next slot of its declaration; an explicit numeric `index="N"` takes slot N and sets
 * the counter to N + 1; a named index is its own key and still advances the counter. Arrays keyed
 * by another attribute (`id`) have keys only where that attribute is written.
 */
export function slotKeys(arr, indexAttr) {
    let counter = 0;
    return arr.map(item => {
        const key = isObj(item) ? item[indexAttr] : undefined;
        if (indexAttr !== 'index')
            return typeof key === 'string' ? key : undefined;
        if (typeof key === 'string') {
            counter = /^\d+$/.test(key) ? Number(key) + 1 : counter + 1;
            return key;
        }
        return String(counter++);
    });
}
/**
 * `<X index="N" value="V"/>` with a NUMERIC N is how SC2 spells "the SCALAR element at
 * slot N", so the merged element must be the scalar `V` — keeping it as `{index, value}`
 * leaves callers with a mixed string/object array.
 *
 * The numeric check is load-bearing: id-keyed arrays use the identical two-key shape with
 * a NAME index (`<Attributes index="Light" value="1"/>`), and there the `index` IS the
 * data. Struct-array elements carry other fields and are left alone either way.
 */
function scalarizeIndexed(item) {
    if (!isObj(item))
        return item;
    const obj = item;
    const keys = Object.keys(obj);
    if (keys.length !== 2 || !keys.includes('index') || !keys.includes('value'))
        return item;
    const idx = obj['index'];
    if (typeof idx !== 'string' || !/^\d+$/.test(idx))
        return item;
    return obj['value'];
}
/** A bare object element carries its slot, so later declarations and readers see where it sits. */
function keyed(item, indexAttr, key) {
    if (indexAttr !== 'index' || key === undefined || !isObj(item) || item[indexAttr] !== undefined) {
        return item;
    }
    return { index: key, ...item };
}
/**
 * Each element in the spelling that keeps its slot: bare where the running index puts a bare
 * element in that very slot (`{index: N, value: V}` becomes `V`), `{index, value}` where it would
 * not — after a gap (`CliffHeights` 0, 2, 3 …) or once a removal left one — so no reader, and no
 * later declaration, renumbers what follows.
 */
function settled(items, keys) {
    let counter = 0;
    return items.map((item, position) => {
        const key = keys[position];
        const natural = String(counter);
        const numeric = key !== undefined && /^\d+$/.test(key);
        counter = numeric ? Number(key) + 1 : counter + 1;
        if (!numeric)
            return item;
        if (isObj(item))
            return key === natural ? scalarizeIndexed(item) : item;
        return key === natural ? item : { index: key, value: item };
    });
}
/**
 * Merge one declaration's array onto what the parent (or an earlier declaration of the same
 * entity) built. Elements meet by slot key: a child element replaces or merges into the parent's
 * element with the same key, else it is added — at the end of an `append` array always. A
 * tombstone replaces its slot rather than splicing it, so the slots after it keep their keys for
 * later declarations; resolution drops tombstones once the whole chain is merged
 * ({@link withoutTombstones}).
 */
function mergeArrays(parent, child, field) {
    const f = field ?? DEFAULT_ARRAY_FIELD;
    const strategy = f.arrayMerge ?? 'indexed';
    if (strategy === 'replace')
        return child;
    const indexAttr = strategy === 'append' ? 'index' : f.indexAttr ?? (strategy === 'named' ? 'id' : 'index');
    const keys = slotKeys(parent, indexAttr);
    // Only object items are cloned — string/primitive array elements (e.g. bare EffectArray ids)
    // must NOT be spread (that explodes them into per-character objects).
    const result = parent.map((item, position) => keyed(isObj(item) ? { ...item } : item, indexAttr, keys[position]));
    const childKeys = slotKeys(child, indexAttr);
    child.forEach((childItem, position) => {
        const key = childKeys[position];
        const at = key === undefined ? -1 : keys.indexOf(key);
        if (isTombstone(childItem)) {
            const tombstone = key === undefined ? childItem : { [indexAttr]: key, removed: '1' };
            if (at >= 0)
                result[at] = tombstone;
            else {
                result.push(tombstone);
                keys.push(key);
            }
            return;
        }
        if (strategy === 'append' || at < 0) {
            result.push(keyed(childItem, indexAttr, key));
            keys.push(strategy === 'append' ? undefined : key);
            return;
        }
        const existing = result[at];
        result[at] = isObj(existing) && !isTombstone(existing) && isObj(childItem)
            ? mergeObjects(existing, childItem, f.fields)
            : keyed(childItem, indexAttr, key);
    });
    return indexAttr === 'index' ? settled(result, keys) : result;
}
/** Drop the tombstones a merged chain still carries — the slots they deleted, not data. */
export function withoutTombstones(fields) {
    const strip = (value) => {
        if (Array.isArray(value)) {
            const keys = slotKeys(value, 'index');
            const kept = value.map((item, position) => ({ item, key: keys[position] }))
                .filter(entry => !isTombstone(entry.item));
            return settled(kept.map(entry => strip(entry.item)), kept.map(entry => entry.key));
        }
        if (isObj(value))
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, strip(item)]));
        return value;
    };
    return strip(fields);
}
function mergeObjects(parent, child, fields) {
    const result = { ...parent };
    for (const [key, childValue] of Object.entries(child)) {
        const field = fields?.[key];
        const parentValue = result[key];
        if (parentValue === undefined) {
            result[key] = field?.isArray && !Array.isArray(childValue) ? [childValue] : childValue;
            continue;
        }
        if (mergesAsArray(field, parentValue)) {
            const childArr = Array.isArray(childValue) ? childValue : [childValue];
            const parentArr = Array.isArray(parentValue) ? parentValue : [parentValue];
            result[key] = mergeArrays(parentArr, childArr, field);
        }
        else if (isObj(childValue) && isObj(parentValue)) {
            result[key] = mergeObjects(parentValue, childValue, field?.fields);
        }
        else {
            result[key] = childValue;
        }
    }
    return result;
}
//# sourceMappingURL=merge.js.map
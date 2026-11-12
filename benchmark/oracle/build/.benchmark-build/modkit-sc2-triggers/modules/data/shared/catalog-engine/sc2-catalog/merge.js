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
/**
 * SC2 running-index rule: each element takes the next index in document order;
 * an explicit `index="N"` resets the counter to N. Bare object elements receive
 * their positional index so child slots align with parent slots during merge.
 * Returns the array unchanged when it is not an index-keyed object array.
 */
function withCounterIndices(arr) {
    if (!arr.every(isObj))
        return arr;
    let counter = 0;
    return arr.map(item => {
        const idx = item['index'];
        if (typeof idx === 'string' && /^\d+$/.test(idx)) {
            counter = Number(idx) + 1;
            return item;
        }
        if (idx === undefined) {
            const assigned = { index: String(counter), ...item };
            counter++;
            return assigned;
        }
        counter++; // non-numeric index (id-keyed) — leave as-is
        return item;
    });
}
/**
 * Positional slot of each element under the SC2 running-index rule, for elements that
 * have one. Unlike {@link withCounterIndices} this also covers SCALAR elements, which is
 * what makes an indexed child override work against a plain-valued parent: a parent
 * written as `<X value="A"/><X value="B"/>` parses to `['A','B']` and occupies slots 0
 * and 1, so a child's `<X index="1" value="Z"/>` must REPLACE `'B'`, not append.
 */
function positionalSlots(arr) {
    const map = new Map();
    let counter = 0;
    arr.forEach((item, position) => {
        if (isObj(item)) {
            const idx = item['index'];
            if (typeof idx === 'string' && /^\d+$/.test(idx)) {
                if (!map.has(Number(idx)))
                    map.set(Number(idx), position);
                counter = Number(idx) + 1;
                return;
            }
            if (idx !== undefined)
                return; // id-keyed element: not positional
        }
        if (!map.has(counter))
            map.set(counter, position);
        counter++;
    });
    return map;
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
function mergeArrays(parent, child, field) {
    const f = field ?? DEFAULT_ARRAY_FIELD;
    const strategy = f.arrayMerge ?? 'indexed';
    if (strategy === 'replace')
        return child;
    if (strategy === 'append')
        return [...parent, ...child];
    // indexed or named — merge by a key attribute
    const indexAttr = f.indexAttr ?? (strategy === 'named' ? 'id' : 'index');
    // For numeric-indexed arrays, give bare elements their positional index so a
    // child element aligns with the parent element occupying the same slot.
    const p = indexAttr === 'index' ? withCounterIndices(parent) : parent;
    const c = indexAttr === 'index' ? withCounterIndices(child) : child;
    // Copy parent items; only object items are cloned — string/primitive array
    // elements (e.g. bare EffectArray ids) must NOT be spread (that explodes them
    // into per-character objects).
    const result = p.map(item => isObj(item) ? { ...item } : item);
    const slotPos = indexAttr === 'index' ? positionalSlots(p) : undefined;
    for (const childItem of c) {
        if (typeof childItem !== 'object' || Array.isArray(childItem)) {
            result.push(childItem);
            continue;
        }
        const key = childItem[indexAttr];
        if (typeof key !== 'string') {
            result.push(childItem);
            continue;
        }
        let existingIdx = result.findIndex(item => typeof item === 'object' && !Array.isArray(item) && item[indexAttr] === key);
        // No object carries that key — fall back to the positional slot, which is how an
        // indexed child override finds its element in a scalar-valued parent array.
        if (existingIdx < 0 && slotPos && /^\d+$/.test(key)) {
            existingIdx = slotPos.get(Number(key)) ?? -1;
        }
        if (existingIdx >= 0) {
            const existing = result[existingIdx];
            result[existingIdx] = isObj(existing)
                ? mergeObjects(existing, childItem, f.fields)
                : scalarizeIndexed(childItem);
        }
        else {
            result.push(scalarizeIndexed(childItem));
        }
    }
    return result;
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

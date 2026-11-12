import { mergeFields } from './merge.js';
/**
 * Build parent → child chain for an entity.
 * Returns array ordered root-first (CBase at index 0, entity at last).
 * Stops silently on dangling parent references or cycles.
 */
export function buildChain(entity, lookup) {
    const chain = [];
    const seen = new Set();
    let cur = entity;
    while (cur !== undefined) {
        if (seen.has(cur.id))
            break;
        seen.add(cur.id);
        chain.unshift(cur);
        if (cur.parent !== undefined) {
            cur = lookup(entity.namespace, cur.parent);
        }
        else if (cur.id !== '') {
            // SC2 implicit default: entities without an explicit parent inherit from the default entity (id='')
            cur = lookup(entity.namespace, '');
        }
        else {
            cur = undefined;
        }
    }
    return chain;
}
/**
 * Resolve an entity by merging its full parent chain.
 * Returns merged RawFields from root to leaf (child wins).
 * Result is not cached here — caching is TypedCatalog's responsibility.
 */
export function resolveEntity(entity, lookup, schema) {
    const chain = buildChain(entity, lookup);
    const fields = schema.resolveFields(entity.class);
    let result = {};
    for (const ancestor of chain) {
        result = mergeFields(result, ancestor.data, fields);
    }
    // Normalise: schema array fields that ended up as a non-array value (single XML element)
    // should always be returned as arrays so callers can rely on consistent types.
    for (const [key, field] of Object.entries(fields)) {
        const val = result[key];
        if (field.isArray && val !== undefined && !Array.isArray(val)) {
            result = { ...result, [key]: [val] };
        }
    }
    // Normalise mixed explicit/implicit indices in numeric-indexed arrays.
    // SC2 assigns a running index per element in document order; an explicit
    // `index="N"` sets the counter, so a following bare element continues from N+1
    // (e.g. `<On index="84"/>` then a bare `<On/>` → slot 85). Without this a bare
    // element keeps only its array position, diverging from SC2/old-parser.
    // Data-driven (not schema-gated, since not every array field is in the builtin
    // schema): applied only to arrays that actually MIX numeric-`index` elements
    // with bare object elements — id-keyed (named) and scalar arrays never match.
    for (const [key, val] of Object.entries(result)) {
        if (!Array.isArray(val))
            continue;
        const next = assignSequentialIndices(val);
        if (next !== undefined)
            result = { ...result, [key]: next };
    }
    return result;
}
/**
 * Fill in `index` on bare elements of a numeric-indexed array using the SC2
 * running-counter rule. Returns a new array, or undefined when the array is not
 * a mix of explicit-numeric-index and bare object elements (nothing to do).
 */
function assignSequentialIndices(arr) {
    const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
    let hasExplicit = false;
    let hasBare = false;
    for (const it of arr) {
        if (!isObj(it))
            return undefined; // scalar array — leave as-is
        const idx = it['index'];
        if (typeof idx === 'string' && /^\d+$/.test(idx))
            hasExplicit = true;
        else if (idx === undefined)
            hasBare = true;
        else
            return undefined; // non-numeric index (e.g. id-keyed) — leave as-is
    }
    if (!hasExplicit || !hasBare)
        return undefined;
    let counter = 0;
    return arr.map(it => {
        const o = it;
        const idx = o['index'];
        if (typeof idx === 'string' && /^\d+$/.test(idx)) {
            counter = Number(idx) + 1;
            return it;
        }
        const assigned = { index: String(counter), ...o };
        counter++;
        return assigned;
    });
}

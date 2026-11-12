import { mergeFields, withoutTombstones } from "./merge.js";
/**
 * Build parent → child chain for an entity.
 * Returns array ordered root-first (CBase at index 0, entity at last).
 * Stops silently on dangling parent references or cycles.
 *
 * With `defaultOf` an entity without a parent inherits its own class's template (see
 * `TypedCatalog`); without it, the namespace's merged template (id `''`) as before.
 */
export function buildChain(entity, lookup, defaultOf) {
    const chain = [];
    // By identity: every anonymous template has the id `''`.
    const seen = new Set();
    let cur = entity;
    while (cur !== undefined) {
        if (seen.has(cur))
            break;
        seen.add(cur);
        chain.unshift(cur);
        if (cur.parent !== undefined) {
            cur = lookup(entity.namespace, cur.parent);
        }
        else if (defaultOf !== undefined) {
            cur = defaultOf(cur);
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
export function resolveEntity(entity, lookup, schema, defaultOf, prefixes) {
    const chain = buildChain(entity, lookup, defaultOf);
    const fields = schema.resolveFields(entity.class);
    // A chain prefix merges the same way for every entity below it, so siblings share their
    // ancestors' merge (per leaf class: its schema decides how lists merge). Tombstones stay in a
    // prefix; only the finished chain drops them.
    let start = 0;
    let result = {};
    for (let index = chain.length - 1; index >= 0 && prefixes !== undefined; index -= 1) {
        const cached = prefixes.get(chain[index])?.get(entity.class);
        if (cached !== undefined) {
            result = cached;
            start = index + 1;
            break;
        }
    }
    for (let index = start; index < chain.length; index += 1) {
        const link = chain[index];
        result = mergeFields(result, link.data, fields);
        if (prefixes !== undefined) {
            const byClass = prefixes.get(link) ?? new Map();
            byClass.set(entity.class, result);
            prefixes.set(link, byClass);
        }
    }
    result = withoutTombstones(result);
    // Normalise: schema array fields that ended up as a non-array value (single XML element)
    // should always be returned as arrays so callers can rely on consistent types.
    const wrapped = {};
    for (const [key, val] of Object.entries(result)) {
        if (fields[key]?.isArray === true && !Array.isArray(val))
            wrapped[key] = [val];
    }
    if (Object.keys(wrapped).length > 0)
        result = { ...result, ...wrapped };
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
//# sourceMappingURL=inheritance.js.map
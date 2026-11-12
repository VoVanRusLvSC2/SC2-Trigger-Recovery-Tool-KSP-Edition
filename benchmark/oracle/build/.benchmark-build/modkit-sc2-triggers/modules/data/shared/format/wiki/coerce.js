/**
 * Schema-driven coercion of resolved (structure-typed) catalog data into the
 * wiki JSON representation used by `coding/website/wiki` (`data.v3/<Mod>/data.json`).
 *
 * Input is the OBJECT-form produced by `resolveEntityTyped` (@modkitx/data-processing/sc2-catalog):
 * scalars are raw strings ("45", "-1", "2.25"), indexed collections / flags /
 * records are arrays of `{ value?, index, ... }` items, structs are plain
 * objects, arrays are arrays.
 *
 * Output mirrors the reference witrina exactly:
 *   - numbers       "45" / "-1" / "2.25"            → 45 / -1 / 2.25
 *   - CBoolean      "1" / "0"                        → true / false
 *   - CFlags        [{value:"1",index:"X"}, …]       → { X: true, … }   (false kept)
 *   - CRecord       [{value:"50",index:"Minerals"}]  → { Minerals: 50 } (value coerced by its type)
 *   - CSObject      "ObjectType:Unit,ObjectFamily:Melee" → { ObjectType:"Unit", … }
 *   - struct        { … }                            → recurse field-by-field
 *   - array [Inner] [ … ]                            → recurse per item (index-wrappers kept)
 *   - enum/string/link/file                          → string (unchanged)
 *   - empty ""/{}/[]/undefined                       → pruned
 *
 * Dispatch is by the structure-types CLASS of the schema field, walked alongside
 * the resolved value (the same introspection pattern as @modkitx/ops/rename.ts).
 */
import { CNumber, CBoolean, CScalar, CSObject, CFlags, CRecord, CTuple, CStringArray, CVariator, } from '../../catalog-engine/sc2-schema/index.js';
const SKIP_ITEM_PROPS = new Set(['removed']);
function isClass(v) { return typeof v === 'function'; }
function protoInstanceOf(t, base) {
    return isClass(t) && (t === base || t.prototype instanceof base);
}
/** Array literal schema field: [Inner] */
function isArrayType(t) {
    return Array.isArray(t) && t.length === 1;
}
/** Inline record schema field: { index, value } */
function isRecordSpec(t) {
    return t !== null && typeof t === 'object' && !Array.isArray(t)
        && 'index' in t && 'value' in t;
}
/** Struct class: has a non-empty `.schema` (and is not a tuple/array/flags/record class). */
function structSchemaOf(t) {
    if (!isClass(t))
        return undefined;
    if (protoInstanceOf(t, CTuple) || protoInstanceOf(t, CStringArray)
        || protoInstanceOf(t, CFlags) || protoInstanceOf(t, CRecord) || protoInstanceOf(t, CVariator)) {
        return undefined;
    }
    const merged = typeof t.getMergedSchema === 'function'
        ? t.getMergedSchema()
        : t.schema;
    if (merged && typeof merged === 'object' && Object.keys(merged).length > 0)
        return merged;
    return undefined;
}
/** Unwrap a scalar slot: "X" | { value:"X" } | { Link:"X" } → "X". */
function scalarOf(v) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        const o = v;
        if (typeof o['value'] === 'string' || typeof o['value'] === 'number')
            return o['value'];
        if (typeof o['Link'] === 'string')
            return o['Link'];
    }
    return v;
}
function toNumber(v) {
    const s = scalarOf(v);
    if (s === '' || s === null || s === undefined)
        return undefined;
    const n = Number(s);
    return Number.isNaN(n) ? s : n;
}
function toBool(v) {
    const s = scalarOf(v);
    return !(s === '0' || s === 0 || s === false || s === '' || s === undefined || s === null || s === 'false');
}
/** Numeric word-index → number, otherwise the string. */
function coerceIndex(idx) {
    const s = String(idx);
    return /^-?\d+$/.test(s) ? Number(s) : s;
}
function isEmpty(v) {
    if (v === undefined || v === null || v === '')
        return true;
    if (Array.isArray(v))
        return v.length === 0;
    if (typeof v === 'object')
        return Object.keys(v).length === 0;
    return false;
}
/** Items each carry `index`; flatten any single-object / array / word-keyed-map form into a list. */
function asItemArray(v) {
    if (Array.isArray(v))
        return v.flatMap((it) => asItemArray(it));
    if (v !== null && typeof v === 'object') {
        const o = v;
        // word-keyed map { Key: item | [item] } — attribute-form scalars ("<Resource Minerals=\"50\"/>"
        // parses to { Minerals: "50" }) become { index, value } items, not lost spreads.
        if (!('index' in o) && !('value' in o)) {
            const wrap = (k, it) => it !== null && typeof it === 'object' && !Array.isArray(it) ? { index: k, ...it } : { index: k, value: it };
            const out = [];
            for (const [k, val] of Object.entries(o)) {
                if (Array.isArray(val))
                    for (const it of val)
                        out.push(wrap(k, it));
                else
                    out.push(wrap(k, val));
            }
            return out;
        }
        return [o];
    }
    return [];
}
// ─── flags ─────────────────────────────────────────────────────────────────
function coerceFlags(value) {
    const out = {};
    if (typeof value === 'string') {
        for (const tok of value.split(';').map(s => s.trim()).filter(Boolean)) {
            if (tok.startsWith('-'))
                out[tok.slice(1)] = false;
            else if (tok.startsWith('+'))
                out[tok.slice(1)] = true;
            else
                out[tok] = true;
        }
    }
    else {
        for (const item of asItemArray(value)) {
            if (item === null || typeof item !== 'object')
                continue;
            const o = item;
            if (o['index'] === undefined)
                continue;
            out[String(o['index'])] = toBool(o['value']);
        }
    }
    return isEmpty(out) ? undefined : out;
}
// ─── records ─────────────────────────────────────────────────────────────────
function coerceRecord(value, valueType) {
    const out = {};
    for (const item of asItemArray(value)) {
        if (item === null || typeof item !== 'object')
            continue;
        const o = item;
        const idx = o['index'];
        if (idx === undefined)
            continue;
        const keys = Object.keys(o).filter(k => k !== 'index' && k !== 'removed');
        let coerced;
        if (keys.length === 1 && keys[0] === 'value') {
            coerced = coerceBySchema(o['value'], valueType);
        }
        else {
            const rest = {};
            for (const k of keys)
                rest[k] = o[k];
            coerced = coerceBySchema(rest, valueType);
        }
        if (!isEmpty(coerced))
            out[String(idx)] = coerced;
    }
    return isEmpty(out) ? undefined : out;
}
// ─── arrays ────────────────────────────────────────────────────────────────
function coerceArray(value, inner) {
    const arr = Array.isArray(value) ? value : [value];
    const out = [];
    for (const raw of arr) {
        if (raw === null || raw === undefined) {
            out.push(null);
            continue;
        }
        if (typeof raw === 'object' && !Array.isArray(raw)) {
            const o = raw;
            const keys = Object.keys(o).filter(k => k !== 'removed');
            const isWrapper = 'value' in o && keys.every(k => k === 'value' || k === 'index');
            if (isWrapper) {
                const cv = coerceBySchema(o['value'], inner);
                if ('index' in o)
                    out.push({ index: coerceIndex(o['index']), value: cv });
                else if (!isEmpty(cv))
                    out.push(cv);
                continue;
            }
            // struct item (may carry a sparse numeric index)
            const cv = coerceBySchema(o, inner);
            if (!isEmpty(cv))
                out.push(cv);
            continue;
        }
        const cv = coerceBySchema(raw, inner);
        if (!isEmpty(cv))
            out.push(cv);
    }
    // collapse fully-empty arrays; keep nulls only when meaningful slots remain
    if (out.every(x => x === null))
        return undefined;
    return out;
}
// ─── structs ─────────────────────────────────────────────────────────────────
function coerceStruct(value, schema) {
    // CSObject / saveAsString struct serialized as "K:V,K:V"
    if (typeof value === 'string') {
        // Structs with a scalar default form (SAccumulatedFixed: Amount value="6") serialize
        // as a bare value with no K:V pairs — keep the scalar instead of pruning it.
        if (!value.includes(':'))
            return passthrough(value);
        const out = {};
        for (const pair of value.split(',').map(s => s.trim()).filter(Boolean)) {
            const ci = pair.indexOf(':');
            if (ci < 0)
                continue;
            const k = pair.slice(0, ci).trim();
            const raw = pair.slice(ci + 1).trim();
            const cv = schema[k] !== undefined ? coerceBySchema(raw, schema[k]) : raw;
            if (!isEmpty(cv))
                out[k] = cv;
        }
        return isEmpty(out) ? undefined : out;
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const o = value;
    const out = {};
    for (const [k, v] of Object.entries(o)) {
        if (SKIP_ITEM_PROPS.has(k))
            continue;
        if (k === 'index') {
            out[k] = coerceIndex(v);
            continue;
        }
        const ft = schema[k];
        const cv = ft !== undefined ? coerceBySchema(v, ft) : passthrough(v);
        if (!isEmpty(cv))
            out[k] = cv;
    }
    return isEmpty(out) ? undefined : out;
}
/** Best-effort coercion for fields absent from the schema (mirror old-parser leniency). */
function passthrough(v) {
    const s = scalarOf(v);
    if (typeof s === 'string') {
        if (s === '')
            return undefined;
        if (/^-?\d+(\.\d+)?$/.test(s))
            return Number(s);
        return s;
    }
    return s;
}
// ─── tuples / string-arrays ──────────────────────────────────────────────────
// ─── main dispatch ────────────────────────────────────────────────────────────
export function coerceBySchema(value, type) {
    if (value === undefined || value === null || value === '')
        return undefined;
    // array field: [Inner]
    if (isArrayType(type))
        return coerceArray(value, type[0]);
    // inline record: { index, value }
    if (isRecordSpec(type))
        return coerceRecord(value, type.value);
    if (isClass(type)) {
        // CRecord class (static .value)
        if (protoInstanceOf(type, CRecord) && 'value' in type) {
            return coerceRecord(value, type.value);
        }
        // CFlags (incl. CTargetFilters)
        if (protoInstanceOf(type, CFlags))
            return coerceFlags(value);
        // CBoolean
        if (protoInstanceOf(type, CBoolean))
            return toBool(value);
        // CNumber and subclasses
        if (protoInstanceOf(type, CNumber))
            return toNumber(value);
        // Composite scalars — CTuple ("a,b,c"), CStringArray ("a;b"), CVariator,
        // abilcmd / catalog-ref strings — are KEPT VERBATIM as strings (the witrina
        // preserves e.g. AbilCmd:"move,Move"). Only when the resolved value is already
        // a JS array (repeated child elements) do we recurse element-wise.
        if (protoInstanceOf(type, CTuple) || protoInstanceOf(type, CStringArray) || protoInstanceOf(type, CVariator)) {
            if (Array.isArray(value))
                return coerceArray(value, type.memberType ?? undefined);
            return scalarOf(value);
        }
        // CSObject (e.g. TEditorCategories) — serialized as "K:V,K:V" → object.
        // The field schema is a generic type param (no static .schema), so parse generically.
        if (protoInstanceOf(type, CSObject)) {
            if (typeof value === 'string')
                return coerceStruct(value, structSchemaOf(type) ?? {});
            const schema = structSchemaOf(type);
            return schema ? coerceStruct(value, schema) : passthrough(value);
        }
        // struct
        const schema = structSchemaOf(type);
        if (schema) {
            // array of struct items (rare at this level — usually [Inner])
            if (Array.isArray(value))
                return coerceArray(value, type);
            return coerceStruct(value, schema);
        }
        // scalar leaf (CScalar: enum/string/link/file/identifier) — keep as string
        if (protoInstanceOf(type, CScalar))
            return scalarOf(value);
    }
    // unknown schema type → best-effort
    if (Array.isArray(value))
        return coerceArray(value, undefined);
    if (typeof value === 'object')
        return coerceStruct(value, {});
    return passthrough(value);
}

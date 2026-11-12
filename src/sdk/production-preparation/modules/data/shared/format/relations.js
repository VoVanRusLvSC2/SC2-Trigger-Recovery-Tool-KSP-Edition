/**
 * Schema-driven SC2 catalog reference graph (port of old-parser `relations()` +
 * `_propertyRelations` + `getReferenceRelations`, see references/old-parser/src/operations.js).
 *
 * All extraction rules are derived from the structure-types schema in
 * `@modkitx/data-processing/sc2-schema` (DATA_CLASS_SCHEMA + the instruction tables baked into the
 * complex scalar classes). No per-fixture hardcoding:
 *
 *  - CLink subclasses (static `link`)          → direct entity reference
 *  - CFile subclasses                          → asset path (not an entity ref — skipped)
 *  - CStringLink (link='String')               → text key (collected separately for rename)
 *  - CTuple.Ex subclasses (static memberTypes) → positional tuple parse
 *      e.g. CAbilCommand "attack,Barrage"      → Abil/attack
 *           CCatalogReference "Effect,X,Field" → Effect/X
 *           CActorLinks / CActorSiteOps        → space-separated actor links ('ops')
 *  - CStringArray.Ex subclasses (static memberType) → split + classify each item
 *      e.g. CActorTerms "Abil.X.Start; ValidateUnit V" (terms)
 *  - CScalar.Dyn subclasses (static resolver)  → instruction-table dispatch
 *      e.g. CActorMsgPayloadPtr "Create X" (send), CActorTerm, CQuery, CActorKey,
 *           CDataSoupKey (driver)
 *  - CScalar.Union subclasses (static types)   → try each member type
 *      e.g. CRefKey (subject: "ActorName" | "::actor.Name")
 *
 * Unlike old-parser, entities with empty id are kept (data-type defaults), and a
 * relation is only recorded when the target entity exists in the loaded mod.
 */
import { DATA_CLASS_SCHEMA, CLink, CFile, CTuple, CWTuple, CDTuple, CSTuple, COTuple, CStringArray, CCArray, CSArray, CWArray, CRecord, CCatalogReference, CGameContentCreationData, CDataEntryPath, CATALOG_NAMESPACES, tokenTypeNamespace, } from "../catalog-engine/sc2-schema/index.js";
import { resolveEntityTyped } from "../catalog-engine/sc2-catalog/index.js";
import { declaredTokenTypes } from "./token-decls.js";
import { markupCatalogRefs } from "../../../strings/shared/core/markup.js";
// Props that are entity metadata, not data fields (old-parser: relations() skip list)
const SKIP_PROPS = new Set(['index', 'class', 'removed', 'id', 'ID', 'parent', 'default']);
function isClass(v) {
    return typeof v === 'function';
}
/** CLink subclass with a static target namespace. */
function isLinkClass(t) {
    return isClass(t) && t.prototype instanceof CLink && typeof t.link === 'string';
}
function isFileClass(t) {
    const ctor = t;
    return isClass(t) && (ctor === CFile || ctor.prototype instanceof CFile);
}
/** Class with a non-empty .schema → nested struct. */
function isStructClass(t) {
    return (isClass(t) &&
        !!t.schema &&
        typeof t.schema === 'object' &&
        Object.keys(t.schema).length > 0);
}
function isRecordClass(t) {
    return isClass(t) && t.prototype instanceof CRecord && 'value' in t;
}
/** Plain-object record spec: { index: EEnum, value: Ctor } */
function isRecordSpec(t) {
    return (t !== null &&
        typeof t === 'object' &&
        !Array.isArray(t) &&
        'index' in t &&
        'value' in t);
}
function ownField(schema, prop) {
    return Object.prototype.hasOwnProperty.call(schema, prop) ? schema[prop] : undefined;
}
function schemaField(schema, prop) {
    const exact = ownField(schema, prop);
    if (exact !== undefined)
        return exact;
    if (!prop)
        return undefined;
    const upperFirst = prop[0].toUpperCase() + prop.slice(1);
    return upperFirst === prop ? undefined : ownField(schema, upperFirst);
}
function structLinkField(t) {
    if (!isStructClass(t))
        return undefined;
    const link = ownField(t.schema, 'Link');
    return isLinkClass(link) ? link : undefined;
}
function tupleSeparator(t) {
    const p = t.prototype;
    if (p instanceof CWTuple)
        return ' ';
    if (p instanceof CDTuple)
        return '.';
    if (p instanceof CSTuple)
        return ';';
    if (p instanceof COTuple)
        return ':';
    return ',';
}
function arraySeparator(t) {
    const p = t.prototype;
    if (p instanceof CWArray)
        return ' ';
    if (p instanceof CSArray)
        return ';';
    if (p instanceof CCArray)
        return ',';
    return ',';
}
/** Pull a string out of a raw scalar slot: "X" | { value: "X" } | { Link: "X" } */
function scalarString(v) {
    if (typeof v === 'string')
        return v;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        const o = v;
        if (typeof o['value'] === 'string')
            return o['value'];
        if (typeof o['Link'] === 'string')
            return o['Link'];
    }
    return undefined;
}
function tokenizeSpaces(value) {
    const tokens = [];
    const re = /\{([^}]*)\}|(\S+)/g;
    let m;
    while ((m = re.exec(value)) !== null) {
        if (m[1] !== undefined)
            tokens.push({ text: m[1], words: m[1].split(/\s+/).filter(Boolean) });
        else
            tokens.push({ text: m[2] });
    }
    return tokens;
}
// ─── Graph builder ───────────────────────────────────────────────────────────
export function buildCatalogRelations(source) {
    const outMap = new Map();
    const inMap = new Map();
    const allRefs = [];
    const textRefs = [];
    const key = (ns, id) => `${ns}/${id}`;
    // lowercase → canonical namespace (mod-known namespaces win, then static catalog list)
    const nsCanon = new Map();
    for (const ns of CATALOG_NAMESPACES)
        nsCanon.set(ns.toLowerCase(), ns);
    for (const ns of source.namespaces())
        nsCanon.set(ns.toLowerCase(), ns);
    const seen = new Set();
    let from;
    // Declared `<?token?>` types for the entity currently being walked: exact
    // token id → declared `type` (undefined when declared without a type). Built per
    // entity from its inheritance chain; the deepest declaration wins.
    let currentTokens = new Map();
    function addRef(nsRaw, id, path) {
        if (!nsRaw || !id || id === '*' || id.startsWith(':'))
            return;
        const ns = nsCanon.get(nsRaw.toLowerCase());
        if (!ns)
            return;
        const to = source.get(ns, id);
        if (!to)
            return;
        const p = path.join('.');
        const dedup = `${key(from.namespace, from.id)}|${key(to.namespace, to.id)}|${p}`;
        if (seen.has(dedup))
            return;
        seen.add(dedup);
        const ref = { from, to, path: p };
        const fromKey = key(from.namespace, from.id);
        const toKey = key(to.namespace, to.id);
        if (!outMap.has(fromKey))
            outMap.set(fromKey, []);
        if (!inMap.has(toKey))
            inMap.set(toKey, []);
        outMap.get(fromKey).push(ref);
        inMap.get(toKey).push(ref);
        allRefs.push(ref);
    }
    function addText(keyStr, path) {
        if (!keyStr || keyStr.includes('#'))
            return;
        textRefs.push({ from, key: keyStr, path: path.join('.') });
    }
    // ── scalar classification (old-parser _propertyRelations port) ────────────
    function classifyScalar(value, t, path) {
        if (!value || value === '*' || !isClass(t))
            return;
        // '::ns.link' query form (subject / RefSetFromMsg) — old-parser 'subject' case
        if (value.startsWith('::')) {
            const m = /^::(\w+)\.([\w@_#-]+)/.exec(value);
            if (m)
                addRef(m[1], m[2], path);
            return;
        }
        // Direct catalog link
        if (isLinkClass(t)) {
            if (t.link === 'String') {
                addText(value, path);
                return;
            }
            if (isFileClass(t))
                return;
            addRef(t.link, value, path);
            return;
        }
        if (isFileClass(t))
            return;
        const shorthandLink = structLinkField(t);
        if (shorthandLink) {
            classifyScalar(value, shorthandLink, [...path, 'Link']);
            return;
        }
        // Catalog reference tuples: "Catalog,EntityId[,FieldPath]" (old-parser 'reference')
        const ctor = t;
        if (ctor === CCatalogReference ||
            ctor === CGameContentCreationData ||
            ctor === CDataEntryPath ||
            ctor.prototype instanceof CCatalogReference ||
            ctor.prototype instanceof CGameContentCreationData ||
            ctor.prototype instanceof CDataEntryPath) {
            const parts = value.split(',');
            if (parts.length >= 2)
                addRef(parts[0].trim(), parts[1].trim(), path);
            return;
        }
        // Dyn scalar: instruction-table dispatch (send / terms / query / actor-key / driver)
        const resolver = t.resolver;
        if (typeof resolver === 'function') {
            const stripped = value.replace(/^!/, '');
            let resolved;
            try {
                resolved = resolver({ value: stripped });
            }
            catch {
                resolved = undefined;
            }
            if (!resolved)
                return;
            if (Array.isArray(resolved)) {
                // raw arg-type list for dotted event form: "Tag.Arg1.Arg2"
                const parts = stripped.split('.');
                resolved.forEach((argT, i) => {
                    const arg = parts[i + 1];
                    if (arg)
                        classifyScalar(arg, argT, path);
                });
                return;
            }
            if (isClass(resolved) && resolved !== t)
                classifyScalar(stripped, resolved, path);
            return;
        }
        // Union scalar (CRefKey): try each member type
        const unionTypes = t.types;
        if (Array.isArray(unionTypes) && !(t.prototype instanceof CTuple)) {
            for (const ut of unionTypes) {
                if (isLinkClass(ut))
                    classifyScalar(value, ut, path);
            }
            return;
        }
        // Tuple scalar: positional parse, last type is variadic for trailing tokens
        if (t.prototype instanceof CTuple) {
            const memberTypes = t.memberTypes;
            if (!memberTypes || memberTypes.length === 0)
                return;
            const sep = tupleSeparator(t);
            const tokens = sep === ' ' ? tokenizeSpaces(value) : value.split(sep).map(s => ({ text: s.trim() }));
            tokens.forEach((token, i) => {
                const argT = memberTypes[Math.min(i, memberTypes.length - 1)];
                classifyToken(token, argT, path);
            });
            return;
        }
        // String-array scalar: split and classify each item
        if (t.prototype instanceof CStringArray) {
            const memberType = t.memberType;
            if (!memberType)
                return;
            const sep = arraySeparator(t);
            for (const item of value.split(sep)) {
                const trimmed = item.trim();
                if (trimmed)
                    classifyScalar(trimmed, memberType, path);
            }
            return;
        }
        // Enums / flags / plain scalars → no relation
    }
    /** Classify a single tuple token (possibly a brace group). */
    function classifyToken(token, argT, path) {
        if (token.words) {
            // Brace group — element type determines per-word classification
            const inner = innerLinkType(argT);
            if (!inner)
                return;
            for (const w of token.words)
                classifyScalar(w, inner, path);
            return;
        }
        if (!token.text)
            return;
        classifyScalar(token.text, argT, path);
    }
    /** For a brace-group argument, find the per-word link type. */
    function innerLinkType(argT) {
        if (!isClass(argT))
            return undefined;
        if (isLinkClass(argT))
            return argT;
        const a = argT;
        if (a.prototype instanceof CTuple) {
            const mt = a.memberTypes;
            return mt?.find(x => isLinkClass(x));
        }
        if (a.prototype instanceof CStringArray) {
            const mt = a.memberType;
            return isLinkClass(mt) ? mt : undefined;
        }
        return undefined;
    }
    // ── schema walk (old-parser relations() port) ──────────────────────────────
    function walkObject(obj, schema, path) {
        for (const [prop, value] of Object.entries(obj)) {
            if (SKIP_PROPS.has(prop))
                continue;
            if (value === null || value === undefined || value === '')
                continue;
            let t = ownField(schema, prop);
            if (t !== undefined) {
                walkTyped(value, t, [...path, prop]);
                continue;
            }
            if (currentTokens.has(prop)) {
                // Token attribute: a value supplied for a `<?token?>` declared on this
                // entity's inheritance chain. The declared type names the target
                // namespace (e.g. type="CUnitLink" → Unit); plain-string tokens (no
                // type) are not links. Token ids are case-sensitive and may start with
                // any letter, so the property is matched exactly against the declaration.
                const ns = tokenTypeNamespace(currentTokens.get(prop));
                const sv = scalarString(value);
                if (ns && sv)
                    addRef(ns, sv, [...path, prop]);
                continue;
            }
            t = schemaField(schema, prop);
            if (t === undefined)
                continue;
            walkTyped(value, t, [...path, prop]);
        }
    }
    /**
     * Normalize an array/record field value into [pathKey, item] pairs.
     * Handles every shape the resolver produces:
     *   [ {index:'Use', ...} , ... ]         — resolved indexed array
     *   { index:'Use', Link:'X' }            — single indexed item kept as object
     *   { Use: {...} } / { Use: [{...}] }    — word-keyed map (possibly array-wrapped)
     *   [ 'A', 'B' ]                         — plain scalar array
     */
    function indexedItems(value) {
        if (Array.isArray(value)) {
            // keep positional indexes aligned with array slots — null holes preserve
            // the slot numbering (sparse arrays from indexed-array resolution)
            const out = [];
            value.forEach((it, i) => {
                if (it === null || it === undefined)
                    return;
                const idx = it?.['index'];
                out.push([String(idx ?? i), it]);
            });
            return out;
        }
        if (value !== null && typeof value === 'object') {
            const o = value;
            if ('index' in o)
                return [[String(o['index']), o]];
            const out = [];
            for (const [k, v] of Object.entries(o)) {
                if (v === null || v === undefined)
                    continue;
                if (Array.isArray(v)) {
                    for (const it of v) {
                        if (it !== null && it !== undefined)
                            out.push([k, it]);
                    }
                }
                else {
                    out.push([k, v]);
                }
            }
            return out;
        }
        return value === null || value === undefined ? [] : [['0', value]];
    }
    function walkItem(item, inner, idxPath) {
        if (item === null || item === undefined)
            return;
        if (isStructClass(inner) &&
            !(isClass(inner) &&
                (inner.prototype instanceof CTuple || inner.prototype instanceof CStringArray))) {
            if (typeof item === 'object' && !Array.isArray(item)) {
                walkObject(item, inner.schema, idxPath);
            }
            else {
                const s = scalarString(item);
                if (s !== undefined)
                    classifyScalar(s, inner, idxPath);
            }
            return;
        }
        const s = scalarString(item);
        if (s !== undefined)
            classifyScalar(s, inner, idxPath);
    }
    function walkTyped(value, t, path) {
        // Array field: [Inner]
        if (Array.isArray(t) && t.length === 1) {
            const inner = t[0];
            // A single struct object (no index, keys belong to the struct schema) is
            // one unindexed item, not a word-keyed map: CardLayouts.LayoutButtons etc.
            if (!Array.isArray(value) &&
                value !== null &&
                typeof value === 'object' &&
                !('index' in value) &&
                isStructClass(inner) &&
                Object.keys(value).some(k => k in inner.schema)) {
                walkItem(value, inner, [...path, '0']);
                return;
            }
            for (const [k, item] of indexedItems(value))
                walkItem(item, inner, [...path, k]);
            return;
        }
        // Record field: { index: EEnum, value: Ctor } or CRecord subclass
        const recSpec = isRecordSpec(t) ? t : isRecordClass(t) ? { value: t.value } : null;
        if (recSpec) {
            const vt = recSpec.value;
            for (const [k, item] of indexedItems(value)) {
                // single-key { value: x } wrappers unwrap for scalar value types
                const payload = !isStructClass(vt) &&
                    item !== null &&
                    typeof item === 'object' &&
                    'value' in item
                    ? item['value']
                    : item;
                walkItem(payload, vt, [...path, k]);
            }
            return;
        }
        // Nested struct (but tuples/string-arrays are scalar-like despite having no .schema)
        if (isStructClass(t) &&
            !(isClass(t) && (t.prototype instanceof CTuple || t.prototype instanceof CStringArray))) {
            if (Array.isArray(value)) {
                value.forEach((v, i) => {
                    if (v !== null && typeof v === 'object')
                        walkObject(v, t.schema, [...path, String(i)]);
                });
            }
            else if (value !== null && typeof value === 'object') {
                walkObject(value, t.schema, path);
            }
            else {
                const s = scalarString(value);
                if (s !== undefined)
                    classifyScalar(s, t, path);
            }
            return;
        }
        // Scalar leaf (possibly array of scalars)
        if (Array.isArray(value)) {
            value.forEach((v, i) => {
                const s = scalarString(v);
                if (s !== undefined)
                    classifyScalar(s, t, [...path, String(i)]);
            });
            return;
        }
        const s = scalarString(value);
        if (s !== undefined)
            classifyScalar(s, t, path);
    }
    // ── main loop ───────────────────────────────────────────────────────────────
    const lookup = (ns, id) => source.get(ns, id);
    for (const ns of source.namespaces()) {
        for (const entity of source.all(ns)) {
            from = entity;
            currentTokens = declaredTokenTypes(entity, lookup);
            // parent= reference (old-parser appends it to $$relations)
            if (entity.parent)
                addRef(entity.namespace, entity.parent, ['parent']);
            const cls = DATA_CLASS_SCHEMA[entity.class];
            if (!isClass(cls) || !cls.schema)
                continue;
            const resolved = resolveEntityTyped(entity, lookup);
            walkObject(resolved, cls.schema, []);
        }
    }
    // ── inverse text index (entity ⇄ string key) ─────────────────────────────
    const textsByEntity = new Map();
    const entitiesByText = new Map();
    for (const tr of textRefs) {
        const ek = key(tr.from.namespace, tr.from.id);
        (textsByEntity.get(ek) ?? textsByEntity.set(ek, []).get(ek)).push(tr);
        (entitiesByText.get(tr.key) ?? entitiesByText.set(tr.key, []).get(tr.key)).push(tr);
    }
    // ── catalog refs embedded inside localized string values (markup) ─────────
    const stringMarkupRefList = buildStringMarkupRefs(source, nsCanon);
    return {
        outgoing(namespace, id) {
            return outMap.get(key(namespace, id)) ?? [];
        },
        incoming(namespace, id) {
            return inMap.get(key(namespace, id)) ?? [];
        },
        all() {
            return allRefs;
        },
        texts() {
            return textRefs;
        },
        textsForEntity(namespace, id) {
            return textsByEntity.get(key(namespace, id)) ?? [];
        },
        entitiesForText(k) {
            return entitiesByText.get(k) ?? [];
        },
        stringMarkupRefs() {
            return stringMarkupRefList;
        },
    };
}
/**
 * Extract catalog entities referenced from inside localized string values
 * (`<d ref="Ns,Entity,Field"/>` markup). Only references whose target entity exists
 * in the loaded mod are recorded. These edges are invisible to the catalog-data walk
 * but matter for rename safety and "where is this string used".
 */
export function buildStringMarkupRefs(source, nsCanon) {
    const out = [];
    const canon = nsCanon ?? new Map();
    if (!nsCanon) {
        for (const ns of CATALOG_NAMESPACES)
            canon.set(ns.toLowerCase(), ns);
        for (const ns of source.namespaces())
            canon.set(ns.toLowerCase(), ns);
    }
    const seen = new Set();
    const locales = source.locales;
    if (!locales)
        return out;
    for (const [locale, files] of locales) {
        for (const [file, entries] of files) {
            for (const [strKey, value] of entries) {
                if (!value || (value.indexOf('<d ') === -1 && value.indexOf('$') === -1))
                    continue;
                for (const ref of markupCatalogRefs(value)) {
                    const ns = canon.get(ref.ns.toLowerCase());
                    if (!ns)
                        continue;
                    const id = ref.entity.replace(/@.*$/, '');
                    if (!source.get(ns, id))
                        continue;
                    const dedup = `${locale}|${file}|${strKey}|${ns}/${id}|${ref.field}`;
                    if (seen.has(dedup))
                        continue;
                    seen.add(dedup);
                    out.push({ locale, file, key: strKey, to: { namespace: ns, id }, field: ref.field });
                }
            }
        }
    }
    return out;
}
//# sourceMappingURL=relations.js.map
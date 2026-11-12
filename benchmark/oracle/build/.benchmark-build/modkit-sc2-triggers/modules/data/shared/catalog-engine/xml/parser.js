import { XMLParser } from 'fast-xml-parser';
/**
 * fast-xml-parser config for SC2 catalog XML.
 * No custom isArray — we rely on natural behavior:
 *   multiple siblings of the same tag → array
 *   single element → object
 * Normalization (attribute collapsing, @_ stripping) is done in post-processing.
 */
const XML_PARSER = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseAttributeValue: false, // type coercion is schema's job
    trimValues: true,
    parseTagValue: false,
    allowBooleanAttributes: true,
});
/**
 * Parse an SC2 catalog XML text.
 * Handles all SC2 XML quirks:
 *   <CUnit id="Marine">          → entry with id
 *   <LifeMax value="45"/>        → scalar field "45"
 *   <Attributes index="Light" value="1"/>  → object { index:"Light", value:"1" }
 *   <WeaponArray index="0" Link="GuassRifle"/> → object { index:"0", Link:"GuassRifle" }
 *   <GlossaryStrongArray value="Marauder"/> × 2 → array ["Marauder","Medivac"]
 */
export function parseCatalogXml(xmlText, opts = {}) {
    const raw = XML_PARSER.parse(xmlText);
    const catalogNode = (raw['Catalog'] ?? raw);
    return extractEntries(catalogNode, opts, xmlText);
}
function extractEntries(node, opts, xmlText) {
    const result = new Map();
    const rootTypes = [];
    // fast-xml-parser has no positions — when trackSource is on, index declaration lines
    // with one text scan over the ROOT entry tags (`<CUnit … id="Marine"` / `<const id=…`).
    const rootTags = Object.keys(node).filter((t) => t === 'const' || isCatalogTypeName(t));
    const lineIndex = opts.trackSource && xmlText !== undefined ? buildEntryLineIndex(xmlText, rootTags) : undefined;
    const file = opts.filePath ?? '';
    for (const [tagName, value] of Object.entries(node)) {
        if (tagName.startsWith('@_') || tagName === '#text' || tagName === '?xml')
            continue;
        // SC2 uses lowercase <const> for constant/token definitions — treat as type 'CConst'
        const typeName = tagName === 'const' ? 'CConst' : tagName;
        if (!isCatalogTypeName(typeName))
            continue;
        rootTypes.push(typeName);
        const list = Array.isArray(value) ? value : [value];
        const entries = [];
        for (const item of list) {
            if (typeof item !== 'object' || item === null)
                continue;
            const entry = convertEntry(typeName, item, opts);
            if (lineIndex) {
                // Parsed entries preserve document order per tag, so consuming the queue matches
                // repeated declarations of the same id to their own lines.
                const line = lineIndex.get(`${tagName}\u0000${entry.id}`)?.shift();
                entries.push({ ...entry, source: { file, line: line ?? 0 } });
            }
            else
                entries.push(entry);
        }
        const existing = result.get(typeName);
        if (existing)
            existing.push(...entries);
        else
            result.set(typeName, entries);
    }
    return { rootTypes, entries: result };
}
/** 1-based declaration lines per `tag\u0000id`, in document order (one pass over the text). */
function buildEntryLineIndex(xmlText, tagNames) {
    const map = new Map();
    if (tagNames.length === 0)
        return map;
    const escaped = [...new Set(tagNames)].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`<(${escaped.join('|')})\\b[^>]*?\\bid\\s*=\\s*"([^"]*)"`, 'g');
    let line = 1;
    let counted = 0;
    let m;
    while ((m = pattern.exec(xmlText)) !== null) {
        for (let i = counted; i < m.index; i++)
            if (xmlText.charCodeAt(i) === 10)
                line++;
        counted = m.index;
        const key = `${m[1]}\u0000${m[2]}`;
        const arr = map.get(key);
        if (arr)
            arr.push(line);
        else
            map.set(key, [line]);
    }
    return map;
}
function isCatalogTypeName(name) {
    return name.length >= 2 && name[0] === 'C' && name[1] >= 'A' && name[1] <= 'Z';
}
function convertEntry(type, node, opts) {
    const id = getAttr(node, 'id') ?? '';
    const parent = getAttr(node, 'parent');
    const isDefault = getAttr(node, 'default');
    const fields = {};
    let tokens;
    for (const [key, val] of Object.entries(node)) {
        if (key === '#text')
            continue;
        // <?token id type value?> processing instructions (fast-xml-parser surfaces as "?token")
        if (key === '?token') {
            tokens = extractTokenDecls(val);
            continue;
        }
        if (key.startsWith('?'))
            continue; // any other PI — not catalog data
        if (key.startsWith('@_')) {
            // Include non-metadata attributes as fields (e.g. type=, value= on <const> entries)
            const attrName = key.slice(2);
            if (attrName !== 'id' && attrName !== 'parent' && attrName !== 'default') {
                fields[attrName] = convertFieldValue(val);
            }
            continue;
        }
        fields[key] = convertFieldValue(val);
    }
    const entry = {
        type,
        id,
        ...(parent !== undefined ? { parent } : {}),
        ...(isDefault !== undefined ? { default: isDefault } : {}),
        fields: fields,
        ...(tokens !== undefined && tokens.length > 0 ? { tokens } : {}),
    };
    return entry;
}
/** Normalise the fast-xml-parser representation of `<?token?>` PIs into TokenDecl[]. */
function extractTokenDecls(val) {
    const list = Array.isArray(val) ? val : [val];
    const out = [];
    for (const item of list) {
        if (typeof item !== 'object' || item === null)
            continue;
        const o = item;
        const id = o['@_id'];
        if (id === undefined)
            continue;
        const decl = {
            id: String(id),
            ...(o['@_type'] !== undefined ? { type: String(o['@_type']) } : {}),
            ...(o['@_value'] !== undefined ? { value: String(o['@_value']) } : {}),
        };
        out.push(decl);
    }
    return out;
}
/**
 * Convert a raw fast-xml-parser value to our RawValue representation.
 *
 * Normalisation rules:
 * 1. Object with only `@_value` attribute → scalar string
 * 2. Object with attributes (and possibly children) → RawObject with keys stripped of `@_`
 * 3. Array → recursively convert each element (arrays of single-value objects → array of scalars)
 * 4. Primitive → string
 */
function convertFieldValue(val) {
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
        return String(val);
    }
    if (Array.isArray(val)) {
        return val.map(item => convertFieldValue(item));
    }
    if (typeof val === 'object' && val !== null) {
        const node = val;
        const keys = Object.keys(node);
        // Only @_value → scalar
        if (keys.length === 1 && keys[0] === '@_value') {
            return String(node['@_value']);
        }
        // Build normalised object: strip @_ from attributes, recurse into children
        const obj = {};
        for (const [k, v] of Object.entries(node)) {
            if (k === '#text')
                continue;
            if (k.startsWith('?'))
                continue; // nested processing instructions are not data
            const name = k.startsWith('@_') ? k.slice(2) : k;
            obj[name] = convertFieldValue(v);
        }
        return obj;
    }
    return '';
}
function getAttr(node, name) {
    const v = node[`@_${name}`];
    return v !== undefined ? String(v) : undefined;
}

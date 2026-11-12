import { parseXml, XmlElement, XmlProcessingInstruction, XmlText } from '@rgrove/parse-xml';
/**
 * The top-level elements of an XML document (normally one `<Catalog>`), in document order, with
 * every attribute (as written), child element, direct text and `<?token?>` declaration. A malformed
 * document throws. The raw entry model below and the Data provider's schema-typed analysis are both
 * projections of this one read.
 */
export function parseCatalogXmlElements(xmlText) {
    return elementsOf(parseXml(xmlText).children);
}
function elementsOf(nodes) {
    const elements = [];
    for (const node of nodes) {
        if (!(node instanceof XmlElement))
            continue;
        let text = '';
        let tokens;
        for (const child of node.children) {
            if (child instanceof XmlText)
                text += child.text.trim();
            else if (child instanceof XmlProcessingInstruction && child.name === 'token') {
                tokens ??= [];
                const declaration = tokenOf(child.content);
                if (declaration !== undefined)
                    tokens.push(declaration);
            }
        }
        elements.push({
            name: node.name,
            attributes: node.attributes,
            children: elementsOf(node.children),
            text,
            ...(tokens === undefined ? {} : { tokens }),
        });
    }
    return elements;
}
/** `<?token id="…" type="…" value="…"?>`: the instruction's content read as attributes. */
function tokenOf(content) {
    let attributes;
    try {
        const element = parseXml(`<token ${content}/>`).root;
        if (element === null)
            return undefined;
        attributes = element.attributes;
    }
    catch {
        return undefined; // a malformed declaration does not discard its entity
    }
    const { id, type, value } = attributes;
    if (id === undefined)
        return undefined;
    return { id, ...(type !== undefined ? { type } : {}), ...(value !== undefined ? { value } : {}) };
}
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
    return catalogFileOfElements(parseCatalogXmlElements(xmlText), xmlText, opts);
}
/** The raw entry model of a document already read by {@link parseCatalogXmlElements}. */
export function catalogFileOfElements(topLevel, xmlText, opts = {}) {
    const catalog = topLevel.find(element => element.name === 'Catalog');
    return extractEntries(catalog === undefined ? topLevel : catalog.children, opts, xmlText);
}
function extractEntries(nodes, opts, xmlText) {
    const result = new Map();
    const rootTypes = [];
    const grouped = groupByName(nodes);
    // When trackSource is on, index declaration lines with one text scan over the ROOT entry tags (`<CUnit … id="Marine"` / `<const id=…`).
    const rootTags = [...grouped.keys()].filter((t) => t === 'const' || isCatalogTypeName(t));
    const lineIndex = opts.trackSource && xmlText !== undefined ? buildEntryLineIndex(xmlText, rootTags) : undefined;
    const file = opts.filePath ?? '';
    for (const [tagName, list] of grouped) {
        // SC2 uses lowercase <const> for constant/token definitions — treat as type 'CConst'
        const typeName = tagName === 'const' ? 'CConst' : tagName;
        if (!isCatalogTypeName(typeName))
            continue;
        rootTypes.push(typeName);
        const entries = [];
        for (const item of list) {
            // A declaration with neither attributes nor child elements carries no entry.
            if (Object.keys(item.attributes).length === 0 && item.children.length === 0 && item.tokens === undefined)
                continue;
            const entry = convertEntry(typeName, item);
            if (lineIndex) {
                // Parsed entries preserve document order per tag, so consuming the queue matches
                // repeated declarations of the same id to their own lines.
                const found = lineIndex.get(`${tagName}\u0000${entry.id}`)?.shift();
                entries.push({
                    ...entry,
                    source: { file, line: found?.line ?? 0, ...(found === undefined ? {} : { span: found.span }) },
                });
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
function groupByName(elements) {
    const grouped = new Map();
    for (const element of elements) {
        const list = grouped.get(element.name);
        if (list)
            list.push(element);
        else
            grouped.set(element.name, [element]);
    }
    return grouped;
}
/**
 * 1-based declaration lines per `tag\u0000id`, in document order (one pass over the text), with the
 * opening tag's span — where an editor opens the declaration.
 */
function buildEntryLineIndex(xmlText, tagNames) {
    const map = new Map();
    if (tagNames.length === 0)
        return map;
    const escaped = [...new Set(tagNames)].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`<(${escaped.join('|')})\\b[^>]*?\\bid\\s*=\\s*"([^"]*)"`, 'g');
    let line = 1;
    let lineStart = 0;
    let counted = 0;
    let m;
    while ((m = pattern.exec(xmlText)) !== null) {
        for (let i = counted; i < m.index; i++) {
            if (xmlText.charCodeAt(i) === 10) {
                line++;
                lineStart = i + 1;
            }
        }
        counted = m.index;
        // The tag ends at the first `>` outside a quoted value.
        let end = m.index + m[0].length;
        let quote = 0;
        for (; end < xmlText.length; end++) {
            const code = xmlText.charCodeAt(end);
            if (quote !== 0) {
                if (code === quote)
                    quote = 0;
            }
            else if (code === 34 || code === 39)
                quote = code;
            else if (code === 62) {
                end++;
                break;
            }
        }
        const key = `${m[1]}\u0000${m[2]}`;
        const found = { line, span: { offset: m.index, length: end - m.index, column: m.index - lineStart } };
        const arr = map.get(key);
        if (arr)
            arr.push(found);
        else
            map.set(key, [found]);
    }
    return map;
}
function isCatalogTypeName(name) {
    return name.length >= 2 && name[0] === 'C' && name[1] >= 'A' && name[1] <= 'Z';
}
function convertEntry(type, node) {
    const attributes = Object.entries(node.attributes);
    const { id = '', parent, default: isDefault } = node.attributes;
    // Child elements first, then attributes: an attribute wins over a like-named child.
    const fields = {};
    for (const [name, list] of groupByName(node.children))
        fields[name] = convertGroup(list);
    for (const [name, value] of attributes) {
        if (name !== 'id' && name !== 'parent' && name !== 'default')
            fields[name] = value;
    }
    const tokens = node.tokens;
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
function convertGroup(list) {
    return list.length === 1 ? convertFieldValue(list[0]) : list.map(convertFieldValue);
}
/**
 * The raw value of one field element.
 *
 * Normalisation rules:
 * 1. Only a `value` attribute → scalar string
 * 2. Only text (or nothing) → that text
 * 3. Otherwise → RawObject of child elements then attributes; repeated children → array
 */
function convertFieldValue(node) {
    const attributes = Object.entries(node.attributes);
    const others = node.children.length > 0 || node.text.length > 0 || node.tokens !== undefined;
    if (attributes.length === 0 && node.children.length === 0 && node.tokens === undefined)
        return node.text;
    if (!others && attributes.length === 1 && attributes[0][0] === 'value')
        return attributes[0][1];
    const obj = {};
    for (const [name, list] of groupByName(node.children))
        obj[name] = convertGroup(list);
    for (const [name, value] of attributes)
        obj[name] = value;
    return obj;
}
//# sourceMappingURL=parser.js.map
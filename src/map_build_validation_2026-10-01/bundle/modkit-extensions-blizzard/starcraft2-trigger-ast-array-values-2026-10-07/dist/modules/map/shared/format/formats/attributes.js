/**
 * The editor's lobby document (`Attributes`): the document's own attributes (`<Attribute>`: id, type,
 * name, who sets it, its values and defaults) and the game variants (`<Variant>`: mode, team size and
 * the defaults of standard and own attributes per slot). Scripts read an attribute with
 * `GameAttributeGameValue("<Id>")`/`GameAttributePlayerValue("<Id>", player)` and compare the value
 * with a four-digit value id ("0002"); names live in GameStrings (`Attribute<NNN>/Name`,
 * `Attribute<NNN>/Value<NNN>/Name`).
 *
 * Attribute definitions are typed; variants are kept as written until they are edited. An element is
 * typed only when the model knows all of it; anything else stays whole in `unknown` at its place, and a
 * read and a write give the same bytes.
 */
import { canonicalInteger, escapeXmlAttribute, keptAt, knownElement as known, placeKept, readEditorXml, rootAttributes, rootOpenTag, writeEditorXmlElement, xmlAttributes, } from './editor-xml.js';
/** `Value` of an element that holds nothing else. */
const value = (element) => known(element, ['Value']) ? element.attributes['Value'] : undefined;
function readValue(element) {
    if (!known(element, [], true))
        return undefined;
    const item = {};
    const unknown = [];
    const fields = { Id: 'id', Name: 'name', Description: 'description', Icon: 'icon' };
    element.children.forEach((child, index) => {
        const field = fields[child.name];
        const text = value(child);
        if (field !== undefined && text !== undefined && item[field] === undefined)
            item[field] = text;
        else
            unknown.push(keptAt(child, index));
    });
    if (item.id === undefined)
        return undefined;
    if (unknown.length > 0)
        item.unknown = unknown;
    return item;
}
function readDefinition(element) {
    if (!known(element, [], true))
        return undefined;
    const definition = { values: [], defaults: [] };
    const unknown = [];
    const fields = { Id: 'id', Type: 'type', Name: 'name', Availability: 'availability', Visibility: 'visibility', Access: 'access' };
    element.children.forEach((child, index) => {
        const field = fields[child.name];
        const text = value(child);
        const item = child.name === 'Value' ? readValue(child) : undefined;
        if (field !== undefined && text !== undefined && definition[field] === undefined)
            definition[field] = text;
        else if (child.name === 'PublicLocked' && known(child, []) && !definition.publicLocked)
            definition.publicLocked = true;
        else if (item !== undefined)
            definition.values.push(item);
        else if (child.name === 'Default')
            definition.defaults.push(child);
        else
            unknown.push(keptAt(child, index));
    });
    if (definition.id === undefined)
        return undefined;
    if (unknown.length > 0)
        definition.unknown = unknown;
    return definition;
}
/** The text a document was read from, returned by the writer while the model still writes the same. */
const sourceText = new WeakMap();
/** Reads an `Attributes` document. A document that is not `<Attributes>` throws. */
export function readAttributes(xml) {
    const root = readEditorXml(xml, 'Attributes', 'Attributes');
    const document = { attributes: [], variants: [] };
    const own = rootAttributes(root);
    if (own !== undefined)
        document.root = own;
    const unknown = [];
    root.children.forEach((child, index) => {
        const definition = child.name === 'Attribute' ? readDefinition(child) : undefined;
        const count = child.name === 'DefaultVariants' && document.defaultVariants === undefined ? canonicalInteger(value(child)) : undefined;
        if (definition !== undefined)
            document.attributes.push(definition);
        else if (count !== undefined && count >= 0)
            document.defaultVariants = count;
        else if (child.name === 'Variant')
            document.variants.push(child);
        else
            unknown.push(keptAt(child, index));
    });
    if (unknown.length > 0)
        document.unknown = unknown;
    sourceText.set(document, { raw: xml, normalized: writeAttributesEditorLayout(document) });
    return document;
}
/** Writes the document: the text it was read from while nothing changed, else the editor's layout. */
export function writeAttributes(document) {
    const normalized = writeAttributesEditorLayout(document);
    const source = sourceText.get(document);
    return source !== undefined && source.normalized === normalized ? source.raw : normalized;
}
const field = (depth, name, text) => text === undefined ? [] : [[`${'    '.repeat(depth)}<${name} Value="${escapeXmlAttribute(text)}"/>`]];
const asWritten = (element, depth) => {
    const lines = [];
    writeEditorXmlElement(lines, depth, element);
    return lines;
};
/** The editor's order: own attributes, the variant count, the variants; kept elements at their read positions. */
export function writeAttributesEditorLayout(document) {
    const blocks = [];
    for (const definition of document.attributes) {
        const inner = [
            ...field(2, 'Id', definition.id),
            ...field(2, 'Type', definition.type),
            ...field(2, 'Name', definition.name),
            ...field(2, 'Availability', definition.availability),
            ...field(2, 'Visibility', definition.visibility),
            ...field(2, 'Access', definition.access),
        ];
        if (definition.publicLocked)
            inner.push(['        <PublicLocked/>']);
        for (const item of definition.values) {
            const values = [...field(3, 'Id', item.id), ...field(3, 'Name', item.name), ...field(3, 'Description', item.description), ...field(3, 'Icon', item.icon)];
            inner.push(['        <Value>', ...placeKept(values, item.unknown, 3), '        </Value>']);
        }
        for (const element of definition.defaults)
            inner.push(asWritten(element, 2));
        blocks.push(['    <Attribute>', ...placeKept(inner, definition.unknown, 2), '    </Attribute>']);
    }
    if (document.defaultVariants !== undefined)
        blocks.push([`    <DefaultVariants${xmlAttributes([['Value', document.defaultVariants]])}/>`]);
    for (const element of document.variants)
        blocks.push(asWritten(element, 1));
    return ['<?xml version="1.0" encoding="utf-8"?>', rootOpenTag('Attributes', document.root), ...placeKept(blocks, document.unknown, 1), '</Attributes>'].join('\r\n');
}
//# sourceMappingURL=attributes.js.map
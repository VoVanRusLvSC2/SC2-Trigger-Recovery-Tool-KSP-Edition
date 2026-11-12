/**
 * The XML the SC2 Editor writes for map documents such as `CustomAI` and `Attributes`: an element
 * tree read with `@rgrove/parse-xml`, written back in the editor's layout — four-space indent,
 * `<Tag/>` for an empty element, CRLF line ends, no final line end.
 */
import { parseXml, XmlElement, XmlText } from '@rgrove/parse-xml';
const sortedNames = (names) => names.every((name, index) => index === 0 || names[index - 1] < name);
function elementsOf(nodes) {
    const elements = [];
    for (const node of nodes) {
        if (!(node instanceof XmlElement))
            continue;
        let text = '';
        for (const child of node.children)
            if (child instanceof XmlText)
                text += child.text.trim();
        const names = Object.keys(node.attributes);
        elements.push({
            name: node.name,
            attributes: node.attributes,
            ...(sortedNames(names) ? {} : { attributeOrder: names }),
            children: elementsOf(node.children),
            text,
        });
    }
    return elements;
}
/** The element's attributes in written order; names added after reading follow. */
function orderedAttributes(element) {
    const order = element.attributeOrder ?? [];
    const names = [...order.filter(name => name in element.attributes), ...Object.keys(element.attributes).filter(name => !order.includes(name))];
    return names.map(name => [name, element.attributes[name]]);
}
/** The document's root element; one named otherwise throws. */
export function readEditorXml(xml, rootName, label) {
    const root = elementsOf(parseXml(xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml).children)[0];
    if (root?.name !== rootName)
        throw new Error(`${label}: root is <${root?.name ?? '?'}>, expected <${rootName}>`);
    return root;
}
export const escapeXmlAttribute = (value) => value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;');
/** ` Name="value"` for each entry with a value, in the order given. */
export const xmlAttributes = (entries) => entries.filter(([, value]) => value !== undefined).map(([name, value]) => ` ${name}="${escapeXmlAttribute(String(value))}"`).join('');
export function writeEditorXmlElement(lines, depth, element) {
    const indent = '    '.repeat(depth);
    const open = `${indent}<${element.name}${xmlAttributes(orderedAttributes(element))}`;
    if (element.children.length === 0 && element.text === '') {
        lines.push(`${open}/>`);
        return;
    }
    if (element.children.length === 0) {
        lines.push(`${open}>${escapeXmlAttribute(element.text)}</${element.name}>`);
        return;
    }
    lines.push(`${open}>`);
    for (const child of element.children)
        writeEditorXmlElement(lines, depth + 1, child);
    lines.push(`${indent}</${element.name}>`);
}
/**
 * Whether a model may read `element` into its typed fields: no text, no attribute outside `names` and, unless
 * `children`, no children. Anything else is kept as written, so a typed edit never drops what it cannot name.
 */
export const knownElement = (element, names, children = false) => element.text === '' && (children || element.children.length === 0) && Object.keys(element.attributes).every(name => names.includes(name));
/** An integer written the way the editor writes it (`String(n)`); '01', '+1' or '1.0' are not, and stay as written. */
export function canonicalInteger(text) {
    if (text === undefined)
        return undefined;
    const number = Number(text);
    return Number.isSafeInteger(number) && String(number) === text ? number : undefined;
}
/** `element` kept as written at position `index` among its parent's children. */
export const keptAt = (element, index) => ({ ...element, index });
/** The root's own attributes, when it has any. */
export function rootAttributes(root) {
    if (Object.keys(root.attributes).length === 0)
        return undefined;
    return root.attributeOrder === undefined ? { attributes: root.attributes } : { attributes: root.attributes, attributeOrder: root.attributeOrder };
}
/** The opening tag of a root with the attributes it was read with. */
export const rootOpenTag = (name, root) => `<${name}${root === undefined ? '' : xmlAttributes(orderedAttributes(root))}>`;
/**
 * The lines of a parent's children: `blocks` (one per child the model knows, in the editor's order) with the
 * `kept` elements put back at their read positions, or after the rest when they have none.
 */
export function placeKept(blocks, kept, depth) {
    const placed = [...blocks];
    const ordered = (kept ?? []).map((element, order) => ({ element, order }))
        .sort((left, right) => (left.element.index ?? Infinity) - (right.element.index ?? Infinity) || left.order - right.order);
    for (const { element } of ordered) {
        const lines = [];
        writeEditorXmlElement(lines, depth, element);
        placed.splice(Math.min(element.index ?? placed.length, placed.length), 0, lines);
    }
    return placed.flat();
}
/** A whole document: the declaration, the root and its children. */
export function writeEditorXml(root) {
    const lines = ['<?xml version="1.0" encoding="utf-8"?>'];
    if (root.children.length === 0)
        lines.push(`<${root.name}${xmlAttributes(orderedAttributes(root))}>`, `</${root.name}>`);
    else
        writeEditorXmlElement(lines, 0, root);
    return lines.join('\r\n');
}
//# sourceMappingURL=editor-xml.js.map
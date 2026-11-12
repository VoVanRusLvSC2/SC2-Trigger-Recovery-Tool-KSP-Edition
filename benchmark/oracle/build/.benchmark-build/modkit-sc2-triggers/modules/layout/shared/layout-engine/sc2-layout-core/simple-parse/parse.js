import { XMLParser } from 'fast-xml-parser';
const XML_PARSER = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseAttributeValue: false,
    trimValues: true,
    parseTagValue: false,
    allowBooleanAttributes: true,
});
export function parseLayout(xmlText) {
    const raw = XML_PARSER.parse(xmlText);
    const root = (raw['Desc'] ?? stripXmlDecl(raw));
    const file = {
        frames: [],
        constants: [],
        includes: [],
        animations: [],
        templates: [],
        references: [],
    };
    const templateSet = new Set();
    for (const item of toArray(root['Include'])) {
        const path = attr(item, 'path');
        if (path !== undefined)
            file.includes.push(path);
    }
    for (const item of toArray(root['Constant'])) {
        const name = attr(item, 'name');
        if (name === undefined)
            continue;
        file.constants.push({ name, val: attr(item, 'val') ?? '' });
    }
    for (const item of toArray(root['Animation'])) {
        const name = attr(item, 'name');
        if (name !== undefined)
            file.animations.push({ name });
    }
    for (const item of toArray(root['Frame'])) {
        const frame = parseFrame(item, '', file.references, templateSet);
        if (frame)
            file.frames.push(frame);
    }
    file.templates = [...templateSet];
    return file;
}
function parseFrame(node, parentPath, references, templateSet) {
    const name = attr(node, 'name') ?? '';
    const type = attr(node, 'type') ?? 'Frame';
    const template = attr(node, 'template');
    const fileRef = attr(node, 'file');
    if (template !== undefined)
        templateSet.add(template);
    const path = parentPath ? `${parentPath}/${name}` : name;
    const frame = {
        name,
        type,
        ...(template !== undefined ? { template } : {}),
        ...(fileRef !== undefined ? { file: fileRef } : {}),
        anchors: [],
        properties: [],
        animations: [],
        children: [],
    };
    for (const [key, value] of Object.entries(node)) {
        if (key === '#text' || key.startsWith('@_') || key.startsWith('?'))
            continue;
        if (key === 'Frame') {
            for (const child of toArray(value)) {
                const childFrame = parseFrame(child, path, references, templateSet);
                if (childFrame)
                    frame.children.push(childFrame);
            }
            continue;
        }
        if (key === 'Anchor') {
            for (const a of toArray(value))
                frame.anchors.push(parseAnchor(a));
            continue;
        }
        if (key === 'Animation') {
            for (const a of toArray(value)) {
                const aName = attr(a, 'name');
                if (aName !== undefined)
                    frame.animations.push({ name: aName });
            }
            continue;
        }
        for (const p of toArray(value)) {
            const prop = parseProperty(key, p);
            frame.properties.push(prop);
            collectReferences(prop, path, references);
        }
    }
    return frame;
}
function parseAnchor(node) {
    const attrs = attrsOf(node);
    return {
        ...(attrs['side'] !== undefined ? { side: attrs['side'] } : {}),
        ...(attrs['relative'] !== undefined ? { relative: attrs['relative'] } : {}),
        ...(attrs['pos'] !== undefined ? { pos: attrs['pos'] } : {}),
        ...(attrs['offset'] !== undefined ? { offset: attrs['offset'] } : {}),
        attrs,
    };
}
function parseProperty(name, node) {
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
        return { name, val: String(node), attrs: { val: String(node) } };
    }
    const attrs = attrsOf(node);
    return {
        name,
        ...(attrs['val'] !== undefined ? { val: attrs['val'] } : {}),
        attrs,
    };
}
function collectReferences(prop, framePath, out) {
    for (const value of Object.values(prop.attrs)) {
        const ref = parseReference(value, framePath, prop.name);
        if (ref)
            out.push(ref);
    }
}
export function parseReference(value, framePath, property) {
    const literal = value.startsWith('*');
    const afterStar = literal ? value.slice(1) : value;
    if (!afterStar.startsWith('@'))
        return undefined;
    const prefix = afterStar.startsWith('@@') ? '@@' : '@';
    const body = afterStar.slice(prefix.length);
    if (body.length === 0)
        return undefined;
    const slash = body.indexOf('/');
    const namespace = slash === -1 ? body : body.slice(0, slash);
    return { raw: value, prefix, value: body, namespace, frame: framePath, property };
}
function stripXmlDecl(raw) {
    const out = {};
    for (const [k, v] of Object.entries(raw)) {
        if (k === '?xml' || k.startsWith('?'))
            continue;
        out[k] = v;
    }
    return out;
}
function toArray(value) {
    if (value === undefined || value === null)
        return [];
    return Array.isArray(value) ? value : [value];
}
function attr(node, name) {
    if (typeof node !== 'object' || node === null)
        return undefined;
    const v = node[`@_${name}`];
    return v !== undefined ? String(v) : undefined;
}
function attrsOf(node) {
    const out = {};
    if (typeof node !== 'object' || node === null)
        return out;
    for (const [k, v] of Object.entries(node)) {
        if (k.startsWith('@_'))
            out[k.slice(2)] = String(v);
    }
    return out;
}

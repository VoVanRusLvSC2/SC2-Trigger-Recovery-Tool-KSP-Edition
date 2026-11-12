import { parseXmlDocument } from '../../shared/xml-document.js';
function document(text) {
    return { uri: 'memory://TriggerData', languageId: 'sc2-triggers', version: 1, text };
}
async function parse(text, bounds, signal) {
    const parsed = await parseXmlDocument(document(text), bounds, signal);
    if (parsed.diagnostics.length > 0) {
        throw new TypeError(`TriggerData XML is not structurally editable: ${parsed.diagnostics[0]?.message}`);
    }
    return parsed;
}
function triggerRoot(parsed) {
    const roots = parsed.roots.filter(node => node.tag === 'TriggerData' || node.tag === 'TriggerLib');
    if (roots.length !== 1 || parsed.roots.length !== 1) {
        throw new TypeError('TriggerData must contain exactly one TriggerData or TriggerLib root');
    }
    return roots[0];
}
function libraries(parsed) {
    const root = triggerRoot(parsed);
    const declared = root.children
        .filter(node => node.tag === 'Library')
        .map(node => ({ id: node.attributes['Id'] ?? '', node }));
    if (declared.some(item => item.id.length === 0))
        throw new TypeError('A Library is missing its Id');
    return declared.length === 0 ? [{ id: 'Map', node: root }] : declared;
}
function libraryOf(parsed, id) {
    const matches = libraries(parsed).filter(item => item.id === id);
    if (matches.length === 0)
        throw new RangeError(`Trigger library ${id} was not found`);
    if (matches.length > 1)
        throw new TypeError(`Trigger library ${id} is ambiguous`);
    return matches[0];
}
function elementNodes(parsed) {
    return libraries(parsed).flatMap(library => library.node.children
        .filter(node => node.tag === 'Element')
        .map(node => ({ library: library.id, node })));
}
function findElement(parsed, query) {
    const matches = elementNodes(parsed).filter(item => item.node.attributes['Id'] === query.id &&
        (query.library === undefined || item.library === query.library) &&
        (query.type === undefined || item.node.attributes['Type'] === query.type));
    if (matches.length === 0)
        throw new RangeError(`Trigger element ${query.id} was not found`);
    if (matches.length > 1) {
        throw new TypeError(`Trigger element ${query.id} is ambiguous; specify its library and type`);
    }
    const found = matches[0];
    const type = found.node.attributes['Type'];
    if (type === undefined || type.length === 0)
        throw new TypeError(`Trigger element ${query.id} has no Type`);
    if (found.node.end === undefined)
        throw new TypeError(`Trigger element ${query.id} is not closed`);
    return { ...found, id: query.id, type };
}
export async function getTriggerTreeElement(text, query, bounds, signal) {
    const found = findElement(await parse(text, bounds, signal), query);
    return {
        id: found.id,
        type: found.type,
        library: found.library,
        source: text.slice(found.node.start, found.node.end),
        startOffset: found.node.start,
        endOffset: found.node.end,
    };
}
function lineStart(text, offset) {
    const lf = text.lastIndexOf('\n', Math.max(0, offset - 1));
    const cr = text.lastIndexOf('\r', Math.max(0, offset - 1));
    return Math.max(lf, cr) + 1;
}
function lineEnding(text) {
    return text.includes('\r\n') ? '\r\n' : text.includes('\r') ? '\r' : '\n';
}
function deletionRange(text, start, end) {
    const startOfLine = lineStart(text, start);
    if (text.slice(startOfLine, start).trim().length !== 0)
        return { start, end };
    const rest = text.slice(end);
    const match = /^[\t ]*(?:\r\n|\r|\n)/u.exec(rest);
    return match === null ? { start, end } : { start: startOfLine, end: end + match[0].length };
}
function escapeXmlText(value) {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
function indentFragment(fragment, indent, newline) {
    const normalized = fragment.trim().replaceAll('\r\n', '\n').replaceAll('\r', '\n');
    const lines = normalized.split('\n');
    const widths = lines.slice(1).filter(line => line.trim().length > 0)
        .map(line => /^[\t ]*/u.exec(line)?.[0].length ?? 0);
    const trimWidth = widths.length === 0 ? 0 : Math.min(...widths);
    return lines.map((line, index) => `${indent}${index === 0 ? line : line.slice(trimWidth)}`).join(newline);
}
function insertionPoint(text, library, before) {
    const anchor = before?.start ?? library.closeStart;
    if (anchor === undefined)
        throw new TypeError('Target library is not closed');
    const start = lineStart(text, anchor);
    const prefix = text.slice(start, anchor);
    const position = prefix.trim().length === 0 ? start : anchor;
    const libraryIndent = text.slice(lineStart(text, library.start), library.start);
    const sibling = before ?? library.children.find(node => node.tag === 'Element');
    const siblingPrefix = sibling === undefined
        ? ''
        : text.slice(lineStart(text, sibling.start), sibling.start);
    const indent = siblingPrefix.trim().length === 0 && siblingPrefix.length > libraryIndent.length
        ? siblingPrefix
        : `${libraryIndent}  `;
    return { position, indent };
}
async function validatedFragment(elementXml, bounds, signal) {
    const source = elementXml.trim();
    if (source.length === 0)
        throw new TypeError('elementXml must not be empty');
    const parsed = await parse(source, {
        ...bounds,
        maxChars: Math.min(bounds.maxChars, elementXml.length + 1),
    }, signal);
    if (parsed.roots.length !== 1 || parsed.roots[0]?.tag !== 'Element' ||
        parsed.roots[0].start !== 0 || parsed.roots[0].end !== source.length) {
        throw new TypeError('elementXml must contain exactly one Element root');
    }
    const node = parsed.roots[0];
    const id = node.attributes['Id'];
    const type = node.attributes['Type'];
    if (id === undefined || id.length === 0 || type === undefined || type.length === 0) {
        throw new TypeError('elementXml requires non-empty Id and Type attributes');
    }
    return { xml: source, id, type };
}
async function insertElement(text, edit, bounds, signal) {
    const parsed = await parse(text, bounds, signal);
    const target = libraryOf(parsed, edit.library);
    const fragment = await validatedFragment(edit.elementXml, bounds, signal);
    if (elementNodes(parsed).some(item => item.library === edit.library && item.node.attributes['Id'] === fragment.id &&
        item.node.attributes['Type'] === fragment.type))
        throw new TypeError(`Trigger element ${fragment.type}/${fragment.id} already exists in ${edit.library}`);
    const before = edit.beforeId === undefined ? undefined : findElement(parsed, {
        id: edit.beforeId,
        library: edit.library,
        ...(edit.beforeType === undefined ? {} : { type: edit.beforeType }),
    }).node;
    const newline = lineEnding(text);
    const point = insertionPoint(text, target.node, before);
    const inserted = `${indentFragment(fragment.xml, point.indent, newline)}${newline}`;
    return {
        xml: `${text.slice(0, point.position)}${inserted}${text.slice(point.position)}`,
        element: { id: fragment.id, type: fragment.type, library: edit.library },
    };
}
function parseEdit(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('tree edit requires an object input');
    }
    const value = input;
    if (!['parameter-update', 'element-insert', 'element-move', 'element-delete'].includes(String(value['action']))) {
        throw new TypeError('tree edit action is invalid');
    }
    const action = value['action'];
    const string = (name, optional = false, allowEmpty = false) => {
        const item = value[name];
        if (optional && item === undefined)
            return undefined;
        if (typeof item !== 'string' || (!allowEmpty && item.length === 0)) {
            throw new TypeError(`tree edit ${name} must be ${optional ? 'a string' : 'a non-empty string'}`);
        }
        return item;
    };
    const element = () => {
        const raw = value['element'];
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
            throw new TypeError('tree edit element must be an object');
        }
        const item = raw;
        if (typeof item['id'] !== 'string' || item['id'].length === 0) {
            throw new TypeError('tree edit element.id must be a non-empty string');
        }
        if (item['library'] !== undefined &&
            (typeof item['library'] !== 'string' || item['library'].length === 0)) {
            throw new TypeError('tree edit element.library must be a non-empty string');
        }
        if (item['type'] !== undefined && typeof item['type'] !== 'string') {
            throw new TypeError('tree edit element.type must be a string');
        }
        return item;
    };
    if (action === 'parameter-update') {
        const valueText = string('value', false, true);
        const valueIndex = value['valueIndex'];
        if (valueIndex !== undefined && (!Number.isSafeInteger(valueIndex) || Number(valueIndex) < 0)) {
            throw new RangeError('tree edit valueIndex must be a non-negative integer');
        }
        return { action, element: element(), value: valueText, ...(valueIndex === undefined ? {} : { valueIndex: Number(valueIndex) }) };
    }
    if (action === 'element-insert') {
        const beforeId = string('beforeId', true);
        return { action, library: string('library'), elementXml: string('elementXml'), ...(beforeId === undefined ? {} : { beforeId, beforeType: string('beforeType', true) }) };
    }
    if (action === 'element-move') {
        const beforeId = string('beforeId', true);
        return { action, element: element(), library: string('library'), ...(beforeId === undefined ? {} : { beforeId, beforeType: string('beforeType', true) }) };
    }
    return { action, element: element() };
}
export async function editTriggerTree(text, input, bounds, signal) {
    const edit = parseEdit(input);
    const parsed = await parse(text, bounds, signal);
    if (edit.action === 'parameter-update') {
        const found = findElement(parsed, edit.element);
        const values = found.node.children.filter(node => node.tag === 'Value');
        const target = values[edit.valueIndex ?? 0];
        if (target === undefined || target.closeStart === undefined) {
            throw new RangeError(`Trigger element ${found.id} has no requested Value field`);
        }
        const replacement = escapeXmlText(edit.value);
        const xml = `${text.slice(0, target.openEnd)}${replacement}${text.slice(target.closeStart)}`;
        return { xml, action: edit.action, changed: xml !== text, element: { id: found.id, type: found.type, library: found.library } };
    }
    if (edit.action === 'element-delete') {
        const found = findElement(parsed, edit.element);
        const range = deletionRange(text, found.node.start, found.node.end);
        const xml = `${text.slice(0, range.start)}${text.slice(range.end)}`;
        return { xml, action: edit.action, changed: true, element: { id: found.id, type: found.type, library: found.library } };
    }
    if (edit.action === 'element-insert') {
        const result = await insertElement(text, edit, bounds, signal);
        return { ...result, action: edit.action, changed: true };
    }
    const found = findElement(parsed, edit.element);
    if (edit.beforeId === found.id && edit.library === found.library &&
        (edit.beforeType === undefined || edit.beforeType === found.type)) {
        return { xml: text, action: edit.action, changed: false, element: { id: found.id, type: found.type, library: found.library } };
    }
    const range = deletionRange(text, found.node.start, found.node.end);
    const fragment = text.slice(found.node.start, found.node.end);
    const without = `${text.slice(0, range.start)}${text.slice(range.end)}`;
    const result = await insertElement(without, {
        action: 'element-insert',
        library: edit.library,
        elementXml: fragment,
        ...(edit.beforeId === undefined ? {} : { beforeId: edit.beforeId, beforeType: edit.beforeType }),
    }, bounds, signal);
    return { ...result, action: edit.action, changed: result.xml !== text };
}

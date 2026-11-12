const XML_NAME = /^[A-Za-z_][\w:.-]*$/u;
const ENTITY = /&(?:#(x[\da-f]+|\d+)|([A-Za-z]+));/giu;
/**
 * @typedef {object} XmlAttribute
 * @property {string} name
 * @property {string} value
 * @property {number} nameStart
 * @property {number} nameEnd
 * @property {number} valueStart
 * @property {number} valueEnd
 */
/**
 * @typedef {object} XmlNode
 * @property {string} tag
 * @property {Readonly<Record<string, string>>} attributes
 * @property {readonly XmlAttribute[]} attributeEntries
 * @property {number} start
 * @property {number} openEnd
 * @property {number | undefined} closeStart
 * @property {number | undefined} end
 * @property {XmlNode[]} children
 */
const checkpoint = async (signal) => {
    signal?.throwIfAborted();
    await new Promise(resolve => setTimeout(resolve, 0));
    signal?.throwIfAborted();
};
function decodeEntity(source) {
    return source.replace(ENTITY, (raw, numeric, named) => {
        if (numeric !== undefined) {
            const radix = numeric[0]?.toLowerCase() === 'x' ? 16 : 10;
            const body = radix === 16 ? numeric.slice(1) : numeric;
            const codePoint = Number.parseInt(body, radix);
            return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
                ? String.fromCodePoint(codePoint)
                : raw;
        }
        return { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"' }[named.toLowerCase()] ?? raw;
    });
}
export function lineMap(text) {
    const starts = [0];
    for (let offset = 0; offset < text.length; offset += 1) {
        if (text[offset] === '\n')
            starts.push(offset + 1);
    }
    return Object.freeze(starts);
}
export function positionAt(starts, offset) {
    let low = 0;
    let high = starts.length - 1;
    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        if (starts[middle] <= offset)
            low = middle + 1;
        else
            high = middle - 1;
    }
    const line = Math.max(0, high);
    return Object.freeze({ line, character: Math.max(0, offset - starts[line]) });
}
export const rangeAt = (starts, start, end) => Object.freeze({ start: positionAt(starts, start), end: positionAt(starts, end) });
export function offsetAt(document, position) {
    const starts = lineMap(document.text);
    const start = starts[position.line];
    if (start === undefined || !Number.isSafeInteger(position.character) || position.character < 0) {
        throw new RangeError('SC2Layout position is outside the document');
    }
    const rawEnd = document.text.indexOf('\n', start);
    const lineEnd = rawEnd < 0 ? document.text.length : rawEnd;
    const contentEnd = lineEnd > start && document.text[lineEnd - 1] === '\r' ? lineEnd - 1 : lineEnd;
    if (position.character > contentEnd - start) {
        throw new RangeError('SC2Layout position is outside the document');
    }
    return start + position.character;
}
function parseAttributes(source, absoluteStart, diagnostics) {
    const attributes = Object.create(null);
    const entries = [];
    let offset = 0;
    while (offset < source.length) {
        while (/\s/u.test(source[offset] ?? ''))
            offset += 1;
        if (offset >= source.length)
            break;
        const nameMatch = source.slice(offset).match(/^[A-Za-z_][\w:.-]*/u);
        if (nameMatch === null) {
            diagnostics.push({
                code: 'sc2-layout/xml-attribute',
                severity: 'error',
                message: 'Invalid XML attribute syntax.',
                start: absoluteStart + offset,
                end: absoluteStart + Math.min(source.length, offset + 1),
            });
            break;
        }
        const name = nameMatch[0];
        const nameStart = absoluteStart + offset;
        offset += name.length;
        while (/\s/u.test(source[offset] ?? ''))
            offset += 1;
        if (source[offset] !== '=') {
            diagnostics.push({
                code: 'sc2-layout/xml-attribute-value',
                severity: 'error',
                message: `Attribute ${name} requires a quoted value.`,
                start: nameStart,
                end: nameStart + name.length,
            });
            continue;
        }
        offset += 1;
        while (/\s/u.test(source[offset] ?? ''))
            offset += 1;
        const quote = source[offset];
        if (quote !== '"' && quote !== "'") {
            diagnostics.push({
                code: 'sc2-layout/xml-attribute-quote',
                severity: 'error',
                message: `Attribute ${name} requires quotes.`,
                start: absoluteStart + offset,
                end: absoluteStart + Math.min(source.length, offset + 1),
            });
            continue;
        }
        offset += 1;
        const valueStart = absoluteStart + offset;
        const close = source.indexOf(quote, offset);
        const valueEnd = absoluteStart + (close < 0 ? source.length : close);
        const rawValue = source.slice(offset, close < 0 ? source.length : close);
        const entry = Object.freeze({
            name,
            value: decodeEntity(rawValue),
            nameStart,
            nameEnd: nameStart + name.length,
            valueStart,
            valueEnd,
        });
        if (Object.hasOwn(attributes, name)) {
            diagnostics.push({
                code: 'sc2-layout/xml-duplicate-attribute',
                severity: 'error',
                message: `Attribute ${name} is declared more than once.`,
                start: nameStart,
                end: nameStart + name.length,
            });
        }
        attributes[name] = entry.value;
        entries.push(entry);
        offset = close < 0 ? source.length : close + 1;
    }
    return { attributes: Object.freeze(attributes), attributeEntries: Object.freeze(entries) };
}
function findTagClose(text, start) {
    let quote;
    for (let offset = start; offset < text.length; offset += 1) {
        const current = text[offset];
        if (quote !== undefined) {
            if (current === quote)
                quote = undefined;
            continue;
        }
        if (current === '"' || current === "'")
            quote = current;
        else if (current === '>')
            return offset;
    }
    return -1;
}
function diagnostic(code, message, start, end) {
    return Object.freeze({ code, message, severity: 'error', start, end });
}
/** Bounded dependency-free XML parser retaining exact source and attribute ranges. */
export async function parseXmlDocument(document, bounds, signal) {
    signal?.throwIfAborted();
    const text = document.text;
    if (text.length > bounds.maxChars)
        throw new RangeError('SC2Layout document exceeds maxChars');
    const roots = [];
    const stack = [];
    const diagnostics = [];
    let nodes = 0;
    let cursor = 0;
    let scanned = 0;
    while (cursor < text.length) {
        const open = text.indexOf('<', cursor);
        if (open < 0)
            break;
        if (text.startsWith('<!--', open)) {
            const close = text.indexOf('-->', open + 4);
            if (close < 0) {
                diagnostics.push(diagnostic('sc2-layout/xml-comment', 'Unclosed XML comment.', open, text.length));
                break;
            }
            cursor = close + 3;
            continue;
        }
        if (text.startsWith('<![CDATA[', open)) {
            const close = text.indexOf(']]>', open + 9);
            if (close < 0) {
                diagnostics.push(diagnostic('sc2-layout/xml-cdata', 'Unclosed CDATA section.', open, text.length));
                break;
            }
            cursor = close + 3;
            continue;
        }
        if (text.startsWith('<?', open)) {
            const close = text.indexOf('?>', open + 2);
            if (close < 0) {
                diagnostics.push(diagnostic('sc2-layout/xml-declaration', 'Unclosed XML declaration.', open, text.length));
                break;
            }
            cursor = close + 2;
            continue;
        }
        const close = findTagClose(text, open + 1);
        if (close < 0) {
            diagnostics.push(diagnostic('sc2-layout/xml-tag', 'Unclosed XML tag.', open, text.length));
            break;
        }
        const inside = text.slice(open + 1, close);
        if (inside.startsWith('!')) {
            cursor = close + 1;
            continue;
        }
        if (inside.startsWith('/')) {
            const name = inside.slice(1).trim();
            const current = stack.pop();
            if (current === undefined || current.tag !== name) {
                diagnostics.push(diagnostic('sc2-layout/xml-close', `Unexpected closing tag ${name}.`, open, close + 1));
                if (current !== undefined)
                    stack.push(current);
            }
            else {
                current.closeStart = open;
                current.end = close + 1;
            }
            cursor = close + 1;
            continue;
        }
        const selfClosing = /\/\s*$/u.test(inside);
        const body = selfClosing ? inside.replace(/\/\s*$/u, '') : inside;
        const nameMatch = body.match(/^\s*([A-Za-z_][\w:.-]*)/u);
        if (nameMatch === null || !XML_NAME.test(nameMatch[1])) {
            diagnostics.push(diagnostic('sc2-layout/xml-name', 'Invalid XML element name.', open, close + 1));
            cursor = close + 1;
            continue;
        }
        const tag = nameMatch[1];
        const tagOffset = body.indexOf(tag);
        const attrsStart = tagOffset + tag.length;
        const parsedAttributes = parseAttributes(body.slice(attrsStart), open + 1 + attrsStart, diagnostics);
        nodes += 1;
        if (nodes > bounds.maxNodes)
            throw new RangeError('SC2Layout nodes exceed maxNodes');
        if (stack.length + 1 > bounds.maxDepth)
            throw new RangeError('SC2Layout depth exceeds maxDepth');
        const node = {
            tag,
            ...parsedAttributes,
            start: open,
            openEnd: close + 1,
            closeStart: selfClosing ? close : undefined,
            end: selfClosing ? close + 1 : undefined,
            children: [],
        };
        const parent = stack.at(-1);
        if (parent === undefined)
            roots.push(node);
        else
            parent.children.push(node);
        if (!selfClosing)
            stack.push(node);
        cursor = close + 1;
        scanned += close + 1 - open;
        if (scanned >= 64 * 1024) {
            scanned = 0;
            await checkpoint(signal);
        }
    }
    for (const node of stack.reverse()) {
        node.end = text.length;
        diagnostics.push(diagnostic('sc2-layout/xml-unclosed', `Element ${node.tag} is not closed.`, node.start, node.openEnd));
    }
    signal?.throwIfAborted();
    return Object.freeze({
        document,
        roots: Object.freeze(roots),
        diagnostics: Object.freeze(diagnostics.slice(0, bounds.maxDiagnostics)),
        diagnosticsIncomplete: diagnostics.length > bounds.maxDiagnostics,
        nodeCount: nodes,
        starts: lineMap(text),
    });
}
export function walkElements(nodes, visit) {
    for (const node of nodes) {
        visit(node);
        walkElements(node.children, visit);
    }
}
/** @returns {XmlNode | undefined} */
export function nodeAtOffset(parsed, offset) {
    /** @type {XmlNode | undefined} */
    let found = undefined;
    walkElements(parsed.roots, node => {
        // XML source ranges are half-open. Treating `end` as inclusive makes the whitespace directly
        // after a self-closing field belong to that field and gives completions for the wrong node.
        if (node.start <= offset && (node.end ?? node.openEnd) > offset) {
            if (found === undefined || node.start >= found.start)
                found = node;
        }
    });
    return found;
}
export function attributeAtOffset(node, offset) {
    return node?.attributeEntries.find(entry => entry.nameStart <= offset && offset <= entry.valueEnd + 1);
}

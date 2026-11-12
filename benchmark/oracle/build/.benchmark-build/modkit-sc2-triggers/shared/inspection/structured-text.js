const utf8 = new TextDecoder('utf-8', { fatal: true });
export function decodeStructuredText(bytes, budget, label) {
    if (bytes.byteLength > budget.maxScalarBytes) {
        throw new RangeError(`${label} text exceeds maxScalarBytes budget`);
    }
    if (bytes.includes(0))
        throw new TypeError(`${label} contains a NUL byte`);
    try {
        return utf8.decode(bytes);
    }
    catch {
        throw new TypeError(`${label} is not valid UTF-8`);
    }
}
export function lineCount(text) {
    return text === '' ? 0 : text.split(/\r\n|\r|\n/u).length;
}
/**
 * Build a table data source over already-rendered rows.
 *
 * `facts` is optional and, when given, is consulted per cell for the schema half of `CellFacts`:
 * the typed value, its field type and whether it may be written. A caller that supplies nothing
 * gets the read-only table it has always had — the surface offers editing only where a codec
 * published a type and a write declaration, and never guesses one from the rendered text.
 */
export function createTableDataSource(header, values, facts) {
    const rows = Object.freeze(values.map((cells, index) => Object.freeze({ index, cells: Object.freeze(cells.map(value => String(value))) })));
    const pageFrom = request => {
        if (!Number.isSafeInteger(request.count) || request.count <= 0) {
            throw new TypeError('table page count must be a positive safe integer');
        }
        if (request.kind === 'range') {
            if (!Number.isSafeInteger(request.from) || request.from < 0) {
                throw new TypeError('table range start must be a non-negative safe integer');
            }
            return request.from;
        }
        const value = Number(request.cursor);
        if (!Number.isSafeInteger(value) || value < 0)
            throw new TypeError('table cursor is invalid');
        return value;
    };
    return Object.freeze({
        async shape() {
            return Object.freeze({
                rows: rows.length,
                columns: header.length,
                header: Object.freeze([...header]),
            });
        },
        async rows(request, signal) {
            if (signal?.aborted)
                throw new DOMException('operation cancelled', 'AbortError');
            const start = pageFrom(request);
            const items = rows.slice(start, start + request.count);
            return Object.freeze({
                items: Object.freeze(items),
                ...(start + items.length < rows.length ? { nextCursor: String(start + items.length) } : {}),
            });
        },
        async cell(coord) {
            if (!Number.isSafeInteger(coord.row) || !Number.isSafeInteger(coord.column)) {
                throw new TypeError('table cell coordinate is invalid');
            }
            const value = rows[coord.row]?.cells[coord.column];
            if (value === undefined)
                throw new RangeError('table cell is outside the data');
            const extra = facts === undefined ? undefined : facts(coord.row, coord.column);
            return Object.freeze(extra === undefined ? { value } : { value, ...extra });
        },
        async *search(query, signal) {
            const needle = query.pattern.toLocaleLowerCase();
            for (const row of rows) {
                for (let column = 0; column < row.cells.length; column += 1) {
                    if (signal?.aborted)
                        throw new DOMException('operation cancelled', 'AbortError');
                    if (row.cells[column].toLocaleLowerCase().includes(needle)) {
                        yield Object.freeze({ row: row.index, column });
                    }
                }
            }
        },
    });
}
function attributesOf(source) {
    const attributes = {};
    for (const match of source.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)) {
        attributes[match[1]] = match[2] ?? match[3] ?? '';
    }
    return Object.freeze(attributes);
}
export function parseXmlElements(text, budget, expectedRoot, label) {
    const source = text.replace(/<!--[\s\S]*?-->/gu, '');
    const elements = [];
    const stack = [];
    for (const match of source.matchAll(/<\/?([A-Za-z_][\w:.-]*)([^<>]*?)>/gu)) {
        const closing = source[match.index + 1] === '/';
        const name = match[1];
        if (closing) {
            if (stack.pop() !== name)
                throw new TypeError(`${label} XML element nesting is invalid`);
            continue;
        }
        if (elements.length >= budget.maxNodes) {
            throw new RangeError(`${label} elements exceed maxNodes budget`);
        }
        const tail = match[2] ?? '';
        const selfClosing = /\/\s*$/u.test(tail);
        elements.push(Object.freeze({
            index: elements.length,
            name,
            depth: stack.length,
            attributes: attributesOf(tail),
        }));
        if (!selfClosing) {
            stack.push(name);
            if (stack.length > budget.maxDepth) {
                throw new RangeError(`${label} nesting exceeds maxDepth budget`);
            }
        }
    }
    if (stack.length !== 0)
        throw new TypeError(`${label} XML document is not closed`);
    if (elements[0]?.name !== expectedRoot)
        throw new TypeError(`${label} root must be ${expectedRoot}`);
    return Object.freeze(elements);
}

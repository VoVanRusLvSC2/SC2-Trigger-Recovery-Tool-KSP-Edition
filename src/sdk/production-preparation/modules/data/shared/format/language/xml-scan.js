/**
 * A small, position-aware XML scanner for SC2 GameData documents.
 *
 * `@modkitx/xml`'s `parseCatalogXml` uses fast-xml-parser and discards source
 * offsets, so it can't drive editor features that need ranges (diagnostics,
 * completion, hover). This scanner produces an element tree where every tag and
 * attribute value carries its character offset into the source text. It is
 * deliberately lenient — it never throws on malformed input, it just scans what
 * it can — because it runs on documents that are mid-edit.
 *
 * It is NOT a general XML parser: it ignores text content, entities, and
 * namespaces, which GameData XML does not use in ways that matter here.
 */
const NAME_CHAR = /[A-Za-z0-9_:.-]/;
/** Parse the contents of one `<...>` opening/self-closing tag starting at `lt`. */
function readTag(text, lt) {
    let i = lt + 1;
    let closing = false;
    if (text[i] === '/') {
        closing = true;
        i++;
    }
    const tagStart = i;
    while (i < text.length && NAME_CHAR.test(text[i]))
        i++;
    if (i === tagStart)
        return undefined; // not a tag (e.g. a stray '<')
    const tag = text.slice(tagStart, i);
    const tagEnd = i;
    const attrs = [];
    let selfClosing = false;
    // Walk to the matching '>', collecting attributes, respecting quoted values.
    while (i < text.length) {
        const ch = text[i];
        if (ch === '>') {
            i++;
            break;
        }
        if (ch === '/' && text[i + 1] === '>') {
            selfClosing = true;
            i += 2;
            break;
        }
        // An unquoted '<' means the tag was never closed (mid-edit) — stop here rather
        // than greedily consuming the following markup into this tag.
        if (ch === '<')
            break;
        if (NAME_CHAR.test(ch)) {
            const nameStart = i;
            while (i < text.length && NAME_CHAR.test(text[i]))
                i++;
            const name = text.slice(nameStart, i);
            const nameEnd = i;
            while (i < text.length && /\s/.test(text[i]))
                i++;
            if (text[i] === '=') {
                i++;
                while (i < text.length && /\s/.test(text[i]))
                    i++;
                const quote = text[i];
                if (quote === '"' || quote === "'") {
                    const valueStart = i + 1;
                    const close = text.indexOf(quote, valueStart);
                    const valueEnd = close === -1 ? text.length : close;
                    attrs.push({
                        name,
                        nameStart,
                        nameEnd,
                        value: text.slice(valueStart, valueEnd),
                        valueStart,
                        valueEnd,
                    });
                    i = close === -1 ? text.length : close + 1;
                }
            }
            continue;
        }
        i++;
    }
    return {
        open: { tag, tagStart, tagEnd, attrs, openEnd: i, selfClosing },
        next: i,
        closing,
    };
}
/**
 * Scan the document into a forest of `ScannedElement`s (the top-level catalog
 * entities). Children are nested. Robust to malformed/incomplete markup.
 */
export function scanXml(text) {
    const roots = [];
    const stack = [];
    let i = 0;
    const attach = (el) => {
        const parent = stack[stack.length - 1];
        if (parent)
            parent.el.children.push(el);
        else
            roots.push(el);
    };
    while (i < text.length) {
        const lt = text.indexOf('<', i);
        if (lt === -1)
            break;
        // Skip comments / CDATA / DOCTYPE / processing instructions.
        if (text.startsWith('<!--', lt)) {
            const e = text.indexOf('-->', lt + 4);
            i = e === -1 ? text.length : e + 3;
            continue;
        }
        if (text.startsWith('<![CDATA[', lt)) {
            const e = text.indexOf(']]>', lt + 9);
            i = e === -1 ? text.length : e + 3;
            continue;
        }
        if (text.startsWith('<?', lt)) {
            const e = text.indexOf('?>', lt + 2);
            i = e === -1 ? text.length : e + 2;
            continue;
        }
        if (text.startsWith('<!', lt)) {
            const e = text.indexOf('>', lt + 2);
            i = e === -1 ? text.length : e + 1;
            continue;
        }
        const parsed = readTag(text, lt);
        if (!parsed) {
            i = lt + 1;
            continue;
        }
        if (parsed.closing) {
            // Pop the matching open element (search from the top for resilience). Any
            // dangling open children above it (mid-edit, never closed) extend to EOF so a
            // cursor inside them is still found.
            for (let s = stack.length - 1; s >= 0; s--) {
                if (stack[s].tag === parsed.open.tag) {
                    for (let k = s + 1; k < stack.length; k++)
                        stack[k].el.end = text.length;
                    stack[s].el.end = parsed.next;
                    stack.length = s;
                    break;
                }
            }
            i = parsed.next;
            continue;
        }
        const { open } = parsed;
        const el = {
            tag: open.tag,
            tagStart: open.tagStart,
            tagEnd: open.tagEnd,
            start: lt,
            end: open.openEnd,
            openEnd: open.openEnd,
            attrs: open.attrs,
            children: [],
        };
        attach(el);
        if (!open.selfClosing)
            stack.push({ el, tag: open.tag });
        i = parsed.next;
    }
    // Elements left open at EOF (mid-edit / unclosed) extend to the end of the text,
    // so a cursor inside them is correctly found as contained.
    for (const s of stack)
        s.el.end = text.length;
    return roots;
}
/** Find the attribute named `name` (case-sensitive), if present. */
export function getAttr(el, name) {
    return el.attrs.find(a => a.name === name);
}
/**
 * Path of elements from the root entity down to the deepest one containing `offset`.
 * Containment is half-open `(start, end)`: a cursor exactly at an element's `<` is
 * "before" it, and one at a self-closed element's trailing boundary is "after" it —
 * so `<Foo/>|` lands in the parent's content, not inside `Foo`.
 */
export function elementPathAt(text, offset) {
    return pathTo(scanXml(text), offset, []);
}
function pathTo(els, offset, acc) {
    for (const el of els) {
        if (offset > el.start && offset < el.end) {
            acc.push(el);
            pathTo(el.children, offset, acc);
            return acc;
        }
    }
    return acc;
}
/** The attribute whose value span contains `offset`, if any. */
export function attrAt(el, offset) {
    return el.attrs.find(a => offset >= a.valueStart && offset <= a.valueEnd);
}
//# sourceMappingURL=xml-scan.js.map
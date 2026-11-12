/**
 * `sc2-data` surgical catalog-XML write-back (Spec 5,
 * docs/tasks-complete/entity-cards-strings/WRITEBACK_CONTRACT.md).
 *
 * `patchCatalogField` changes ONLY the targeted value inside the original source text:
 * span replacement over the input string, never a re-serialize — untouched bytes stay
 * byte-identical (same philosophy as `patchBankValueXml` and the strings line-model).
 *
 * Supported physical forms:
 *   1. `<LifeMax value="45"/>`                       — path `LifeMax`
 *   2. `<WeaponArray index="0" Link="Gauss"/>`       — path `WeaponArray.0.Link`
 *   3. `<Cost><Cooldown TimeUse="10"/></Cost>`       — path `Cost.0.Cooldown.TimeUse`
 * plus insert-if-missing (setting a field the entity doesn't have yet) and clearing
 * (`newValue === null` removes the field element / attribute).
 */
const NAME_RE = /[A-Za-z_][\w.:-]*/y;
const WS = /[ \t\r\n]/;
function parseAttrs(xml, pos) {
    const attrs = [];
    for (;;) {
        while (pos < xml.length && WS.test(xml[pos]))
            pos++;
        const c = xml[pos];
        if (c === undefined)
            return undefined;
        if (c === '>')
            return { attrs, tagEnd: pos + 1, selfClosing: false };
        if (c === '/' && xml[pos + 1] === '>')
            return { attrs, tagEnd: pos + 2, selfClosing: true };
        NAME_RE.lastIndex = pos;
        const nameMatch = NAME_RE.exec(xml);
        if (!nameMatch)
            return undefined;
        const attrStart = pos;
        const name = nameMatch[0];
        pos += name.length;
        while (pos < xml.length && WS.test(xml[pos]))
            pos++;
        if (xml[pos] !== '=') {
            attrs.push({ name, value: '', valStart: pos, valEnd: pos, start: attrStart, end: pos });
            continue;
        }
        pos++;
        while (pos < xml.length && WS.test(xml[pos]))
            pos++;
        const quote = xml[pos];
        if (quote !== '"' && quote !== "'")
            return undefined;
        const valStart = pos + 1;
        const valEnd = xml.indexOf(quote, valStart);
        if (valEnd < 0)
            return undefined;
        attrs.push({
            name,
            value: xml.slice(valStart, valEnd),
            valStart,
            valEnd,
            start: attrStart,
            end: valEnd + 1,
        });
        pos = valEnd + 1;
    }
}
/** Parse the element whose `<` is at `start`; returns undefined on malformed input. */
function parseElement(xml, start) {
    NAME_RE.lastIndex = start + 1;
    const nameMatch = NAME_RE.exec(xml);
    if (!nameMatch)
        return undefined;
    const name = nameMatch[0];
    const attrsParsed = parseAttrs(xml, start + 1 + name.length);
    if (!attrsParsed)
        return undefined;
    const { attrs, tagEnd, selfClosing } = attrsParsed;
    if (selfClosing)
        return { name, attrs, start, openEnd: tagEnd, innerEnd: tagEnd, end: tagEnd, selfClosing: true };
    // Walk content, skipping nested markup, until this element's closing tag.
    let pos = tagEnd;
    for (;;) {
        const lt = xml.indexOf('<', pos);
        if (lt < 0)
            return undefined;
        if (xml.startsWith('</', lt)) {
            const close = xml.indexOf('>', lt);
            if (close < 0)
                return undefined;
            return {
                name,
                attrs,
                start,
                openEnd: tagEnd,
                innerEnd: lt,
                end: close + 1,
                selfClosing: false,
            };
        }
        if (xml.startsWith('<!--', lt)) {
            const e = xml.indexOf('-->', lt);
            if (e < 0)
                return undefined;
            pos = e + 3;
            continue;
        }
        if (xml.startsWith('<![CDATA[', lt)) {
            const e = xml.indexOf(']]>', lt);
            if (e < 0)
                return undefined;
            pos = e + 3;
            continue;
        }
        if (xml.startsWith('<?', lt)) {
            const e = xml.indexOf('?>', lt);
            if (e < 0)
                return undefined;
            pos = e + 2;
            continue;
        }
        const child = parseElement(xml, lt);
        if (!child)
            return undefined;
        pos = child.end;
    }
}
/** Direct child elements between `from` and `to` (an element's content span). */
function childElements(xml, from, to) {
    const out = [];
    let pos = from;
    while (pos < to) {
        const lt = xml.indexOf('<', pos);
        if (lt < 0 || lt >= to)
            break;
        if (xml.startsWith('<!--', lt)) {
            const e = xml.indexOf('-->', lt);
            if (e < 0)
                break;
            pos = e + 3;
            continue;
        }
        if (xml.startsWith('<![CDATA[', lt)) {
            const e = xml.indexOf(']]>', lt);
            if (e < 0)
                break;
            pos = e + 3;
            continue;
        }
        if (xml.startsWith('<?', lt)) {
            const e = xml.indexOf('?>', lt);
            if (e < 0)
                break;
            pos = e + 2;
            continue;
        }
        if (xml.startsWith('</', lt))
            break;
        const child = parseElement(xml, lt);
        if (!child)
            break;
        out.push(child);
        pos = child.end;
    }
    return out;
}
/** All elements named `className` with `id="<id>"` anywhere in the document (last one wins). */
function findEntity(xml, className, id) {
    let found;
    const visit = (from, to) => {
        for (const el of childElements(xml, from, to)) {
            if (el.name === className && el.attrs.some(a => a.name === 'id' && a.value === id))
                found = el;
            else if (!el.selfClosing)
                visit(el.openEnd, el.innerEnd);
        }
    };
    visit(0, xml.length);
    return found;
}
// ─── path resolution ─────────────────────────────────────────────────────────
function escapeAttr(v) {
    return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
const MAX_STRUCTURED_ENTRY_DEPTH = 32;
const MAX_STRUCTURED_ENTRY_NODES = 4096;
const MAX_STRUCTURED_ENTRY_BYTES = 4 * 1024 * 1024;
const MAX_STRUCTURED_ENTRY_NAME_LENGTH = 256;
function structuredEntryMarker(name, indexKey, selector, value, baseIndent, step) {
    const state = { nodes: 0, bytes: 0 };
    const field = name => {
        if (!FIELD_SEGMENT_RE.test(name) || name.length > MAX_STRUCTURED_ENTRY_NAME_LENGTH) {
            throw new TypeError(`invalid XML field ${name}`);
        }
        state.nodes++;
        state.bytes += name.length;
        if (state.nodes > MAX_STRUCTURED_ENTRY_NODES || state.bytes > MAX_STRUCTURED_ENTRY_BYTES) {
            throw new RangeError('structured entry is too large');
        }
    };
    const scalar = item => {
        if (typeof item === 'number' && !Number.isFinite(item))
            throw new TypeError('non-finite number');
        if (typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean') {
            throw new TypeError('null and non-scalar XML attributes are unsupported');
        }
        const text = String(item);
        state.bytes += text.length;
        if (state.bytes > MAX_STRUCTURED_ENTRY_BYTES)
            throw new RangeError('structured entry is too large');
        return escapeAttr(text);
    };
    const element = (elementName, item, indent, depth, fixedAttributes = []) => {
        if (depth > MAX_STRUCTURED_ENTRY_DEPTH) {
            throw new RangeError('structured entry exceeds its depth or node limit');
        }
        field(elementName);
        const attributes = [...fixedAttributes];
        const children = [];
        for (const [key] of fixedAttributes)
            field(key);
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
            for (const [key, child] of Object.entries(item)) {
                if (!FIELD_SEGMENT_RE.test(key) || key === 'removed' || fixedAttributes.some(([name]) => name === key)) {
                    throw new TypeError(`invalid or reserved structured entry field ${key}`);
                }
                field(key);
                if (Array.isArray(child)) {
                    for (const entry of child)
                        children.push([key, entry]);
                }
                else if (child !== null && typeof child === 'object') {
                    children.push([key, child]);
                }
                else {
                    attributes.push([key, child]);
                }
            }
        }
        else {
            attributes.push(['value', item]);
        }
        const opening = `<${elementName}${attributes.map(([key, child]) => ` ${key}="${scalar(child)}"`).join('')}`;
        if (children.length === 0)
            return `${opening}/>`;
        const childIndent = `${indent}${step}`;
        const body = children.map(([key, child]) => `${childIndent}${element(key, child, childIndent, depth + 1)}`).join('\n');
        return `${opening}>\n${body}\n${indent}</${elementName}>`;
    };
    try {
        return { marker: element(name, value, baseIndent, 0, [[indexKey, selector]]) };
    }
    catch (error) {
        return { reason: error instanceof Error ? error.message : String(error) };
    }
}
function incompleteElementReplacementReason(xml, existing, value, ignoredAttributes, path) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return `structured indexed replacement must keep existing child '${path}' structured`;
    }
    const supplied = new Set(Object.keys(value));
    for (const attribute of existing.attrs) {
        if (ignoredAttributes.has(attribute.name) || attribute.name === 'removed')
            continue;
        if (!supplied.has(attribute.name)) {
            return `structured indexed replacement must include existing field '${path}.${attribute.name}'`;
        }
        const replacement = value[attribute.name];
        if (replacement === null || typeof replacement === 'object') {
            return `structured indexed replacement must keep existing attribute '${path}.${attribute.name}' scalar`;
        }
    }
    if (existing.selfClosing)
        return undefined;
    const children = childElements(xml, existing.openEnd, existing.innerEnd);
    const counts = new Map();
    let cursor = existing.openEnd;
    for (const child of children) {
        if (xml.slice(cursor, child.start).trim() !== '') {
            return 'structured indexed replacement cannot preserve mixed XML content';
        }
        if (!supplied.has(child.name)) {
            return `structured indexed replacement must include existing field '${path}.${child.name}'`;
        }
        const count = counts.get(child.name) ?? 0;
        const suppliedChild = value[child.name];
        const replacement = Array.isArray(suppliedChild) ? suppliedChild[count] : suppliedChild;
        if (replacement === undefined) {
            return `structured indexed replacement must include all existing '${path}.${child.name}' entries`;
        }
        const reason = incompleteElementReplacementReason(xml, child, replacement, new Set(), `${path}.${child.name}`);
        if (reason !== undefined) {
            return reason;
        }
        counts.set(child.name, count + 1);
        cursor = child.end;
    }
    if (xml.slice(cursor, existing.innerEnd).trim() !== '') {
        return 'structured indexed replacement cannot preserve mixed XML content';
    }
    for (const [name, count] of counts) {
        if (count > 1 && (!Array.isArray(value[name]) || value[name].length < count)) {
            return `structured indexed replacement must include all existing '${path}.${name}' entries`;
        }
    }
    return undefined;
}
function incompleteStructuredReplacementReason(xml, existing, indexKey, value) {
    return incompleteElementReplacementReason(xml, existing, value, new Set([indexKey]), existing.name);
}
function isSelector(seg) {
    return seg !== undefined && /^\d+$/.test(seg);
}
const FIELD_SEGMENT_RE = /^[A-Za-z_][\w.:-]*$/u;
function fieldSegments(fieldPath) {
    const segments = fieldPath
        .split('.')
        .map(segment => segment.trim())
        .filter(Boolean);
    if (segments.length === 0 ||
        segments.some(segment => !FIELD_SEGMENT_RE.test(segment) && !isSelector(segment))) {
        return undefined;
    }
    return segments;
}
/** Pick one of the same-named sibling elements by numeric selector / `index` attr / word index. */
function pickIndexed(siblings, selector) {
    const byAttr = siblings.find(s => s.attrs.some(a => a.name === 'index' && a.value.toLowerCase() === selector.toLowerCase()));
    if (byAttr)
        return byAttr;
    if (/^\d+$/.test(selector))
        return siblings[Number(selector)];
    return undefined;
}
/** Detect the indentation string of the line `pos` sits on. */
function lineIndent(xml, pos) {
    const lineStart = xml.lastIndexOf('\n', pos - 1) + 1;
    const m = /^[ \t]*/.exec(xml.slice(lineStart, pos));
    return m ? m[0] : '';
}
/** One indentation step, inferred from an element and its first child (falls back to 4 spaces). */
function indentStep(xml, parent) {
    const children = parent.selfClosing ? [] : childElements(xml, parent.openEnd, parent.innerEnd);
    const parentIndent = lineIndent(xml, parent.start);
    const child = children[0];
    if (child) {
        const childIndent = lineIndent(xml, child.start);
        if (childIndent.startsWith(parentIndent) && childIndent.length > parentIndent.length) {
            return childIndent.slice(parentIndent.length);
        }
    }
    return '    ';
}
function apply(xml, splice) {
    const text = xml.slice(0, splice.start) + splice.insert + xml.slice(splice.end);
    return { text, changed: text !== xml };
}
const unchanged = (xml, reason) => ({
    text: xml,
    changed: false,
    ...(reason ? { reason } : {}),
});
/** Remove an element together with its now-blank line (never touches neighbouring content). */
function removalSplice(xml, el) {
    let start = el.start;
    let end = el.end;
    const lineStart = xml.lastIndexOf('\n', el.start - 1) + 1;
    if (/^[ \t]*$/.test(xml.slice(lineStart, el.start))) {
        let lineEnd = end;
        while (lineEnd < xml.length &&
            (xml[lineEnd] === ' ' || xml[lineEnd] === '\t' || xml[lineEnd] === '\r'))
            lineEnd++;
        if (xml[lineEnd] === '\n') {
            start = lineStart;
            end = lineEnd + 1;
        }
    }
    return { start, end, insert: '' };
}
/** Set / insert / remove an attribute on an element's open tag. */
function attrSplice(xml, el, name, newValue) {
    const attr = el.attrs.find(a => a.name === name);
    if (attr) {
        if (newValue === null) {
            // Take the preceding whitespace with the attribute.
            let start = attr.start;
            while (start > 0 && WS.test(xml[start - 1]))
                start--;
            return { start, end: attr.end, insert: '' };
        }
        return { start: attr.valStart, end: attr.valEnd, insert: escapeAttr(newValue) };
    }
    if (newValue === null)
        return undefined;
    const insertAt = el.selfClosing ? el.end - 2 : el.openEnd - 1;
    const needsSpace = !WS.test(xml[insertAt - 1]);
    return {
        start: insertAt,
        end: insertAt,
        insert: `${needsSpace ? ' ' : ''}${name}="${escapeAttr(newValue)}"`,
    };
}
/** Build `<A><B value="…"/></A>` text for the missing tail of a path. */
function buildInsert(segments, value, indent, step) {
    const [head, ...rest] = segments;
    if (!head)
        return '';
    if (rest.length === 0)
        return `${indent}<${head} value="${escapeAttr(value)}"/>`;
    const restNoSelector = isSelector(rest[0]) ? rest.slice(1) : rest;
    if (restNoSelector.length === 0)
        return `${indent}<${head} value="${escapeAttr(value)}"/>`;
    return `${indent}<${head}>\n${buildInsert(restNoSelector, value, indent + step, step)}\n${indent}</${head}>`;
}
/** Insert `insert` as the last child of `el` (expanding a self-closed entity if needed). */
function insertChildSplice(xml, el, insert) {
    if (el.selfClosing) {
        const indent = lineIndent(xml, el.start);
        return { start: el.end - 2, end: el.end, insert: `>\n${insert}\n${indent}</${el.name}>` };
    }
    // Before the closing tag, keeping its line indentation intact.
    const closeLineStart = xml.lastIndexOf('\n', el.innerEnd - 1) + 1;
    const closeOnOwnLine = /^[ \t]*$/.test(xml.slice(closeLineStart, el.innerEnd));
    if (closeOnOwnLine)
        return { start: closeLineStart, end: closeLineStart, insert: `${insert}\n` };
    return {
        start: el.innerEnd,
        end: el.innerEnd,
        insert: `\n${insert}\n${lineIndent(xml, el.start)}`,
    };
}
// ─── main ────────────────────────────────────────────────────────────────────
export function catalogFieldExists(xml, className, id, fieldPath) {
    const segments = fieldSegments(fieldPath);
    if (segments === undefined)
        return false;
    const entity = findEntity(xml, className, id);
    if (!entity)
        return false;
    let current = entity;
    let index = 0;
    while (index < segments.length) {
        const name = segments[index];
        const siblings = current.selfClosing
            ? []
            : childElements(xml, current.openEnd, current.innerEnd).filter(child => child.name === name);
        if (siblings.length === 0) {
            return (index === segments.length - 1 && current.attrs.some(attribute => attribute.name === name));
        }
        const following = segments[index + 1];
        const selector = isSelector(following) ||
            (following !== undefined &&
                siblings.some(sibling => sibling.attrs.some(attribute => attribute.name === 'index' &&
                    attribute.value.toLowerCase() === following.toLowerCase())))
            ? following
            : undefined;
        const selected = selector === undefined ? siblings[0] : pickIndexed(siblings, selector);
        if (selected === undefined)
            return false;
        current = selected;
        index += selector === undefined ? 1 : 2;
    }
    return true;
}
export function insertCatalogEntityDeclaration(xml, className, id) {
    if (!FIELD_SEGMENT_RE.test(className) || id.length === 0) {
        return unchanged(xml, 'invalid catalog entity class or id');
    }
    return insertCatalogEntityXml(xml, className, id, `<${className} id="${escapeAttr(id)}"/>`);
}
/** Insert one already-materialized entity while preserving all unrelated catalog bytes. */
export function insertCatalogEntityXml(xml, className, id, declaration) {
    if (!FIELD_SEGMENT_RE.test(className) || id.length === 0 || typeof declaration !== 'string') {
        return unchanged(xml, 'invalid catalog entity declaration');
    }
    if (findEntity(xml, className, id))
        return unchanged(xml, 'entity already exists');
    const parsed = parseElement(declaration, 0);
    if (parsed === undefined ||
        parsed.start !== 0 ||
        parsed.end !== declaration.length ||
        parsed.name !== className ||
        !parsed.attrs.some(attribute => attribute.name === 'id' && attribute.value === id)) {
        return unchanged(xml, 'materialized entity declaration is invalid');
    }
    const catalog = childElements(xml, 0, xml.length).find(element => element.name === 'Catalog');
    if (catalog === undefined)
        return unchanged(xml, 'catalog root not found');
    const step = indentStep(xml, catalog);
    const prefix = `${lineIndent(xml, catalog.start)}${step}`;
    const insert = declaration
        .split('\n')
        .map(line => `${prefix}${line}`)
        .join('\n');
    return apply(xml, insertChildSplice(xml, catalog, insert));
}
/** Write an SC2 indexed-array tombstone without copying the inherited entry into the local mod. */
export function patchCatalogIndexedEntryRemoval(xml, className, id, fieldPath, index, indexKey = 'index') {
    const segments = fieldSegments(fieldPath);
    const selector = String(index);
    if (segments === undefined ||
        !FIELD_SEGMENT_RE.test(indexKey) ||
        (!FIELD_SEGMENT_RE.test(selector) && !/^\d+$/u.test(selector)) ||
        (typeof index === 'number' && (!Number.isSafeInteger(index) || index < 0))) {
        return unchanged(xml, 'invalid indexed-array removal target');
    }
    const entity = findEntity(xml, className, id);
    if (!entity)
        return unchanged(xml, `entity <${className} id="${id}"> not found`);
    let current = entity;
    let offset = 0;
    while (offset < segments.length - 1) {
        const name = segments[offset];
        const siblings = current.selfClosing
            ? []
            : childElements(xml, current.openEnd, current.innerEnd).filter(child => child.name === name);
        const following = segments[offset + 1];
        const hasSelector = following !== undefined &&
            (isSelector(following) ||
                siblings.some(sibling => sibling.attrs.some(attribute => attribute.name === 'index' && attribute.value === following)));
        const selected = hasSelector ? pickIndexed(siblings, following) : siblings[0];
        if (selected === undefined)
            return unchanged(xml, `no container '${name}' for ${fieldPath}`);
        current = selected;
        offset += hasSelector ? 2 : 1;
    }
    const fieldName = segments[segments.length - 1];
    const siblings = current.selfClosing
        ? []
        : childElements(xml, current.openEnd, current.innerEnd).filter(child => child.name === fieldName);
    const existing = siblings.find(sibling => sibling.attrs.some(attribute => attribute.name === indexKey && attribute.value === selector)) ?? (/^\d+$/u.test(selector) ? siblings[Number(selector)] : undefined);
    const marker = `<${fieldName} ${indexKey}="${escapeAttr(selector)}" removed="1"/>`;
    if (existing !== undefined)
        return apply(xml, { start: existing.start, end: existing.end, insert: marker });
    const step = indentStep(xml, current);
    const insert = `${lineIndent(xml, current.start)}${step}${marker}`;
    return apply(xml, insertChildSplice(xml, current, insert));
}
/** Create or update one scalar or structured indexed entry without copying inherited siblings. */
export function patchCatalogIndexedEntry(xml, className, id, fieldPath, index, newValue, indexKey = 'index') {
    const segments = fieldSegments(fieldPath);
    const selector = String(index);
    if (segments === undefined ||
        !FIELD_SEGMENT_RE.test(indexKey) ||
        (!FIELD_SEGMENT_RE.test(selector) && !/^\d+$/u.test(selector)) ||
        (typeof index === 'number' && (!Number.isSafeInteger(index) || index < 0))) {
        return unchanged(xml, 'invalid indexed-array write target');
    }
    const entity = findEntity(xml, className, id);
    if (!entity)
        return unchanged(xml, `entity <${className} id="${id}"> not found`);
    let current = entity;
    let offset = 0;
    while (offset < segments.length - 1) {
        const name = segments[offset];
        const siblings = current.selfClosing
            ? []
            : childElements(xml, current.openEnd, current.innerEnd).filter(child => child.name === name);
        const following = segments[offset + 1];
        const hasSelector = following !== undefined &&
            (isSelector(following) ||
                siblings.some(sibling => sibling.attrs.some(attribute => attribute.name === 'index' && attribute.value === following)));
        const selected = hasSelector ? pickIndexed(siblings, following) : siblings[0];
        if (selected === undefined)
            return unchanged(xml, `no container '${name}' for ${fieldPath}`);
        current = selected;
        offset += hasSelector ? 2 : 1;
    }
    const fieldName = segments[segments.length - 1];
    const siblings = current.selfClosing
        ? []
        : childElements(xml, current.openEnd, current.innerEnd).filter(child => child.name === fieldName);
    const existing = siblings.find(sibling => sibling.attrs.some(attribute => attribute.name === indexKey && attribute.value === selector)) ?? (/^\d+$/u.test(selector) ? siblings[Number(selector)] : undefined);
    if (existing !== undefined && (newValue === null || typeof newValue !== 'object')) {
        const removed = attrSplice(xml, existing, 'removed', null);
        const withoutTombstone = removed === undefined ? xml : apply(xml, removed).text;
        return patchCatalogField(withoutTombstone, className, id, `${fieldPath}.${selector}`, String(newValue));
    }
    if (existing !== undefined) {
        const reason = incompleteStructuredReplacementReason(xml, existing, indexKey, newValue);
        if (reason !== undefined)
            return unchanged(xml, reason);
    }
    const step = indentStep(xml, current);
    const baseIndent = `${lineIndent(xml, current.start)}${step}`;
    const encoded = structuredEntryMarker(fieldName, indexKey, selector, newValue, baseIndent, step);
    if (encoded.marker === undefined)
        return unchanged(xml, encoded.reason);
    if (existing !== undefined) {
        return apply(xml, { start: existing.start, end: existing.end, insert: encoded.marker });
    }
    const insert = `${baseIndent}${encoded.marker}`;
    return apply(xml, insertChildSplice(xml, current, insert));
}
/**
 * Change one field value of `<{className} id="{id}">` in `xml`, preserving every other
 * byte. `fieldPath` uses the relations path convention (`LifeMax`, `WeaponArray.0.Link`,
 * `Cost.0.Cooldown.TimeUse`); `newValue === null` clears the field.
 */
export function patchCatalogField(xml, className, id, fieldPath, newValue) {
    const segments = fieldSegments(fieldPath);
    if (segments === undefined)
        return unchanged(xml, 'invalid or empty field path');
    const entity = findEntity(xml, className, id);
    if (!entity)
        return unchanged(xml, `entity <${className} id="${id}"> not found`);
    let cur = entity;
    let i = 0;
    while (i < segments.length) {
        const name = segments[i];
        const siblings = cur.selfClosing
            ? []
            : childElements(xml, cur.openEnd, cur.innerEnd).filter(c => c.name === name);
        if (siblings.length === 0) {
            // Attribute leaf on the current element: `WeaponArray.0.Link` after WeaponArray[0],
            // or a top-level field the file stored as an entity attribute.
            if (i === segments.length - 1) {
                const isEntityMeta = cur === entity && (name === 'id' || name === 'parent' || name === 'default');
                const existsAsAttr = cur.attrs.some(a => a.name === name);
                if (!isEntityMeta && (cur !== entity ? true : existsAsAttr)) {
                    const splice = attrSplice(xml, cur, name, newValue);
                    return splice
                        ? apply(xml, splice)
                        : unchanged(xml, newValue === null ? undefined : `cannot set ${fieldPath}`);
                }
            }
            if (newValue === null)
                return unchanged(xml); // clearing something that isn't there
            const step = indentStep(xml, entity);
            const insert = buildInsert(segments.slice(i), newValue, lineIndent(xml, cur.start) + step, step);
            return apply(xml, insertChildSplice(xml, cur, insert));
        }
        const selector = isSelector(segments[i + 1]) ||
            (segments[i + 1] !== undefined &&
                siblings.some(s => s.attrs.some(a => a.name === 'index' && a.value.toLowerCase() === segments[i + 1].toLowerCase())))
            ? segments[i + 1]
            : undefined;
        const el = selector !== undefined ? pickIndexed(siblings, selector) : siblings[0];
        if (!el) {
            if (newValue === null)
                return unchanged(xml);
            return unchanged(xml, `no entry '${selector}' under ${name}`);
        }
        cur = el;
        i += selector !== undefined ? 2 : 1;
    }
    // Element leaf: the field element itself (`<LifeMax value="45"/>`).
    if (newValue === null)
        return apply(xml, removalSplice(xml, cur));
    const splice = attrSplice(xml, cur, 'value', newValue);
    return splice ? apply(xml, splice) : unchanged(xml, `cannot set ${fieldPath}`);
}
//# sourceMappingURL=catalog-field-patch.js.map
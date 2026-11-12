/**
 * SC2 string markup parser. See docs/tasks-complete/entity-cards-strings/STRING_REF_GRAMMAR.md.
 *
 * A localized string value is a sequence of literal text runs interleaved with
 * markup tags (`<d ref>`, `<d stringref>`, `<d GalaxyVar>`, `<n/>`, `<c>`,
 * `<s>`, `<w>`, `<lang>`, `<h>`, `<k>`, `<a>`, `<ignore>`, `<sp/>`) and
 * `$Token$` dynamic forms. `parseMarkup` returns an ordered segment list that
 * round-trips back to the original value byte-exact.
 *
 * Browser-safe: pure string scanning, zero dependencies.
 */
const D_TAG = /^<d\s+([^>]*?)\/?>/i;
// `<n/>` is the documented self-closed form, but `</n>` (a stray closing tag with
// no matching `<n>` open) shows up in practice and renders as a newline in-game
// too, so treat both the same.
const N_TAG = /^<\/?n\s*\/?>/i;
const SP_TAG = /^<sp\s*\/>/i;
const H_TAG = /^<h\s*\/>/i;
const OPEN_C = /^<c\b([^>]*)>/i;
const OPEN_S = /^<s\b([^>]*)>/i;
const IMG_TAG = /^<img\b([^>]*?)\/?>/i;
const K_TAG = /^<k\b([^>]*?)\/?>/i;
const SELF_LIST = /^<(li)\b([^>]*?)\/>/i;
const SELF_CONTAINER = /^<(ignore)\b([^>]*?)\/>/i;
const OPEN_LIST = /^<(ul|li)\b([^>]*)>/i;
const OPEN_CONTAINER = /^<(w|lang|h|a|ignore)\b([^>]*)>/i;
const DOLLAR_TOKEN = /^\$([A-Za-z][^$]*)\$/;
// `~Name~` and, per the trigger-editor grammar, `~Name1|Name2|...~` — a set of
// alternative parameter names the engine tries in order (e.g. `~targetPoint|TargetPoint~`).
const TILDE_TOKEN = /^~([A-Za-z][A-Za-z0-9_]*(?:\|[A-Za-z][A-Za-z0-9_]*)*)~/;
// %Name% runtime variables (e.g. %current%, %ideal%, %colorValue%). Identifier-bounded
// (unlike ~Name~, '%' is also legitimately used as a literal percent sign elsewhere in
// SC2 tooltips — "+25% Attack Speed" — so this only matches genuine %Word% patterns and
// is deliberately NOT validated as malformed/unclosed the way ~ tokens are).
const PERCENT_TOKEN = /^%([A-Za-z][A-Za-z0-9_]*)%/;
const ATTR = /([A-Za-z_]\w*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const D_DYNAMIC_ATTRS = [
    'GameValue',
    'Score',
    'UnitCount',
    'AbilChargeCount',
    'BehaviorStackCount',
    'BehaviorRemainingDuration',
    'UpgradeLevel',
    'UpgradeEffectArrayValue',
    'AccumulatedValue',
    'RunAccumulators',
    'Damage',
    'AttackDamage',
];
function parseAttrs(s) {
    const out = {};
    ATTR.lastIndex = 0;
    let m;
    while ((m = ATTR.exec(s)) !== null)
        out[m[1]] = m[2] ?? m[3] ?? '';
    return out;
}
function attrValue(attrs, name) {
    if (attrs[name] !== undefined)
        return attrs[name];
    const lower = name.toLowerCase();
    return Object.entries(attrs).find(([key]) => key.toLowerCase() === lower)?.[1];
}
function dynamicAttr(attrs) {
    for (const name of D_DYNAMIC_ATTRS) {
        const value = attrValue(attrs, name);
        if (value !== undefined)
            return { name, value };
    }
    return undefined;
}
/** Find the index just past the matching `</tag>`, honoring nesting. -1 if unbalanced. */
function findMatchingClose(value, from, tag) {
    const open = new RegExp(`<${tag}\\b[^>]*>`, 'iy');
    const close = new RegExp(`</${tag}\\s*>`, 'iy');
    let depth = 1;
    let i = from;
    while (i < value.length) {
        if (value[i] === '<') {
            open.lastIndex = i;
            close.lastIndex = i;
            if (close.test(value)) {
                depth--;
                if (depth === 0)
                    return close.lastIndex;
                i = close.lastIndex;
                continue;
            }
            if (open.test(value)) {
                depth++;
                i = open.lastIndex;
                continue;
            }
        }
        i++;
    }
    return -1;
}
const LI_MARKER = /<li\b([^>]*?)(\/)?>/i;
/**
 * Parse the inner content of a `<ul>…</ul>`. A self-closing `<li/>` acts like an
 * implicit opener: its content is everything up to the next `<li` marker (open or
 * self-closed) or the end of the list, not an empty childless item. An explicit
 * `<li>…</li>` pair keeps its own unambiguous bounds (nothing after it is absorbed).
 */
function parseListItems(inner) {
    const segments = [];
    let pos = 0;
    const flushPlain = (end) => { if (end > pos)
        segments.push(...parseMarkup(inner.slice(pos, end))); };
    for (;;) {
        const m = LI_MARKER.exec(inner.slice(pos));
        if (!m)
            break;
        const markerStart = pos + m.index;
        flushPlain(markerStart);
        const tagEnd = markerStart + m[0].length;
        if (!m[2]) { // explicit <li ...> open tag with its own matching </li>
            const closeEnd = findMatchingClose(inner, tagEnd, 'li');
            if (closeEnd === -1) {
                pos = markerStart;
                break;
            } // unbalanced — fall through, flush the tail as plain content
            const closeTagLen = inner.slice(0, closeEnd).match(/<\/li\s*>$/i)[0].length;
            const contentEnd = closeEnd - closeTagLen;
            segments.push({ kind: 'list', tag: 'li', children: parseMarkup(inner.slice(tagEnd, contentEnd)), raw: inner.slice(markerStart, closeEnd) });
            pos = closeEnd;
            continue;
        }
        // Self-closed <li/> — its content runs until the next <li> marker or the list's end.
        const next = LI_MARKER.exec(inner.slice(tagEnd));
        const itemEnd = next ? tagEnd + next.index : inner.length;
        segments.push({ kind: 'list', tag: 'li', children: parseMarkup(inner.slice(tagEnd, itemEnd)), raw: inner.slice(markerStart, itemEnd) });
        pos = itemEnd;
    }
    flushPlain(inner.length);
    return segments;
}
function matchTagAt(value, i) {
    const rest = value.slice(i);
    const n = N_TAG.exec(rest);
    if (n)
        return { segment: { kind: 'newline', raw: n[0] }, end: i + n[0].length };
    const sp = SP_TAG.exec(rest);
    if (sp)
        return { segment: { kind: 'space', raw: sp[0] }, end: i + sp[0].length };
    const hSelf = H_TAG.exec(rest);
    if (hSelf)
        return { segment: { kind: 'highlight', raw: hSelf[0] }, end: i + hSelf[0].length };
    const d = D_TAG.exec(rest);
    if (d) {
        const attrs = parseAttrs(d[1]);
        const raw = d[0];
        const end = i + raw.length;
        const stringref = attrValue(attrs, 'stringref');
        if (stringref !== undefined) {
            const [ns = '', entity = '', field = ''] = stringref.split(',');
            return { segment: { kind: 'stringref', ns, entity, field, raw }, end };
        }
        const time = attrValue(attrs, 'time');
        if (time !== undefined) {
            const opts = { ...attrs };
            return { segment: { kind: 'time', expr: time, opts, raw }, end };
        }
        const galaxyVar = attrValue(attrs, 'GalaxyVar');
        if (galaxyVar !== undefined)
            return { segment: { kind: 'galaxyvar', name: galaxyVar, raw }, end };
        const dynamic = dynamicAttr(attrs);
        if (dynamic)
            return { segment: { kind: 'dynamic', name: dynamic.name, value: dynamic.value, attrs, raw }, end };
        // default: `ref` (treat any other <d ...> as a ref expression if it has one)
        const ref = attrValue(attrs, 'ref');
        return { segment: { kind: 'ref', expr: ref ?? '', opts: attrs, raw }, end };
    }
    const c = OPEN_C.exec(rest);
    if (c) {
        const innerStart = i + c[0].length;
        const closeEnd = findMatchingClose(value, innerStart, 'c');
        if (closeEnd !== -1) {
            const innerEnd = closeEnd - value.slice(0, closeEnd).match(/<\/c\s*>$/i)[0].length;
            const color = attrValue(parseAttrs(c[1]), 'val') ?? '';
            return {
                segment: { kind: 'color', color, children: parseMarkup(value.slice(innerStart, innerEnd)), raw: value.slice(i, closeEnd) },
                end: closeEnd,
            };
        }
        // Missing `</c>` (commonly the last color tag in a string, left unclosed by the
        // translator) — absorb the rest of the value as its content instead of falling
        // through to plain text, so the color still gets a swatch/picker.
        const color = attrValue(parseAttrs(c[1]), 'val') ?? '';
        return {
            segment: { kind: 'color', color, children: parseMarkup(value.slice(innerStart)), raw: value.slice(i) },
            end: value.length,
        };
    }
    const s = OPEN_S.exec(rest);
    if (s) {
        const innerStart = i + s[0].length;
        const closeEnd = findMatchingClose(value, innerStart, 's');
        if (closeEnd !== -1) {
            const innerEnd = closeEnd - value.slice(0, closeEnd).match(/<\/s\s*>$/i)[0].length;
            const style = attrValue(parseAttrs(s[1]), 'val') ?? '';
            return {
                segment: { kind: 'style', style, children: parseMarkup(value.slice(innerStart, innerEnd)), raw: value.slice(i, closeEnd) },
                end: closeEnd,
            };
        }
        // Missing `</s>` — same absorb-to-end treatment as the unclosed `<c>` case above.
        const style = attrValue(parseAttrs(s[1]), 'val') ?? '';
        return {
            segment: { kind: 'style', style, children: parseMarkup(value.slice(innerStart)), raw: value.slice(i) },
            end: value.length,
        };
    }
    const img = IMG_TAG.exec(rest);
    if (img) {
        const attrs = parseAttrs(img[1]);
        const seg = { kind: 'img', path: attrValue(attrs, 'path') ?? '', attrs, raw: img[0] };
        const width = attrValue(attrs, 'width');
        const height = attrValue(attrs, 'height');
        if (width !== undefined)
            seg.width = width;
        if (height !== undefined)
            seg.height = height;
        return { segment: seg, end: i + img[0].length };
    }
    const hotkey = K_TAG.exec(rest);
    if (hotkey) {
        const attrs = parseAttrs(hotkey[1]);
        return { segment: { kind: 'hotkey', val: attrValue(attrs, 'val') ?? '', attrs, raw: hotkey[0] }, end: i + hotkey[0].length };
    }
    const selfList = SELF_LIST.exec(rest);
    if (selfList)
        return { segment: { kind: 'list', tag: 'li', children: [], raw: selfList[0] }, end: i + selfList[0].length };
    const selfContainer = SELF_CONTAINER.exec(rest);
    if (selfContainer) {
        return {
            segment: {
                kind: 'container',
                tag: selfContainer[1].toLowerCase(),
                attrs: parseAttrs(selfContainer[2]),
                children: [],
                raw: selfContainer[0],
            },
            end: i + selfContainer[0].length,
        };
    }
    const list = OPEN_LIST.exec(rest);
    if (list) {
        const tag = list[1].toLowerCase();
        const innerStart = i + list[0].length;
        const closeEnd = findMatchingClose(value, innerStart, tag);
        if (closeEnd !== -1) {
            const closeMatch = value.slice(0, closeEnd).match(new RegExp(`</${tag}\\s*>$`, 'i'))[0];
            const innerEnd = closeEnd - closeMatch.length;
            const inner = value.slice(innerStart, innerEnd);
            return {
                segment: { kind: 'list', tag, children: tag === 'ul' ? parseListItems(inner) : parseMarkup(inner), raw: value.slice(i, closeEnd) },
                end: closeEnd,
            };
        }
    }
    const container = OPEN_CONTAINER.exec(rest);
    if (container) {
        const tag = container[1].toLowerCase();
        const innerStart = i + container[0].length;
        const closeEnd = findMatchingClose(value, innerStart, tag);
        if (closeEnd !== -1) {
            const closeMatch = value.slice(0, closeEnd).match(new RegExp(`</${tag}\\s*>$`, 'i'))[0];
            const innerEnd = closeEnd - closeMatch.length;
            return {
                segment: { kind: 'container', tag, attrs: parseAttrs(container[2]), children: parseMarkup(value.slice(innerStart, innerEnd)), raw: value.slice(i, closeEnd) },
                end: closeEnd,
            };
        }
    }
    // Anything else (an unrecognized tag name like `<None>`, a stray `<`, or a bare
    // `>`) is not SC2 markup — leave it for the caller to treat as literal text
    // rather than inventing a structural "unknown tag" segment for it.
    return undefined;
}
function matchTokenAt(value, i) {
    const rest = value.slice(i);
    const tilde = TILDE_TOKEN.exec(rest);
    if (tilde) {
        const [token = '', ...args] = tilde[1].split('|');
        return { segment: { kind: 'token', token, args, raw: tilde[0], syntax: 'tilde' }, end: i + tilde[0].length };
    }
    const percent = PERCENT_TOKEN.exec(rest);
    if (percent)
        return { segment: { kind: 'token', token: percent[1], args: [], raw: percent[0], syntax: 'percent' }, end: i + percent[0].length };
    const m = DOLLAR_TOKEN.exec(rest);
    if (!m)
        return undefined;
    const [token = '', ...args] = m[1].split(':');
    return { segment: { kind: 'token', token, args, raw: m[0], syntax: 'dollar' }, end: i + m[0].length };
}
/** Parse a localized string value into ordered markup segments. */
export function parseMarkup(value) {
    const segments = [];
    let i = 0;
    let textStart = 0;
    const flush = (end) => {
        if (end > textStart)
            segments.push({ kind: 'text', text: value.slice(textStart, end) });
    };
    while (i < value.length) {
        const ch = value[i];
        let m;
        if (ch === '<')
            m = matchTagAt(value, i);
        else if (ch === '$' || ch === '~' || ch === '%')
            m = matchTokenAt(value, i);
        if (m) {
            flush(i);
            segments.push(m.segment);
            i = m.end;
            textStart = i;
        }
        else {
            i++;
        }
    }
    flush(value.length);
    return segments;
}
/** Reconstruct the original string value from its segments (byte-exact). */
export function serializeMarkup(segments) {
    let out = '';
    for (const s of segments)
        out += s.kind === 'text' ? s.text : s.raw;
    return out;
}
const HEX_COLOR_RE = /^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
/**
 * Locate raw hex colors in `<c val="RRGGBB[AA]">` spans (including nested ones),
 * skipping named color constants (`<c val="ColorAttackInfo">`) since those aren't
 * literal color values. Drives inline swatch/color-picker UI.
 */
export function findColorSwatches(value) {
    return collectColorSwatches(parseMarkup(value), 0);
}
function collectColorSwatches(segs, base) {
    const out = [];
    let pos = base;
    for (const s of segs) {
        const len = s.kind === 'text' ? s.text.length : s.raw.length;
        if (s.kind === 'color' && HEX_COLOR_RE.test(s.color)) {
            const hexStart = s.raw.indexOf(s.color);
            if (hexStart >= 0)
                out.push({ start: pos + hexStart, end: pos + hexStart + s.color.length, hex: s.color });
        }
        if ('children' in s && s.children.length) {
            const openLen = Math.max(1, s.raw.indexOf('>') + 1); // e.g. `<c val="...">` — content starts right after
            out.push(...collectColorSwatches(s.children, pos + openLen));
        }
        pos += len;
    }
    return out;
}
const FIELDREF = /([A-Za-z_]\w*),([A-Za-z_][\w@]*),([\w.[\]]+)/g;
const BRACKET_D = /^\[d\s+([\s\S]*?)\/?\]$/i;
/** Every catalog reference embedded in a value: `stringref` tags + tuples inside ref/time/token expressions. */
export function markupCatalogRefs(value) {
    const refs = [];
    const collectExpr = (expr) => {
        FIELDREF.lastIndex = 0;
        let m;
        while ((m = FIELDREF.exec(expr)) !== null)
            refs.push({ ns: m[1], entity: m[2], field: m[3] });
    };
    const walk = (segs) => {
        for (const s of segs) {
            if (s.kind === 'stringref')
                refs.push({ ns: s.ns, entity: s.entity, field: s.field });
            else if (s.kind === 'ref' || s.kind === 'time')
                collectExpr(s.expr);
            else if (s.kind === 'dynamic')
                collectExpr(s.value);
            else if (s.kind === 'token')
                collectExpr(s.args.join(':'));
            else if (s.kind === 'color' || s.kind === 'style' || s.kind === 'list' || s.kind === 'container')
                walk(s.children);
        }
    };
    walk(parseMarkup(value));
    return refs;
}
/**
 * Find the innermost non-text markup segment (recursing into `<c>`/`<s>`/`<ul>`/
 * container children) whose span contains `offset` — the basis for hover/go-to-
 * definition on a `<d ref>`, `<d stringref>`, or `<d GalaxyVar>` under the cursor.
 * Undefined when `offset` falls in plain text or between segments.
 */
export function findSegmentAt(value, offset) {
    const findIn = (segs, base) => {
        let pos = base;
        for (const s of segs) {
            const len = s.kind === 'text' ? s.text.length : s.raw.length;
            const end = pos + len;
            if (offset >= pos && offset < end) {
                if ('children' in s && s.children.length) {
                    const openLen = Math.max(1, s.raw.indexOf('>') + 1);
                    const inner = findIn(s.children, pos + openLen);
                    if (inner)
                        return inner;
                }
                return s.kind === 'text' ? undefined : { segment: s, start: pos, end };
            }
            pos = end;
        }
        return undefined;
    };
    return findIn(parseMarkup(value), 0);
}
/** `<d …>` attributes whose value is a numeric/reference expression (`+ - * / ( )`). */
const EXPRESSION_ATTRS = new Set(['ref', 'time', 'gamevalue', 'score', 'unitcount', 'abilchargecount', 'behaviorstackcount', 'upgradelevel', 'upgradeeffectarrayvalue', 'accumulatedvalue', 'damage', 'attackdamage']);
/**
 * Conservatively validate a numeric/reference expression (operands separated by
 * `+ - * /`, grouped by `( )`). Operands may be number literals or
 * `Ns,Entity,Field` tuples. Returns an error message, or undefined if it looks
 * well-formed. Only clear structural errors are reported (no false positives on
 * valid SC2 syntax).
 */
function checkExpression(expr) {
    if (expr.trim() === '')
        return undefined;
    const tokens = expr.match(/[()]|[+\-*/]|[^()+\-*/\s]+/g) ?? [];
    let depth = 0;
    let expectOperand = true;
    for (const t of tokens) {
        if (t === '(') {
            if (!expectOperand)
                return 'Missing operator before "("';
            depth++;
            expectOperand = true;
        }
        else if (t === ')') {
            if (expectOperand)
                return 'Missing operand before ")"';
            depth--;
            if (depth < 0)
                return 'Unbalanced parentheses';
            expectOperand = false;
        }
        else if (t === '+' || t === '-' || t === '*' || t === '/') {
            if (expectOperand) {
                if (t === '*' || t === '/')
                    return `Operator "${t}" has no left operand`; /* else unary +/- */
            }
            else
                expectOperand = true;
        }
        else {
            if (!expectOperand)
                return `Missing operator before "${t}"`;
            expectOperand = false;
        }
    }
    if (depth !== 0)
        return 'Unbalanced parentheses';
    if (expectOperand)
        return 'Expression ends with an operator';
    return undefined;
}
const D_TAG_G = /<d\s+([^>]*?)\/?>/gi;
/** Flag malformed `+ - * / ( )` expressions inside `<d …>` expression attributes. */
function validateOperations(value, out) {
    D_TAG_G.lastIndex = 0;
    let m;
    while ((m = D_TAG_G.exec(value)) !== null) {
        const raw = m[0];
        const attrs = parseAttrs(m[1]);
        for (const [name, exprValue] of Object.entries(attrs)) {
            if (!EXPRESSION_ATTRS.has(name.toLowerCase()))
                continue;
            const error = checkExpression(exprValue);
            if (error)
                out.push({ code: 'malformed-operation', offset: m.index, raw, message: `${error} in <d ${name}="${exprValue}">` });
        }
    }
}
function validateTildeTokens(value, out) {
    let i = value.indexOf('~');
    while (i >= 0) {
        TILDE_TOKEN.lastIndex = 0;
        const valid = TILDE_TOKEN.exec(value.slice(i));
        if (valid) {
            i = value.indexOf('~', i + valid[0].length);
            continue;
        }
        const close = value.indexOf('~', i + 1);
        const raw = close >= 0 ? value.slice(i, close + 1) : value.slice(i);
        out.push({
            code: 'malformed-tilde-token',
            offset: i,
            raw,
            message: close >= 0
                ? `Malformed runtime token "${raw}". Expected ~Name~ (or ~Name1|Name2~) with letters, digits, or underscore.`
                : `Unclosed runtime token "${raw}". Expected ~Name~.`,
        });
        i = close >= 0 ? value.indexOf('~', close + 1) : -1;
    }
}
function validateBracketedDAttrs(value, out) {
    let i = 0;
    while ((i = value.toLowerCase().indexOf('[d', i)) >= 0) {
        const end = value.indexOf(']', i + 2);
        if (end < 0) {
            out.push({
                code: 'malformed-dynamic-attribute',
                offset: i,
                raw: value.slice(i),
                message: `Unclosed computed attribute "${value.slice(i)}". Expected [d .../].`,
            });
            return;
        }
        const raw = value.slice(i, end + 1);
        const body = BRACKET_D.exec(raw)?.[1];
        if (!body || Object.keys(parseAttrs(body)).length === 0) {
            out.push({
                code: 'malformed-dynamic-attribute',
                offset: i,
                raw,
                message: `Malformed computed attribute "${raw}". Expected [d Name='Value'/].`,
            });
        }
        i = end + 1;
    }
}
export function parseBracketedDTag(value) {
    const m = BRACKET_D.exec(value.trim());
    if (!m)
        return undefined;
    const raw = `<d ${m[1].trim().replace(/\/\s*$/, '')}/>`;
    const parsed = parseMarkup(raw);
    return parsed.length === 1 ? parsed[0] : undefined;
}
export function validateMarkupSyntax(value) {
    const out = [];
    validateTildeTokens(value, out);
    validateBracketedDAttrs(value, out);
    validateOperations(value, out);
    return out;
}
//# sourceMappingURL=markup.js.map
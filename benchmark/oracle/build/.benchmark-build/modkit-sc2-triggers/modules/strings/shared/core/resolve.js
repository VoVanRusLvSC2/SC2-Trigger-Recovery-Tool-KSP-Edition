/**
 * Resolve SC2 string markup against catalog data. See docs/tasks-complete/entity-cards-strings/STRING_REF_GRAMMAR.md.
 *
 * `<d ref="EXPR"/>` values are arithmetic expressions over one or more
 * `Namespace,Entity,FieldPath` references. This module parses and evaluates those
 * expressions against a `CatalogResolver` (a minimal view of a loaded mod, so the
 * package stays browser-safe and decoupled from `@modkitx/mods-processing/sc2-mod-core`).
 *
 * `$Token$` dynamic forms have no static value and resolve to a typed placeholder.
 */
import { parseBracketedDTag, parseMarkup } from './markup.js';
const FIELDREF_A = /^([A-Za-z_]\w*),([A-Za-z_][\w@]*),([\w.[\]]+)/;
const NUM_A = /^\d+(\.\d+)?/;
const NESTED_A = /^\[d\s+(?:ref|time)\s*=\s*'([^']*)'[^\]]*\]/i;
// %Name% runtime variables (e.g. `<d ref="%ideal%/3"/>`) are legitimate operands —
// their value is only known at runtime, so they evaluate to a 0 placeholder here
// instead of being an unresolvable/malformed expression.
const VAR_A = /^%[A-Za-z][A-Za-z0-9_]*%/;
function tokenize(expr) {
    const toks = [];
    let i = 0;
    while (i < expr.length) {
        const ch = expr[i];
        if (ch === ' ' || ch === '\t') {
            i++;
            continue;
        }
        if (ch === '(') {
            toks.push({ t: 'lp' });
            i++;
            continue;
        }
        if (ch === ')') {
            toks.push({ t: 'rp' });
            i++;
            continue;
        }
        if (ch === '+' || ch === '*' || ch === '/') {
            toks.push({ t: 'op', v: ch });
            i++;
            continue;
        }
        if (ch === '-') {
            // unary minus when at start or after an operator/open-paren → fold into number/ref via 0 - x
            toks.push({ t: 'op', v: '-' });
            i++;
            continue;
        }
        if (ch === '[') {
            const m = NESTED_A.exec(expr.slice(i));
            if (m) {
                toks.push({ t: 'nested', expr: m[1] });
                i += m[0].length;
                continue;
            }
        }
        if (ch === '%') {
            const m = VAR_A.exec(expr.slice(i));
            if (m) {
                toks.push({ t: 'var', name: m[0].slice(1, -1) });
                i += m[0].length;
                continue;
            }
        }
        const rest = expr.slice(i);
        const ref = FIELDREF_A.exec(rest);
        if (ref) {
            toks.push({ t: 'ref', ns: ref[1], entity: ref[2], field: ref[3] });
            i += ref[0].length;
            continue;
        }
        const num = NUM_A.exec(rest);
        if (num) {
            toks.push({ t: 'num', v: parseFloat(num[0]) });
            i += num[0].length;
            continue;
        }
        i++; // skip anything unrecognized
    }
    return toks;
}
/** Walk a dot/index field path over resolved data and coerce the leaf to a number. */
export function resolveFieldPath(root, path) {
    const parts = path.replace(/\[(\w+)\]/g, '.$1').split('.').filter(Boolean);
    let cur = root;
    for (const part of parts) {
        if (cur == null)
            return undefined;
        if (Array.isArray(cur)) {
            const idx = Number(part);
            if (Number.isInteger(idx)) {
                cur = cur[idx];
            }
            else {
                const found = cur.find((item) => isIndexedValueMatch(item, part));
                if (found === undefined)
                    return undefined;
                cur = found;
            }
        }
        else if (typeof cur === 'object') {
            const obj = cur;
            if (Object.prototype.hasOwnProperty.call(obj, part)) {
                cur = obj[part];
            }
            else if (isIndexedValueMatch(obj, part)) {
                cur = obj;
            }
            else if (part === '0') {
                // SC2 XML often models a repeatable child as either an array or a
                // singleton object. Let paths such as Cost[0].Cooldown.TimeUse work
                // with both representations.
                cur = obj;
            }
            else {
                return undefined;
            }
        }
        else {
            return undefined;
        }
    }
    return toNumber(cur);
}
const NUMERIC_INDEX_ALIASES = {
    0: ['Life'],
    1: ['Shields'],
    2: ['Energy'],
};
function isIndexedValueMatch(value, selector) {
    if (value == null || typeof value !== 'object')
        return false;
    const obj = value;
    if (!Object.prototype.hasOwnProperty.call(obj, 'index'))
        return false;
    const index = obj['index'];
    if (index === undefined || index === null)
        return false;
    const actual = String(index).toLowerCase();
    const wanted = selector.toLowerCase();
    if (actual === wanted)
        return true;
    return (NUMERIC_INDEX_ALIASES[selector] ?? []).some((alias) => alias.toLowerCase() === actual);
}
function toNumber(v) {
    if (typeof v === 'number')
        return v;
    if (typeof v === 'string') {
        const n = parseFloat(v);
        return Number.isNaN(n) ? undefined : n;
    }
    if (v != null && typeof v === 'object') {
        const o = v;
        if ('value' in o)
            return toNumber(o['value']);
    }
    return undefined;
}
class ExprError extends Error {
}
/** Evaluate a ref expression; throws ExprError on an unresolvable reference. */
function evalExpr(toks, resolver) {
    let pos = 0;
    const peek = () => toks[pos];
    const next = () => toks[pos++];
    function parseExpr() {
        let left = parseTerm();
        for (let p = peek(); p && p.t === 'op' && (p.v === '+' || p.v === '-'); p = peek()) {
            next();
            const right = parseTerm();
            left = p.v === '+' ? left + right : left - right;
        }
        return left;
    }
    function parseTerm() {
        let left = parseFactor();
        for (let p = peek(); p && p.t === 'op' && (p.v === '*' || p.v === '/'); p = peek()) {
            next();
            const right = parseFactor();
            left = p.v === '*' ? left * right : left / right;
        }
        return left;
    }
    function parseFactor() {
        const tok = peek();
        if (!tok)
            throw new ExprError('unexpected end');
        if (tok.t === 'op' && tok.v === '-') {
            next();
            return -parseFactor();
        }
        if (tok.t === 'op' && tok.v === '+') {
            next();
            return parseFactor();
        }
        if (tok.t === 'num') {
            next();
            return tok.v;
        }
        if (tok.t === 'lp') {
            next();
            const v = parseExpr();
            if (peek()?.t === 'rp')
                next();
            return v;
        }
        if (tok.t === 'nested') {
            next();
            return evalExpr(tokenize(tok.expr), resolver);
        }
        if (tok.t === 'var') {
            next();
            return 0;
        }
        if (tok.t === 'ref') {
            next();
            const entity = resolver.getResolved(tok.ns, tok.entity.replace(/@.*$/, ''));
            if (!entity)
                throw new ExprError(`entity-not-found:${tok.ns}/${tok.entity}`);
            const v = resolveFieldPath(entity, tok.field);
            if (v === undefined)
                throw new ExprError(`field-not-found:${tok.ns}/${tok.entity}.${tok.field}`);
            return v;
        }
        throw new ExprError('unexpected token');
    }
    const result = parseExpr();
    return result;
}
function formatNumber(n, precision) {
    if (!Number.isFinite(n))
        return '0';
    return precision > 0 ? n.toFixed(precision) : String(Math.round(n));
}
function formatTime(seconds, precision) {
    return formatNumber(Math.max(0, seconds), precision);
}
function resolveGalaxyVar(name, resolver) {
    const found = resolver.getGalaxyVar?.(name);
    if (found === undefined)
        return { kind: 'galaxyvar', name, text: name };
    if (typeof found !== 'object' || found === null)
        return { kind: 'galaxyvar', name, text: String(found), value: found };
    const text = found.text ?? (found.value !== undefined ? String(found.value) : name);
    const out = { kind: 'galaxyvar', name, text };
    if (found.value !== undefined)
        out.value = found.value;
    if (found.type !== undefined)
        out.type = found.type;
    return out;
}
function attrValue(attrs, name) {
    if (attrs[name] !== undefined)
        return attrs[name];
    const lower = name.toLowerCase();
    return Object.entries(attrs).find(([key]) => key.toLowerCase() === lower)?.[1];
}
function resolveTextConstantValue(value, resolver, seen = new Set()) {
    const trimmed = value.trim();
    if (!trimmed.startsWith('#'))
        return value;
    const name = trimmed.slice(1);
    if (!name || seen.has(name))
        return value;
    seen.add(name);
    const resolved = resolver.getTextConstant?.(name);
    return resolved === undefined ? value : resolveTextConstantValue(resolved, resolver, seen);
}
const LITERAL_COLOR_RE = /^[0-9a-fA-F]{6,8}$/;
const DECIMAL_COLOR_RE = /^\d{1,3}(?:\s*,\s*\d{1,3}){2,3}$/;
/**
 * Resolve a `<c val="…">` color value. Unlike style-attribute constants (which
 * require a leading `#` to distinguish a reference from a literal), `<c val="">`
 * commonly names a FontStyles color constant directly with no `#` (e.g.
 * `<c val="ColorAttackInfo">`) — so a value that isn't a literal hex/decimal
 * color is also tried as a bare constant name, in addition to the `#Name` form.
 */
function resolveColorValue(value, resolver, seen = new Set()) {
    const trimmed = value.trim();
    if (trimmed.startsWith('#'))
        return resolveTextConstantValue(value, resolver, seen);
    if (!trimmed || LITERAL_COLOR_RE.test(trimmed.replace(/^#/, '')) || DECIMAL_COLOR_RE.test(trimmed))
        return value;
    if (seen.has(trimmed))
        return value;
    seen.add(trimmed);
    const resolved = resolver.getTextConstant?.(trimmed);
    return resolved === undefined ? value : resolveColorValue(resolved, resolver, seen);
}
function resolveTextStyleInfo(style, resolver) {
    const info = resolver.getTextStyle?.(style);
    if (info === undefined || info.resolved === true)
        return info;
    const attrs = {};
    for (const [key, value] of Object.entries(info.attrs))
        attrs[key] = resolveTextConstantValue(value, resolver);
    const fonts = info.fonts?.map(font => resolveTextConstantValue(font, resolver));
    return { ...info, attrs, ...(fonts?.length ? { fonts } : {}) };
}
function stringValue(v) {
    if (typeof v === 'string' && v)
        return v;
    if (v != null && typeof v === 'object') {
        const value = v['value'];
        if (typeof value === 'string' && value)
            return value;
    }
    return undefined;
}
function indexedEntryByIndex(value, index) {
    if (Array.isArray(value)) {
        return value.find((item) => isIndexedValueMatch(item, index));
    }
    return isIndexedValueMatch(value, index) ? value : undefined;
}
function resolveHotkeyName(val, resolver) {
    const hotkey = val.trim();
    if (!hotkey)
        return undefined;
    const gameUi = resolver.getResolved('GameUI', 'Dflt');
    const entry = indexedEntryByIndex(gameUi?.['HotkeyInfoArray'], hotkey);
    const nameKey = stringValue(entry?.['Name']);
    if (!nameKey)
        return undefined;
    const localized = resolver.getString?.(nameKey, ['GameHotkeys', 'GameStrings']);
    return { text: localized ?? hotkey, nameKey };
}
function runtimeDynamicName(expr) {
    const token = /\$([A-Za-z][A-Za-z0-9_]*)(?::[^$]*)?\$/.exec(expr);
    if (token)
        return token[1];
    const nested = /\[d\s+([A-Za-z][A-Za-z0-9_]*)\s*=/i.exec(expr);
    if (nested && !/^(ref|stringref|time)$/i.test(nested[1]))
        return nested[1];
    return undefined;
}
function isRuntimeTimeName(expr) {
    return /^(?:GameTime|MissionTime|AITime|DateTime|TimeOfDay)$/i.test(expr.trim());
}
function resolveAttrText(value, resolver, depth, seen) {
    if (!(value.includes('<') || value.includes('$') || value.includes('~')))
        return value;
    return renderPlain(resolveSegments(parseMarkup(value), resolver, depth + 1, new Set(seen)));
}
function resolveDynamic(name, value, attrs, resolver, depth, seen) {
    const resolvedAttrs = {};
    for (const [key, raw] of Object.entries(attrs))
        resolvedAttrs[key] = resolveAttrText(raw, resolver, depth, seen);
    const resolvedValue = resolveAttrText(value, resolver, depth, seen);
    const out = { kind: 'dynamic', name, value: resolvedValue, text: resolvedValue || name };
    if (Object.keys(resolvedAttrs).length > 0)
        out.attrs = resolvedAttrs;
    return out;
}
function resolveBracketedAttribute(value, resolver, depth, seen) {
    if (!value.trim().toLowerCase().startsWith('[d'))
        return undefined;
    const parsed = parseBracketedDTag(value);
    if (!parsed)
        return undefined;
    return resolveSegments([parsed], resolver, depth + 1, new Set(seen))[0];
}
function segmentText(seg) {
    if (seg.kind === 'newline')
        return '\n';
    if (seg.kind === 'img' || seg.kind === 'unknown')
        return '';
    if (seg.kind === 'color' || seg.kind === 'style' || seg.kind === 'list' || seg.kind === 'container')
        return renderPlain(seg.children);
    return seg.text;
}
function previewTokenText(text) {
    return `‹${text}›`;
}
function needsSpaceBeforeHotkey(renderedBefore, hotkeyText) {
    return renderedBefore.length > 0 && !/\s$/.test(renderedBefore) && !/^\s/.test(hotkeyText);
}
// ─── Public resolution ───────────────────────────────────────────────────────
function resolveSegments(segs, resolver, depth, seen) {
    const resolved = segs.map((s) => {
        switch (s.kind) {
            case 'text': return { kind: 'text', text: s.text };
            case 'newline': return { kind: 'newline' };
            case 'unknown': return { kind: 'unknown', text: s.raw };
            case 'token': return { kind: 'token', token: s.token, text: previewTokenText(s.token) };
            case 'galaxyvar': return resolveGalaxyVar(s.name, resolver);
            case 'dynamic': return resolveDynamic(s.name, s.value, s.attrs, resolver, depth, seen);
            case 'space': return { kind: 'space', text: ' ' };
            case 'highlight': return { kind: 'highlight', text: '' };
            case 'hotkey': {
                const pre = attrValue(s.attrs, 'pre') ?? '';
                const post = attrValue(s.attrs, 'post') ?? '';
                const resolved = resolveHotkeyName(s.val, resolver);
                const text = previewTokenText(`${pre}${resolved?.text ?? (s.val || 'hotkey')}${post}`);
                return resolved?.nameKey
                    ? { kind: 'hotkey', val: s.val, nameKey: resolved.nameKey, text }
                    : { kind: 'hotkey', val: s.val, text };
            }
            case 'color': {
                const dynamic = resolveBracketedAttribute(s.color, resolver, depth, seen);
                const color = dynamic ? segmentText(dynamic) : resolveColorValue(s.color, resolver);
                const children = resolveSegments(s.children, resolver, depth, seen);
                if (dynamic)
                    return { kind: 'color', color, source: s.color, dynamic, children };
                return color === s.color ? { kind: 'color', color, children } : { kind: 'color', color, source: s.color, children };
            }
            case 'style': {
                const textStyle = resolveTextStyleInfo(s.style, resolver);
                return textStyle === undefined
                    ? { kind: 'style', style: s.style, children: resolveSegments(s.children, resolver, depth, seen) }
                    : { kind: 'style', style: s.style, textStyle, children: resolveSegments(s.children, resolver, depth, seen) };
            }
            case 'list': return { kind: 'list', tag: s.tag, children: resolveSegments(s.children, resolver, depth, seen) };
            case 'container': return { kind: 'container', tag: s.tag, attrs: s.attrs, children: resolveSegments(s.children, resolver, depth, seen) };
            case 'img': {
                const out = { kind: 'img', path: s.path, attrs: s.attrs };
                if (s.width !== undefined)
                    out.width = s.width;
                if (s.height !== undefined)
                    out.height = s.height;
                return out;
            }
            case 'ref':
            case 'time': {
                const runtimeName = runtimeDynamicName(s.expr);
                if (runtimeName)
                    return { kind: 'dynamic', name: runtimeName, value: s.expr, text: runtimeName };
                try {
                    const value = evalExpr(tokenize(s.expr), resolver);
                    const precision = Number(s.opts['precision'] ?? 0) || 0;
                    const text = s.kind === 'time' ? formatTime(value, precision) : formatNumber(value, precision);
                    return s.kind === 'time' ? { kind: 'time', value, text } : { kind: 'ref', value, text };
                }
                catch (err) {
                    if (s.kind === 'time' && isRuntimeTimeName(s.expr))
                        return { kind: 'time', text: s.expr.trim() };
                    const error = err instanceof ExprError ? err.message : 'expr-error';
                    return { kind: s.kind === 'time' ? 'time' : 'ref', text: '?', error };
                }
            }
            case 'stringref': {
                const entity = resolver.getResolved(s.ns, s.entity.replace(/@.*$/, ''));
                if (!entity)
                    return { kind: 'stringref', text: '?', error: `entity-not-found:${s.ns}/${s.entity}` };
                const raw = entity[s.field];
                // A field value may itself be a string key → resolve once with cycle guard.
                if (typeof raw === 'string' && resolver.getString && depth < 8 && !seen.has(raw)) {
                    const indirect = resolver.getString(raw);
                    if (indirect !== undefined) {
                        seen.add(raw);
                        const nested = resolveSegments(parseMarkup(indirect), resolver, depth + 1, seen);
                        return { kind: 'stringref', text: renderPlain(nested), value: indirect };
                    }
                }
                const num = toNumber(raw);
                const text = num !== undefined ? String(num) : typeof raw === 'string' ? raw : '?';
                return typeof raw === 'string'
                    ? { kind: 'stringref', text, value: raw }
                    : { kind: 'stringref', text };
            }
        }
    });
    let renderedBefore = '';
    return resolved.map((segment) => {
        const adjusted = segment.kind === 'hotkey' && needsSpaceBeforeHotkey(renderedBefore, segment.text)
            ? { ...segment, text: ` ${segment.text}` }
            : segment;
        renderedBefore += segmentText(adjusted);
        return adjusted;
    });
}
/** Plain-text rendering of resolved segments (markup stripped). */
export function renderPlain(segments) {
    let out = '';
    for (const s of segments) {
        if (s.kind === 'newline')
            out += '\n';
        else if (s.kind === 'color' || s.kind === 'style' || s.kind === 'list' || s.kind === 'container')
            out += renderPlain(s.children);
        else if (s.kind === 'img')
            out += '';
        else if (s.kind === 'unknown')
            out += '';
        else
            out += s.text;
    }
    return out;
}
/** Resolve a localized string value against catalog data. */
export function resolveStringValue(value, resolver) {
    const segments = resolveSegments(parseMarkup(value), resolver, 0, new Set());
    return { rendered: renderPlain(segments), segments };
}
export function validateStringRefs(strings, resolver) {
    const issues = [];
    for (const [key, value] of strings) {
        for (const seg of resolveStringValue(value, resolver).segments) {
            collectIssues(key, value, seg, issues);
        }
    }
    return issues;
}
function collectIssues(key, value, seg, out) {
    if ((seg.kind === 'ref' || seg.kind === 'stringref') && seg.error) {
        const m = /^(?:entity-not-found|field-not-found):([^/]+)\/([^.]+)(?:\.(.+))?$/.exec(seg.error);
        out.push({ key, ns: m?.[1] ?? '', entity: m?.[2] ?? '', field: m?.[3] ?? '', error: seg.error });
    }
    else if (seg.kind === 'color' || seg.kind === 'style' || seg.kind === 'list' || seg.kind === 'container') {
        if (seg.kind === 'color' && seg.dynamic)
            collectIssues(key, value, seg.dynamic, out);
        for (const c of seg.children)
            collectIssues(key, value, c, out);
    }
}

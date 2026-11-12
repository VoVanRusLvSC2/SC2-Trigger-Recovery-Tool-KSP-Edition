import { lineStartOffsets, positionAt, commentSpans, insideComment } from '../../../shared/xml/text-position.js';
const ATTR_RE = /([A-Za-z_][\w.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
export function createTextStyleSheet() {
    return { constants: new Map(), fontGroups: new Map(), styles: new Map() };
}
export function cloneTextStyleSheet(sheet) {
    return {
        constants: new Map(sheet.constants),
        fontGroups: new Map([...sheet.fontGroups].map(([k, v]) => [
            k,
            { ...v, attrs: { ...v.attrs }, ranges: v.ranges.map(r => ({ ...r })) },
        ])),
        styles: new Map([...sheet.styles].map(([k, v]) => [k, { ...v, attrs: { ...v.attrs } }])),
    };
}
export function mergeTextStyleSheetsInto(target, source) {
    for (const [k, v] of source.constants)
        target.constants.set(k, v);
    for (const [k, v] of source.fontGroups)
        target.fontGroups.set(k, { ...v, attrs: { ...v.attrs }, ranges: v.ranges.map(r => ({ ...r })) });
    for (const [k, v] of source.styles)
        target.styles.set(k, { ...v, attrs: { ...v.attrs } });
}
export function mergeTextStyleSheets(base, override) {
    const out = cloneTextStyleSheet(base);
    mergeTextStyleSheetsInto(out, override);
    return out;
}
/** Build an effective view from sheets already ordered by the owning context. Later sheets win. */
export function createResolvedStyleSnapshot(sources, options = {}) {
    const sheet = createTextStyleSheet();
    const provenance = new Map();
    const definitions = new Map();
    const ambiguous = new Set();
    const canonicalRecord = (value) => Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    const record = (key, value) => {
        const signature = JSON.stringify(value);
        const previous = definitions.get(key);
        if (options.authoritativeOrder === false && previous !== undefined && previous !== signature) {
            ambiguous.add(key);
        }
        definitions.set(key, signature);
    };
    for (const source of sources) {
        const parsed = parseFontStyles(source.text);
        for (const [name, value] of parsed.constants)
            record(`constant\0${name}`, value);
        for (const [name, value] of parsed.fontGroups)
            record(`font-group\0${name}`, {
                attrs: canonicalRecord(value.attrs),
                ranges: value.ranges.map(canonicalRecord),
            });
        for (const [name, value] of parsed.styles)
            record(`style\0${name}`, canonicalRecord(value.attrs));
        mergeTextStyleSheetsInto(sheet, parsed);
        const origin = { uri: source.uri, ...(source.version === undefined ? {} : { version: source.version }) };
        for (const name of parsed.constants.keys())
            provenance.set(`constant\0${name}`, { ...origin, kind: 'constant', name });
        for (const name of parsed.fontGroups.keys())
            provenance.set(`font-group\0${name}`, { ...origin, kind: 'font-group', name });
        for (const name of parsed.styles.keys())
            provenance.set(`style\0${name}`, { ...origin, kind: 'style', name });
    }
    for (const key of ambiguous) {
        const separator = key.indexOf('\0');
        const kind = key.slice(0, separator);
        const name = key.slice(separator + 1);
        if (kind === 'constant')
            sheet.constants.delete(name);
        else if (kind === 'font-group')
            sheet.fontGroups.delete(name);
        else
            sheet.styles.delete(name);
        provenance.delete(key);
    }
    const complete = options.authoritativeOrder === false ? false : options.complete === true;
    const constantReference = (value) => {
        const trimmed = value.trim();
        return trimmed.startsWith('#') && trimmed.length > 1 ? trimmed.slice(1) : undefined;
    };
    const constantIsUnambiguous = (name, seen = new Set()) => {
        if (ambiguous.has(`constant\0${name}`))
            return false;
        if (seen.has(name))
            return true;
        seen.add(name);
        const next = sheet.constants.get(name);
        const reference = next === undefined ? undefined : constantReference(next);
        return reference === undefined || constantIsUnambiguous(reference, seen);
    };
    const valuesAreUnambiguous = (values) => {
        for (const value of values) {
            const constant = constantReference(value);
            if (constant !== undefined && !constantIsUnambiguous(constant))
                return false;
        }
        return true;
    };
    const fontGroupIsUnambiguous = (name) => {
        if (ambiguous.has(`font-group\0${name}`))
            return false;
        const group = sheet.fontGroups.get(name);
        return group === undefined || (valuesAreUnambiguous(Object.values(group.attrs)) &&
            group.ranges.every(range => valuesAreUnambiguous(Object.values(range))));
    };
    const styleIsUnambiguous = (name, seen = new Set()) => {
        if (ambiguous.has(`style\0${name}`))
            return false;
        if (seen.has(name))
            return true;
        const style = sheet.styles.get(name);
        if (style === undefined)
            return true;
        seen.add(name);
        if (!valuesAreUnambiguous(Object.values(style.attrs)))
            return false;
        const template = style.attrs['template'];
        if (template !== undefined) {
            const constant = constantReference(template);
            const parent = resolveStyleValue(sheet, template);
            if ((constant !== undefined && !constantIsUnambiguous(constant)) || !styleIsUnambiguous(parent, seen))
                return false;
        }
        const font = style.attrs['font'];
        if (font !== undefined) {
            const constant = constantReference(font);
            const group = resolveStyleValue(sheet, font);
            if ((constant !== undefined && !constantIsUnambiguous(constant)) ||
                !fontGroupIsUnambiguous(group))
                return false;
        }
        return true;
    };
    const styleProvenance = (name) => {
        const out = [];
        const seen = new Set();
        let current = name;
        while (current !== undefined && !seen.has(current)) {
            seen.add(current);
            const own = provenance.get(`style\0${current}`);
            if (own !== undefined)
                out.push(own);
            const parent = sheet.styles.get(current)?.attrs['template'];
            current = parent === undefined ? undefined : resolveStyleValue(sheet, parent);
        }
        const font = resolveTextStyle(sheet, name)?.attrs['font'];
        if (font !== undefined) {
            const group = provenance.get(`font-group\0${resolveStyleValue(sheet, font)}`);
            if (group !== undefined)
                out.push(group);
        }
        return out;
    };
    return {
        sheet,
        ...(options.contextRevision === undefined ? {} : { contextRevision: options.contextRevision }),
        complete,
        sources: [...sources],
        resolveConstant: name => constantIsUnambiguous(name) ? resolveTextConstant(sheet, name) : undefined,
        resolveStyle(name) {
            if (!styleIsUnambiguous(name))
                return undefined;
            const resolved = resolveTextStyle(sheet, name);
            return resolved === undefined ? undefined : {
                ...resolved,
                resolved: true,
                provenance: styleProvenance(name),
                ...(options.contextRevision === undefined ? {} : { contextRevision: options.contextRevision }),
                complete,
            };
        },
    };
}
export function parseFontStyles(xmlText) {
    const out = createTextStyleSheet();
    // Match against the ORIGINAL text (not a comment-stripped copy) so `match.index`
    // maps to real source offsets; skip matches that fall inside a comment span.
    const starts = lineStartOffsets(xmlText);
    const spans = commentSpans(xmlText);
    for (const match of xmlText.matchAll(/<Constant\b([^>]*)\/?>/gi)) {
        if (insideComment(spans, match.index))
            continue;
        const attrs = parseAttrs(match[1] ?? '');
        const name = attrs['name'];
        if (name)
            out.constants.set(name, attrs['val'] ?? '');
    }
    for (const match of xmlText.matchAll(/<FontGroup\b([^>]*)>([\s\S]*?)<\/FontGroup>/gi)) {
        if (insideComment(spans, match.index))
            continue;
        const attrs = parseAttrs(match[1] ?? '');
        const name = attrs['name'];
        if (!name)
            continue;
        const ranges = [];
        // Strip comments from the FontGroup body before scanning for ranges, so a
        // commented-out <CodepointRange> is not counted (ranges carry no position, so
        // stripping — rather than offset-skipping — is fine here).
        const body = (match[2] ?? '').replace(/<!--[\s\S]*?-->/g, '');
        for (const range of body.matchAll(/<CodepointRange\b([^>]*)\/?>/gi)) {
            ranges.push(parseAttrs(range[1] ?? ''));
        }
        out.fontGroups.set(name, { name, attrs, ranges, position: positionAt(starts, match.index) });
    }
    for (const match of xmlText.matchAll(/<Style\b([^>]*)\/?>/gi)) {
        if (insideComment(spans, match.index))
            continue;
        const attrs = parseAttrs(match[1] ?? '');
        const name = attrs['name'];
        if (name)
            out.styles.set(name, { name, attrs, position: positionAt(starts, match.index) });
    }
    return out;
}
export function resolveTextConstant(sheet, name) {
    return resolveConstantValue(sheet, `#${name}`, new Set());
}
export function resolveTextStyle(sheet, name) {
    const attrs = resolveStyleAttrs(sheet, name, new Set());
    if (attrs === undefined)
        return undefined;
    const fonts = resolveStyleFonts(sheet, attrs);
    return { name, attrs, ...(fonts.length ? { fonts } : {}) };
}
/** Style-owned projection used by text consumers; callers do not reinterpret Style defaults. */
export function resolvedTextStyleCss(style) {
    const value = (name) => {
        const direct = style.attrs[name];
        if (direct !== undefined)
            return direct;
        const lower = name.toLowerCase();
        return Object.entries(style.attrs).find(([key]) => key.toLowerCase() === lower)?.[1];
    };
    const color = (input) => {
        const decimal = input.split(',').map(part => Number(part.trim()));
        if ((decimal.length === 3 || decimal.length === 4) && decimal.every(byte => Number.isFinite(byte) && byte >= 0 && byte <= 255)) {
            if (decimal.length === 3)
                return `rgb(${decimal[0]} ${decimal[1]} ${decimal[2]})`;
            return `rgb(${decimal[1]} ${decimal[2]} ${decimal[3]} / ${Math.max(0, Math.min(1, decimal[0] / 255))})`;
        }
        const hex = input.replace(/^#/, '');
        return /^[0-9a-fA-F]{6,8}$/.test(hex) ? `#${hex.slice(0, 6)}` : 'inherit';
    };
    const length = (input) => {
        const trimmed = input?.trim();
        if (!trimmed)
            return undefined;
        if (/^-?\d+(?:\.\d+)?$/.test(trimmed))
            return `${trimmed}px`;
        return /^-?\d+(?:\.\d+)?(?:px|em|rem|%)$/i.test(trimmed) ? trimmed : undefined;
    };
    const flags = new Set((value('styleflags') ?? '').split('|').map(flag => flag.trim().toLowerCase()).filter(Boolean));
    const css = [];
    const textColor = value('textcolor');
    const height = length(value('height'));
    const fonts = (style.fonts ?? []).map(font => font.replace(/\\/g, '/').split('/').pop()?.replace(/\.[^.]+$/, '').trim()).filter(Boolean);
    if (textColor)
        css.push(`color:${color(textColor)}`);
    if (height)
        css.push(`font-size:${height}`);
    if (fonts.length)
        css.push(`font-family:${fonts.map(font => `"${font.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`).join(',')}`);
    if (flags.has('bold'))
        css.push('font-weight:700');
    if (flags.has('italic'))
        css.push('font-style:italic');
    if (flags.has('uppercase'))
        css.push('text-transform:uppercase');
    const lineSpacing = value('linespacing');
    if (lineSpacing && /^\d+(?:\.\d+)?$/.test(lineSpacing.trim()))
        css.push(`line-height:${lineSpacing.trim()}`);
    const characterSpacing = length(value('characterspacing'));
    if (characterSpacing)
        css.push(`letter-spacing:${characterSpacing}`);
    const shadowOffset = length(value('shadowoffset')) ?? (flags.has('shadow') ? '1px' : undefined);
    const shadowColor = value('shadowcolor') ? color(value('shadowcolor')) : 'rgb(0 0 0 / 0.75)';
    const glow = value('glowcolor');
    const shadows = [];
    if (shadowOffset)
        shadows.push(`${shadowOffset} ${shadowOffset} 0 ${shadowColor}`);
    if (glow)
        shadows.push(`0 0 4px ${color(glow)}`);
    if (shadows.length)
        css.push(`text-shadow:${shadows.join(',')}`);
    const outlineWidth = length(value('outlinewidth'));
    const outlineColor = value('outlinecolor');
    if (outlineWidth && outlineColor)
        css.push(`-webkit-text-stroke:${outlineWidth} ${color(outlineColor)}`);
    return css.length ? `${css.join(';')};` : '';
}
/**
 * A sample line in a resolved style as an SVG `data:` image a hover can show (parity plan 4.1): the
 * style's own CSS projection on a dark field, so light game colours stay readable. The game's fonts
 * are not installed with the editor, so the face falls back; colour, size, weight, shadow, glow and
 * outline are the style's.
 */
export function textStyleSampleImage(style, sample = 'StarCraft II') {
    const escape = (text) => text.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
    // The projection quotes font names; inside a `style="…"` attribute they take single quotes.
    const css = resolvedTextStyleCss(style).replace(/"/g, "'");
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="56">' +
        '<rect width="100%" height="100%" fill="#1b1f24"/>' +
        '<foreignObject x="8" y="4" width="304" height="48">' +
        `<div xmlns="http://www.w3.org/1999/xhtml" style="color:#ffffff;font-family:sans-serif;font-size:16px;white-space:nowrap;${escape(css)}">${escape(sample)}</div>` +
        '</foreignObject></svg>';
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
function parseAttrs(s) {
    const out = {};
    ATTR_RE.lastIndex = 0;
    let match;
    while ((match = ATTR_RE.exec(s)) !== null) {
        out[match[1]] = match[2] ?? match[3] ?? '';
    }
    return out;
}
function resolveConstantValue(sheet, value, seen) {
    const trimmed = value.trim();
    if (!trimmed.startsWith('#'))
        return value;
    const name = trimmed.slice(1);
    if (!name || seen.has(name))
        return undefined;
    seen.add(name);
    const found = sheet.constants.get(name);
    if (found === undefined)
        return undefined;
    return found.trim().startsWith('#') ? resolveConstantValue(sheet, found, seen) : found;
}
function resolveStyleValue(sheet, value) {
    return value.trim().startsWith('#')
        ? (resolveConstantValue(sheet, value, new Set()) ?? value)
        : value;
}
function resolveStyleAttrs(sheet, name, seen) {
    if (seen.has(name))
        return undefined;
    seen.add(name);
    const style = sheet.styles.get(name);
    if (style === undefined)
        return undefined;
    const parentName = style.attrs['template']
        ? resolveStyleValue(sheet, style.attrs['template'])
        : undefined;
    if (parentName !== undefined && seen.has(parentName))
        return undefined;
    const parent = parentName ? resolveStyleAttrs(sheet, parentName, seen) : undefined;
    if (parentName !== undefined && parent === undefined && sheet.styles.has(parentName))
        return undefined;
    const attrs = parent ? { ...parent } : {};
    for (const [key, value] of Object.entries(style.attrs)) {
        if (key === 'name')
            continue;
        attrs[key] = resolveStyleValue(sheet, value);
    }
    return attrs;
}
function resolveStyleFonts(sheet, attrs) {
    const font = attrs['font'];
    if (!font)
        return [];
    const target = resolveStyleValue(sheet, font);
    const group = sheet.fontGroups.get(target);
    if (group === undefined)
        return [target];
    const out = [];
    for (const range of group.ranges) {
        const value = range['font'];
        if (value)
            out.push(resolveStyleValue(sheet, value));
    }
    return out;
}
//# sourceMappingURL=font-styles.js.map
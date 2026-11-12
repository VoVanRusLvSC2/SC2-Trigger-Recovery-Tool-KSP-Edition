/**
 * Render resolved SC2 string markup to styled HTML. Implements the visualization
 * vocabulary harvested from the wiki (`-references/website/wiki`): colored spans,
 * `<n/>`→`<br>`, inline resource/icon glyphs, and `data-ref` wrapping for selective
 * re-render. See docs/tasks-complete/entity-cards-strings/STRING_REF_GRAMMAR.md and the wiki analysis.
 *
 * Browser-safe: pure string building. The optional `iconResolver` lets the VS Code
 * webview turn an asset path into an `<img src>` (e.g. a decoded DDS data URI) while
 * Node tests pass a stub.
 */
import { resolvedTextStyleCss } from '../../../style/shared/font-styles.js';
function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
}
function attrValue(attrs, name) {
    if (attrs[name] !== undefined)
        return attrs[name];
    const lower = name.toLowerCase();
    return Object.entries(attrs).find(([key]) => key.toLowerCase() === lower)?.[1];
}
/** SC2 color values are `RRGGBBAA` (or `RRGGBB`); take the RGB prefix for CSS. */
function cssColor(val) {
    const dec = val.split(',').map((x) => Number(x.trim()));
    if ((dec.length === 3 || dec.length === 4) && dec.every((x) => Number.isFinite(x) && x >= 0 && x <= 255)) {
        if (dec.length === 3) {
            const [r = 0, g = 0, b = 0] = dec;
            return `rgb(${r} ${g} ${b})`;
        }
        const [a = 255, r = 0, g = 0, b = 0] = dec;
        return `rgb(${r} ${g} ${b} / ${Math.max(0, Math.min(1, a / 255))})`;
    }
    const hex = val.replace(/^#/, '');
    return /^[0-9a-fA-F]{6,8}$/.test(hex) ? `#${hex.slice(0, 6)}` : 'inherit';
}
function cssLength(val) {
    const v = val?.trim();
    if (!v)
        return undefined;
    if (/^-?\d+(?:\.\d+)?$/.test(v))
        return `${v}px`;
    if (/^-?\d+(?:\.\d+)?(?:px|em|rem|%)$/i.test(v))
        return v;
    return undefined;
}
function cssVerticalAlign(val) {
    switch (val?.trim().toLowerCase()) {
        case 'top': return 'text-top';
        case 'middle':
        case 'uppermiddle':
        case 'absolutemiddle':
            return 'middle';
        case 'bottom': return 'text-bottom';
        default: return undefined;
    }
}
function styleFlags(value) {
    return new Set((value ?? '').split('|').map(flag => flag.trim().toLowerCase()).filter(Boolean));
}
function fontFamilyName(font) {
    const name = font.replace(/\\/g, '/').split('/').pop()?.replace(/\.[^.]+$/, '').trim();
    return name || undefined;
}
function cssString(value) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
function textStyleCss(s) {
    const info = s.textStyle;
    return info === undefined ? '' : resolvedTextStyleCss(info);
}
function textStyleTitle(s) {
    const info = s.textStyle;
    if (info === undefined)
        return s.style;
    const fonts = info.fonts?.length ? ` fonts=${info.fonts.join(',')}` : '';
    return `${s.style}${fonts}`;
}
function imageStyle(s) {
    const styles = [];
    const width = cssLength(s.width ?? attrValue(s.attrs, 'width'));
    const height = cssLength(s.height ?? attrValue(s.attrs, 'height'));
    const align = cssVerticalAlign(attrValue(s.attrs, 'alignment'));
    const color = attrValue(s.attrs, 'color');
    if (width)
        styles.push(`width:${width}`);
    if (height)
        styles.push(`height:${height}`);
    if (align)
        styles.push(`vertical-align:${align}`);
    if (color)
        styles.push(`background-color:${cssColor(color)}`);
    return styles.length ? `${styles.join(';')};` : '';
}
function imageTitle(s) {
    const extras = ['texcoords', 'texsheet', 'texanim', 'resolution', 'entrydims']
        .map((name) => {
        const value = attrValue(s.attrs, name);
        return value ? `${name}=${value}` : '';
    })
        .filter(Boolean);
    return [s.path, ...extras].filter(Boolean).join(' ');
}
function dynamicTitle(s) {
    const attrs = Object.entries(s.attrs ?? {})
        .filter(([key]) => key.toLowerCase() !== s.name.toLowerCase())
        .map(([key, value]) => `${key}=${value}`);
    return [s.name, ...attrs].filter(Boolean).join(' ');
}
function computedTitle(s) {
    if (s.kind === 'dynamic')
        return dynamicTitle(s);
    if (s.kind === 'ref' || s.kind === 'time' || s.kind === 'stringref')
        return s.error ? `${s.kind}: ${s.error}` : `${s.kind}: ${s.text}`;
    if (s.kind === 'galaxyvar')
        return s.type ? `${s.type} ${s.name}` : s.name;
    return 'computed';
}
function renderSegments(segments, opts) {
    let out = '';
    for (const s of segments) {
        switch (s.kind) {
            case 'text':
                out += escapeHtml(s.text);
                break;
            case 'newline':
                out += '<br>';
                break;
            case 'unknown':
                out += escapeHtml(s.text);
                break; // render literally, e.g. a stray "<None>"
            case 'space':
                out += '&nbsp;';
                break;
            case 'highlight': break;
            case 'token':
                out += `<span class="sc-token">${escapeHtml(s.text)}</span>`;
                break;
            case 'hotkey':
                out += `<span class="sc-token sc-hotkey">${escapeHtml(s.text)}</span>`;
                break;
            case 'dynamic':
                out += `<span class="sc-dynamic" title="${escapeAttr(dynamicTitle(s))}">${escapeHtml(s.text)}</span>`;
                break;
            case 'time':
                out += `<span class="sc-ref sc-time">${escapeHtml(s.text)}</span>`;
                break;
            case 'ref': {
                const cls = s.error ? 'sc-ref sc-ref-error' : 'sc-ref';
                out += opts.dataRefSpans === false
                    ? `<span class="${cls}">${escapeHtml(s.text)}</span>`
                    : `<span class="${cls}" data-ref="1">${escapeHtml(s.text)}</span>`;
                break;
            }
            case 'stringref': {
                const cls = s.error ? 'sc-ref sc-ref-error' : 'sc-stringref';
                out += `<span class="${cls}">${escapeHtml(s.text)}</span>`;
                break;
            }
            case 'galaxyvar': {
                const cls = s.error ? 'sc-galaxyvar sc-ref-error' : 'sc-galaxyvar';
                const title = s.type ? `${s.type} ${s.name}` : s.name;
                out += `<span class="${cls}" data-galaxy-var="${escapeAttr(s.name)}" title="${escapeAttr(title)}">${escapeHtml(s.text)}</span>`;
                break;
            }
            case 'color':
                {
                    const title = s.dynamic ? `computed ${computedTitle(s.dynamic)}` : (s.source ? `${s.source} -> ${s.color}` : '');
                    out += `<span${s.dynamic ? ' class="sc-dynamic-attr"' : ''} style="color:${cssColor(s.color)}"${title ? ` title="${escapeAttr(title)}"` : ''}>${renderSegments(s.children, opts)}</span>`;
                }
                break;
            case 'style':
                {
                    const css = textStyleCss(s);
                    const title = textStyleTitle(s);
                    out += `<span class="sc-style sc-style-${escapeAttr(s.style)}"${css ? ` style="${escapeAttr(css)}"` : ''} title="${escapeAttr(title)}">${renderSegments(s.children, opts)}</span>`;
                }
                break;
            case 'list':
                out += `<${s.tag} class="sc-list">${renderSegments(s.children, opts)}</${s.tag}>`;
                break;
            case 'container': {
                const inner = renderSegments(s.children, opts);
                if (s.tag === 'w')
                    out += `<span class="sc-nowrap">${inner}</span>`;
                else if (s.tag === 'h')
                    out += `<span class="sc-highlight">${inner}</span>`;
                else if (s.tag === 'a') {
                    const name = attrValue(s.attrs, 'name') ?? '';
                    const href = attrValue(s.attrs, 'href') ?? '';
                    out += `<span class="sc-anchor" data-anchor-name="${escapeAttr(name)}" data-href="${escapeAttr(href)}">${inner}</span>`;
                }
                else if (s.tag === 'lang')
                    out += `<span class="sc-lang">${inner}</span>`;
                else
                    out += `<span class="sc-ignore">${inner}</span>`;
                break;
            }
            case 'img': {
                const style = imageStyle(s);
                const title = imageTitle(s);
                const color = attrValue(s.attrs, 'color');
                const url = opts.iconResolver?.(s.path);
                if (!s.path && color) {
                    out += `<span class="sc-img sc-img-color" style="${escapeAttr(style)}" title="${escapeAttr(title)}"></span>`;
                    break;
                }
                out += url
                    ? `<img class="sc-img" src="${escapeAttr(url)}" style="${escapeAttr(style)}" alt="" title="${escapeAttr(title)}">`
                    : `<img class="sc-img" data-img="${escapeAttr(s.path)}" style="${escapeAttr(style)}" alt="" title="${escapeAttr(title)}">`;
                break;
            }
        }
    }
    return out;
}
/** Render resolved markup segments to an HTML fragment string. */
export function renderMarkupHtml(segments, opts = {}) {
    return renderSegments(segments, opts);
}

/**
 * `ComponentList.SC2Components` — the package's own list of what the game loads.
 *
 * The parse is the shared one every SC2 container already uses to find its text locales; this file
 * only says whether a byte run is such a list at all.
 */
const COMPONENTS_ROOT = /^\s*(?:<\?xml\b[^>]*>\s*)?<Components(?:\s|>|\/>)/u;
export function isComponentListText(text) {
    return COMPONENTS_ROOT.test(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
}
export function parseComponentListEntries(text) {
    return Object.freeze(parseComponentList(text).components.map(entry => Object.freeze({
        type: entry.type,
        path: entry.path,
        ...(entry.locale === undefined ? {} : { locale: entry.locale }),
    })));
}
/** Whether the list declares a `Type="text"` component for `locale` (compared without case). */
export function componentListHasLocale(text, locale) {
    const wanted = locale.toLowerCase();
    return parseComponentListEntries(text).some(entry => entry.type.toLowerCase() === 'text' && entry.locale?.toLowerCase() === wanted);
}
/**
 * Declare a text locale: insert `<DataComponent Type="text" Locale="…">` before `</Components>`,
 * reusing an existing text component's value and indentation. Unchanged when the locale is already
 * declared or the list has no `</Components>`.
 */
export function addTextLocaleToComponentList(text, locale, value = 'GameText') {
    if (componentListHasLocale(text, locale))
        return text;
    const close = text.search(/<\/Components>/iu);
    if (close === -1)
        return text;
    const existing = /([ \t]*)<DataComponent\b[^>]*\bType="text"[^>]*>([^<]*)<\/DataComponent>\s*\n/iu.exec(text);
    const indent = existing?.[1] ?? '    ';
    const line = `${indent}<DataComponent Type="text" Locale="${locale}">${existing?.[2] ?? value}</DataComponent>\n`;
    const lineStart = text.lastIndexOf('\n', close - 1) + 1;
    return text.slice(0, lineStart) + line + text.slice(lineStart);
}
/**
 * LEGACY plain-text reader: returns every non-comment line. Only the custom/test
 * flat-text `ComponentList.SC2Components` convention (one dependency path per line)
 * uses this shape. Real SC2 files are XML — use {@link parseComponentList}, which
 * routes by `isXml`.
 */
export function parseSc2ComponentList(text) {
    const lines = [];
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line && !line.startsWith('//') && !line.startsWith('#')) {
            lines.push(line);
        }
    }
    return lines;
}
const RE_DATA_COMPONENT = /<DataComponent\b([^>]*)>([\s\S]*?)<\/DataComponent>/gi;
/**
 * Structurally parse a SC2 `ComponentList.SC2Components` file (the XML form), yielding
 * typed `<DataComponent>` records and the authoritative set of declared locales.
 *
 * Browser-safe: pure regex/string scanning, zero deps. Attribute order is tolerated
 * (`Type` and `Locale` are matched independently). `isXml` is false for the legacy
 * flat-text convention (no `<Components>` wrapper), in which case there are no
 * components/locales — callers fall back to {@link parseSc2ComponentList}.
 */
export function parseComponentList(text) {
    if (text.charCodeAt(0) === 0xfeff)
        text = text.slice(1); // strip BOM
    const isXml = /<Components\b/i.test(text);
    const components = [];
    const locales = [];
    if (!isXml)
        return { components, locales, isXml };
    const seen = new Set();
    RE_DATA_COMPONENT.lastIndex = 0;
    let m;
    // eslint-disable-next-line no-cond-assign
    while ((m = RE_DATA_COMPONENT.exec(text))) {
        const attrs = m[1];
        const type = attrs.match(/\bType="([^"]*)"/i)?.[1] ?? '';
        const locale = attrs.match(/\bLocale="([^"]*)"/i)?.[1];
        const entry = { type, path: m[2].trim() };
        if (locale !== undefined) {
            entry.locale = locale;
            if (!seen.has(locale)) {
                seen.add(locale);
                locales.push(locale);
            }
        }
        components.push(entry);
    }
    return { components, locales, isXml };
}
//# sourceMappingURL=component-list.js.map
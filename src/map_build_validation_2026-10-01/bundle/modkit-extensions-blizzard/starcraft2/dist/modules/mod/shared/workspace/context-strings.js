import { parseSc2Strings } from '../../../strings/shared/core/text-file.js';
const STRING_FILES = new Set(['gamestrings.txt', 'gamehotkeys.txt']);
const LOCALIZED_DATA = /^([a-z]{2})([a-z]{2})\.sc2data\/localizeddata\//iu;
const MAXIMUM_DOCUMENT_BYTES = 64 * 1024 * 1024;
export const MAXIMUM_STRING_KEYS = 10_000;
const MAXIMUM_LOCALES = 8;
const LOCALE = /^[a-z]{2}[A-Z]{2}$/u;
const decoder = new TextDecoder();
/** The keys and the locales asked for in a `data.strings` question, or a refusal. */
function stringsRequest(request) {
    const value = request;
    const keys = value?.keys;
    if (!Array.isArray(keys) ||
        keys.length > MAXIMUM_STRING_KEYS ||
        !keys.every(key => typeof key === 'string' && key !== '')) {
        throw new Error(`data.strings needs up to ${MAXIMUM_STRING_KEYS} non-empty keys`);
    }
    const locales = value?.locales;
    if (locales === undefined)
        return { keys };
    if (!Array.isArray(locales) ||
        locales.length === 0 ||
        locales.length > MAXIMUM_LOCALES ||
        !locales.every(locale => typeof locale === 'string' && LOCALE.test(locale))) {
        throw new Error(`data.strings locales are 1 to ${MAXIMUM_LOCALES} names like enUS`);
    }
    return { keys, locales };
}
/** The strings of one resolved chain; every context over it shares them. */
export function contextStrings(options) {
    const byLocale = new Map();
    let carried;
    /** Every locale some layer has localized data for, as `ruRU`. */
    const carriedLocales = () => (carried ??= (async () => {
        const found = new Set();
        for (const layer of options.layers) {
            for (const file of await options.files(layer.id)) {
                const match = LOCALIZED_DATA.exec(file);
                if (match !== null)
                    found.add(`${match[1].toLowerCase()}${match[2].toUpperCase()}`);
            }
        }
        return [...found].sort();
    })());
    const localeStrings = (locale) => {
        let built = byLocale.get(locale);
        if (built === undefined) {
            built = (async () => {
                const folder = `${locale.toLowerCase()}.sc2data/localizeddata/`;
                const strings = new Map();
                let documentIndex = 0;
                for (const layer of options.layers) {
                    for (const file of await options.files(layer.id)) {
                        const lower = file.toLowerCase();
                        if (!lower.startsWith(folder) || !STRING_FILES.has(lower.slice(folder.length)))
                            continue;
                        let bytes;
                        try {
                            bytes = await options.read(layer.id, file, MAXIMUM_DOCUMENT_BYTES);
                        }
                        catch {
                            // A locale the installation did not download: listed, not readable.
                            continue;
                        }
                        const source = { rootId: layer.rootId, path: `${layer.sourcePath}/${file}`, documentIndex };
                        documentIndex += 1;
                        for (const [key, value] of parseSc2Strings(decoder.decode(bytes)))
                            strings.set(key, { value, ...source });
                    }
                }
                return strings;
            })();
            byLocale.set(locale, built);
            built.catch(() => byLocale.delete(locale));
        }
        return built;
    };
    return {
        async answer(request, contextLocales, signal) {
            const asked = stringsRequest(request);
            const chain = [
                ...new Set([...(asked.locales ?? contextLocales), 'enUS', ...(await carriedLocales())]),
            ];
            const requestedLocale = chain[0];
            const missing = new Set(asked.keys);
            const answer = [];
            for (const locale of chain) {
                if (missing.size === 0)
                    break;
                const strings = await localeStrings(locale);
                signal?.throwIfAborted();
                for (const key of missing) {
                    const entry = strings.get(key);
                    if (entry === undefined)
                        continue;
                    missing.delete(key);
                    answer.push(Object.freeze({
                        key,
                        requestedLocale,
                        resolvedLocale: locale,
                        value: entry.value,
                        source: Object.freeze({ rootId: entry.rootId, path: entry.path, documentIndex: entry.documentIndex }),
                        fallback: locale !== requestedLocale,
                    }));
                }
            }
            const order = new Map(asked.keys.map((key, index) => [key, index]));
            return Object.freeze(answer.sort((left, right) => order.get(left.key) - order.get(right.key)));
        },
    };
}
//# sourceMappingURL=context-strings.js.map
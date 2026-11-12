/**
 * Build token map from CConst catalog entries.
 * Each entry's id becomes the token name, data.value becomes the substitution value.
 */
export function buildTokenMap(constEntries) {
    const map = new Map();
    for (const entry of constEntries) {
        const value = entry.data['value'];
        if (typeof value === 'string') {
            map.set(entry.id, value);
        }
    }
    return map;
}
const RE_DOLLAR = /\$([A-Za-z_][A-Za-z0-9_]*)/g;
const RE_HASH = /##([A-Za-z_][A-Za-z0-9_]*)##/g;
/** A constant may name another; SC2 data nests a few levels, a cycle stops here. */
const MAX_CONSTANT_DEPTH = 16;
function substituteString(s, tokens, hashTokens) {
    if (!s.includes('$') && !s.includes('##'))
        return s;
    // `<CConst id="$Portraits17">` keeps its `$`; a `##token##` never has one, so the two stay apart.
    let result = s;
    for (let depth = 0; depth < MAX_CONSTANT_DEPTH; depth += 1) {
        const next = result.replace(RE_DOLLAR, (match, name) => tokens.get(`$${name}`) ?? tokens.get(name) ?? match);
        if (next === result)
            break;
        result = next;
    }
    return hashTokens ? result.replace(RE_HASH, (match, name) => tokens.get(name) ?? match) : result;
}
/**
 * Recursively substitute $Token and ##Token## in all string values.
 * Returns a new object tree; leaves unknown tokens untouched. `constantsOnly` expands `$Name`
 * and leaves every `##token##` placeholder (an abstract template's).
 */
export function substituteTokens(fields, tokens, options = {}) {
    return substituteValue(fields, tokens, options.constantsOnly !== true);
}
function substituteValue(value, tokens, hashTokens) {
    if (typeof value === 'string') {
        return substituteString(value, tokens, hashTokens);
    }
    if (Array.isArray(value)) {
        return value.map((item) => substituteValue(item, tokens, hashTokens));
    }
    // Real catalogs contain sparse arrays and null leaves — pass non-objects through.
    if (value === null || value === undefined || typeof value !== 'object') {
        return value;
    }
    const result = {};
    for (const [k, v] of Object.entries(value)) {
        result[k] = substituteValue(v, tokens, hashTokens);
    }
    return result;
}
//# sourceMappingURL=tokens.js.map
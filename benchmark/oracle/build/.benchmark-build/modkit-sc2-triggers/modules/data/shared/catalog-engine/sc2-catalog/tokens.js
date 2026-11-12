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
function substituteString(s, tokens) {
    let result = s.replace(RE_DOLLAR, (match, name) => tokens.get(name) ?? match);
    result = result.replace(RE_HASH, (match, name) => tokens.get(name) ?? match);
    return result;
}
/**
 * Recursively substitute $Token and ##Token## in all string values.
 * Returns a new object tree; leaves unknown tokens untouched.
 */
export function substituteTokens(fields, tokens) {
    return substituteValue(fields, tokens);
}
function substituteValue(value, tokens) {
    if (typeof value === 'string') {
        return substituteString(value, tokens);
    }
    if (Array.isArray(value)) {
        return value.map((item) => substituteValue(item, tokens));
    }
    // Real catalogs contain sparse arrays and null leaves — pass non-objects through.
    if (value === null || value === undefined || typeof value !== 'object') {
        return value;
    }
    const result = {};
    for (const [k, v] of Object.entries(value)) {
        result[k] = substituteValue(v, tokens);
    }
    return result;
}

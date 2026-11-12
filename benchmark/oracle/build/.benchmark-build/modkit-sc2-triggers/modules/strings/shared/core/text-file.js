/**
 * SC2 localized strings files (`GameStrings.txt` and the other `LocalizedData` tables): a key → value
 * map, and a lossless ordered line model for editing (duplicate keys, BOM and line endings kept).
 */
/**
 * Parse a SC2 locale string file (.SC2Data/LocalizedData/*.txt or GameStrings.txt)
 * Format:  GameUI/ButtonName/Marine=Marine
 */
export function parseSc2Strings(text) {
    const result = new Map();
    for (const rawLine of text.split(/\r?\n/)) {
        // Strip LEADING whitespace and any stray \r only. The value runs to end of line and
        // its trailing whitespace is SIGNIFICANT: Blizzard's own
        // `UI/Unlocks_Colon=Unlocks: ` relies on the trailing space for the gap before the
        // unit list in the tech tree, and trimming it butts the two labels together.
        const line = rawLine.replace(/^\s+/, '').replace(/\r+$/, '');
        if (!line || line.startsWith('//'))
            continue;
        const eq = line.indexOf('=');
        if (eq !== -1) {
            result.set(line.slice(0, eq).trim(), line.slice(eq + 1));
        }
    }
    return result;
}
/** Split text into lines, recording each line's terminator (preserves mixed EOLs). */
function splitKeepEol(text) {
    const out = [];
    let i = 0;
    while (i < text.length) {
        const nl = text.indexOf('\n', i);
        if (nl === -1) {
            out.push({ content: text.slice(i), eol: '' });
            break;
        }
        if (nl > i && text[nl - 1] === '\r') {
            out.push({ content: text.slice(i, nl - 1), eol: '\r\n' });
        }
        else {
            out.push({ content: text.slice(i, nl), eol: '\n' });
        }
        i = nl + 1;
    }
    return out;
}
/** Build the derived key → lines index for a model's line list. */
function buildStringIndex(lines) {
    const index = new Map();
    for (const line of lines) {
        if (!line.isEntry)
            continue;
        let bucket = index.get(line.key);
        if (!bucket) {
            bucket = [];
            index.set(line.key, bucket);
        }
        bucket.push(line);
    }
    return index;
}
/**
 * Parse a locale `.txt` into the lossless ordered model. Accepts a string or raw
 * UTF-8 bytes. Preserves BOM, per-line terminators, blank/comment lines, value
 * whitespace, and duplicate keys. Round-trips byte-exact via {@link serializeStringModel}.
 */
export function parseSc2StringsOrdered(input) {
    let text;
    let bom = false;
    if (typeof input === 'string') {
        if (input.charCodeAt(0) === 0xfeff) {
            bom = true;
            text = input.slice(1);
        }
        else
            text = input;
    }
    else {
        bom = input.length >= 3 && input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf;
        // TextDecoder('utf-8') strips a leading BOM by default, so the decoded text
        // has no BOM char regardless; we tracked it from the raw bytes above.
        text = new TextDecoder('utf-8').decode(input);
        if (text.charCodeAt(0) === 0xfeff)
            text = text.slice(1);
    }
    const lines = splitKeepEol(text).map(({ content, eol }) => {
        const eq = content.indexOf('=');
        // A line whose key portion starts with `//` is a full-line comment (distinct
        // from the `///` trailing-comment convention on a real entry's value), even if
        // the comment text itself happens to contain an `=`.
        const keyPart = eq === -1 ? content : content.slice(0, eq);
        if (eq === -1 || keyPart.trimStart().startsWith('//')) {
            return { key: '', value: '', raw: content, eol, isEntry: false };
        }
        return {
            key: content.slice(0, eq),
            value: content.slice(eq + 1),
            raw: content,
            eol,
            isEntry: true,
        };
    });
    return { bom, lines, index: buildStringIndex(lines) };
}
/** Serialize the ordered model back to text, byte-exact for an unedited model. */
export function serializeStringModel(model) {
    let out = model.bom ? '﻿' : '';
    for (const line of model.lines)
        out += line.raw + line.eol;
    return out;
}
/** Effective value for a key (last occurrence wins, matching the SC2 loader). */
export function effectiveValue(model, key) {
    const bucket = model.index.get(key);
    return bucket && bucket.length ? bucket[bucket.length - 1].value : undefined;
}
/** Rebuild a line's `raw` from its current key/value (after an edit). */
function rebuildRaw(line) {
    line.raw = line.isEntry ? `${line.key}=${line.value}` : line.raw;
}
/**
 * Set the value of `key`, patching only its LAST occurrence. Returns true when a
 * line changed. Does not create the key if absent (use {@link addStringEntry}).
 */
export function setStringValue(model, key, newValue) {
    const bucket = model.index.get(key);
    const line = bucket && bucket.length ? bucket[bucket.length - 1] : undefined;
    if (!line || line.value === newValue)
        return false;
    line.value = newValue;
    rebuildRaw(line);
    return true;
}
/** Rename a key across all its occurrences (values/terminators untouched). Returns count. */
export function renameStringKey(model, oldKey, newKey) {
    const bucket = model.index.get(oldKey);
    if (!bucket || oldKey === newKey)
        return 0;
    for (const line of bucket) {
        line.key = newKey;
        rebuildRaw(line);
    }
    model.index.delete(oldKey);
    const dest = model.index.get(newKey);
    if (dest)
        dest.push(...bucket);
    else
        model.index.set(newKey, bucket);
    return bucket.length;
}
/** Append a new entry (optionally after the last occurrence of `afterKey`). */
export function addStringEntry(model, key, value, afterKey) {
    const line = { key, value, raw: `${key}=${value}`, eol: '\n', isEntry: true };
    // The current last line may lack a terminator; give it one so appends are valid.
    const last = model.lines[model.lines.length - 1];
    if (last && last.eol === '')
        last.eol = '\n';
    let pos = model.lines.length;
    if (afterKey) {
        const bucket = model.index.get(afterKey);
        const anchor = bucket && bucket.length ? bucket[bucket.length - 1] : undefined;
        if (anchor)
            pos = model.lines.indexOf(anchor) + 1;
    }
    model.lines.splice(pos, 0, line);
    const dest = model.index.get(key);
    if (dest)
        dest.push(line);
    else
        model.index.set(key, [line]);
}

/**
 * StarCraft II DocumentHeader binary format — parser and writer.
 *
 * The DocumentHeader file sits at path "DocumentHeader" inside every
 * .SC2Mod, .SC2Campaign, and .SC2Map MPQ archive.
 *
 * Format: little-endian, browser-safe (DataView + TextEncoder/TextDecoder only).
 *
 * Research status (after the R1–R4 verification pass):
 *   - R1 HeaderSize: REFUTED as an offset to entries — it tracks the build
 *     number, and 247/661 files have headerSize > fileSize. Entries are located
 *     by scanning, never by trusting this field.
 *   - R2 Hash: hash1/hash2 (0x1C/0x20) are a content checksum of an
 *     unidentified algorithm (not CRC-32/Adler-32/FNV-1a/MPQ over any contiguous
 *     range). Preserved verbatim on write, never recomputed.
 *   - R3 Flags: bit correlations documented in types.ts KNOWN_FLAGS.
 *   - R4 Edge cases: the 5 files that crashed the old parser ("Invalid array
 *     length" / out-of-range key length) no longer throw — this parser caps the
 *     entry count, validates layout before committing, and degrades to a partial
 *     result instead of crashing.
 * See README.md and docs/SESSION-document-header.md for the format spec + research.
 */
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAGIC = 'H2CS';
const FIXED_HEADER_SIZE = 48;
const DEPENDENCIES_START = 0x30;
const MAX_DEPENDENCY_SCAN = 4096;
const MAX_ENTRY_COUNT = 5000; // raised from the old (wrong) cap of 100
const MAX_KEY_LENGTH = 500;
const MAX_VALUE_LENGTH = 65536;
// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
/**
 * Parse a DocumentHeader binary buffer.
 * Throws if the magic bytes are wrong or the file is too small.
 */
export function parseDocumentHeader(buffer) {
    if (buffer.length < FIXED_HEADER_SIZE) {
        throw new Error(`Invalid DocumentHeader: file too small (${buffer.length} bytes, minimum ${FIXED_HEADER_SIZE})`);
    }
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const magic = readAscii(buffer, 0, 4);
    if (magic !== MAGIC) {
        throw new Error(`Invalid DocumentHeader: bad magic "${magic}" (expected "${MAGIC}")`);
    }
    const unknown1 = view.getUint32(0x04, true);
    const unknown2 = view.getUint32(0x08, true);
    const flags = view.getUint16(0x0C, true);
    const headerSize = view.getUint16(0x0E, true);
    const timestamp1 = view.getUint32(0x10, true);
    const timestamp2 = view.getUint32(0x14, true);
    const unknown3 = view.getUint32(0x18, true);
    const hash1 = view.getUint32(0x1C, true);
    const hash2 = view.getUint32(0x20, true);
    const reserved = buffer.slice(0x24, 0x2C);
    const depCount = view.getUint32(0x2C, true);
    const { dependencies, entriesStart } = parseDependencies(buffer, depCount);
    const entries = parseEntriesSection(buffer, entriesStart);
    return {
        magic, unknown1, unknown2, flags, headerSize,
        timestamp1, timestamp2, unknown3, hash1, hash2,
        reserved,
        dependencies, entries,
    };
}
/**
 * Serialize a DocumentHeader back to binary.
 * The output is byte-for-byte identical to the input when round-tripping
 * a file that was originally produced by the SC2 Editor.
 */
export function writeDocumentHeader(data) {
    const enc = new TextEncoder();
    const magic = data.magic ?? MAGIC;
    const unknown1 = data.unknown1 ?? 8;
    const unknown2 = data.unknown2 ?? 0x5332;
    const unknown3 = data.unknown3 ?? 2;
    // Pre-encode all strings to know sizes
    const depBytes = data.dependencies.map(d => enc.encode(d));
    const entryData = data.entries.map(e => ({
        keyBytes: enc.encode(e.key),
        typeBytes: enc.encode(e.type).slice(0, 4), // always 4 bytes
        valueBytes: enc.encode(e.value),
    }));
    let totalSize = FIXED_HEADER_SIZE;
    for (const db of depBytes)
        totalSize += db.length + 1; // +null
    totalSize += 4; // entry count uint32
    for (const ed of entryData)
        totalSize += 2 + ed.keyBytes.length + 4 + 2 + ed.valueBytes.length;
    const out = new Uint8Array(totalSize);
    const view = new DataView(out.buffer);
    let pos = 0;
    writeAscii(out, pos, magic, 4);
    pos += 4;
    view.setUint32(pos, unknown1, true);
    pos += 4;
    view.setUint32(pos, unknown2, true);
    pos += 4;
    view.setUint16(pos, data.flags, true);
    pos += 2;
    view.setUint16(pos, data.headerSize, true);
    pos += 2;
    view.setUint32(pos, data.timestamp1, true);
    pos += 4;
    view.setUint32(pos, data.timestamp2, true);
    pos += 4;
    view.setUint32(pos, unknown3, true);
    pos += 4;
    view.setUint32(pos, data.hash1, true);
    pos += 4;
    view.setUint32(pos, data.hash2, true);
    pos += 4;
    if (data.reserved)
        out.set(data.reserved.slice(0, 8), pos); // preserve reserved bytes
    pos += 8;
    view.setUint32(pos, data.dependencies.length, true);
    pos += 4;
    for (const db of depBytes) {
        out.set(db, pos);
        pos += db.length;
        out[pos++] = 0; // null terminator
    }
    view.setUint32(pos, data.entries.length, true);
    pos += 4;
    for (const ed of entryData) {
        view.setUint16(pos, ed.keyBytes.length, true);
        pos += 2;
        out.set(ed.keyBytes, pos);
        pos += ed.keyBytes.length;
        // type is always 4 bytes; pad with zeros if shorter
        for (let i = 0; i < 4; i++)
            out[pos + i] = ed.typeBytes[i] ?? 0;
        pos += 4;
        view.setUint16(pos, ed.valueBytes.length, true);
        pos += 2;
        out.set(ed.valueBytes, pos);
        pos += ed.valueBytes.length;
    }
    return out;
}
// ---------------------------------------------------------------------------
// Convenience accessors
// ---------------------------------------------------------------------------
/** Extract all DocInfo/* entries as a flat key→value map. */
export function getDocumentInfo(data) {
    return extractSection(data.entries, 'DocInfo/');
}
/** Extract all MapInfo/* entries as a flat key→value map. */
export function getMapInfo(data) {
    return extractSection(data.entries, 'MapInfo/');
}
/** Extract all LoadingScreen/* entries as a flat key→value map. */
export function getLoadingScreenInfo(data) {
    return extractSection(data.entries, 'LoadingScreen/');
}
/** Filter entries by key prefix or regex. */
export function getEntriesByPattern(data, pattern) {
    const re = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    return data.entries.filter(e => re.test(e.key));
}
// ---------------------------------------------------------------------------
// Private — dependency parsing
// ---------------------------------------------------------------------------
function parseDependencies(buffer, depCount) {
    const dependencies = [];
    let pos = DEPENDENCIES_START;
    const limit = Math.min(buffer.length, DEPENDENCIES_START + MAX_DEPENDENCY_SCAN);
    while (pos < limit) {
        const { str, bytesRead } = readNullTerminated(buffer, pos);
        if (str.length === 0) {
            // Two consecutive nulls = end of dependency section
            if (pos + 1 < buffer.length && buffer[pos + 1] === 0)
                break;
            pos++;
            continue;
        }
        // A valid dependency looks like a path or bnet: URL
        if (str.length > 5 && (str.includes(':') || str.includes('/') || str.includes('\\'))) {
            dependencies.push(str);
            if (depCount > 0 && dependencies.length >= depCount) {
                // Peek: if the next byte is null we've landed past the section
                const nextPos = pos + bytesRead;
                if (nextPos < buffer.length && buffer[nextPos] === 0)
                    break;
            }
        }
        pos += bytesRead;
        if (pos - DEPENDENCIES_START > 2048)
            break;
    }
    return { dependencies, entriesStart: pos };
}
// ---------------------------------------------------------------------------
// Private — entry parsing
// ---------------------------------------------------------------------------
function parseEntriesSection(buffer, afterDeps) {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    // Strategy 1: read entry count uint32 at current position
    if (afterDeps + 4 <= buffer.length) {
        const count = view.getUint32(afterDeps, true);
        if (count > 0 && count <= MAX_ENTRY_COUNT) {
            if (validateEntryLayout(buffer, afterDeps + 4, Math.min(count, 3))) {
                return parseEntries(buffer, afterDeps + 4, count);
            }
        }
    }
    // Strategy 2: scan forward for a valid count + entries
    const scanLimit = Math.min(afterDeps + 256, buffer.length - 10);
    for (let s = afterDeps + 1; s < scanLimit; s++) {
        if (s + 4 > buffer.length)
            break;
        const count = view.getUint32(s, true);
        if (count > 0 && count <= MAX_ENTRY_COUNT) {
            if (validateEntryLayout(buffer, s + 4, Math.min(count, 3))) {
                return parseEntries(buffer, s + 4, count);
            }
        }
    }
    // Strategy 3: search for the first entry directly (count field missing/wrong)
    for (let s = afterDeps; s < scanLimit; s++) {
        if (s + 8 > buffer.length)
            break;
        const view2 = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        const keyLen = view2.getUint16(s, true);
        if (keyLen > 0 && keyLen < MAX_KEY_LENGTH && s + 2 + keyLen + 4 <= buffer.length) {
            const type = readAscii(buffer, s + 2 + keyLen, 4);
            if (isValidType(type)) {
                return parseEntries(buffer, s, MAX_ENTRY_COUNT);
            }
        }
    }
    return [];
}
function validateEntryLayout(buffer, start, sampleCount) {
    if (sampleCount === 0 || start + sampleCount * 10 > buffer.length)
        return false;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let pos = start;
    for (let i = 0; i < sampleCount && pos < buffer.length - 10; i++) {
        const keyLen = view.getUint16(pos, true);
        if (keyLen === 0 || keyLen > MAX_KEY_LENGTH)
            return false;
        pos += 2 + keyLen;
        if (pos + 6 > buffer.length)
            return false;
        const type = readAscii(buffer, pos, 4);
        if (!/^[A-Za-z]{4}$/.test(type))
            return false;
        pos += 4;
        const valLen = view.getUint16(pos, true);
        if (valLen > MAX_VALUE_LENGTH)
            return false;
        pos += 2 + valLen;
    }
    return true;
}
function parseEntries(buffer, start, maxCount) {
    const entries = [];
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let pos = start;
    for (let i = 0; i < maxCount && pos < buffer.length - 6; i++) {
        if (pos + 2 > buffer.length)
            break;
        const keyLen = view.getUint16(pos, true);
        pos += 2;
        if (keyLen === 0 || keyLen > MAX_KEY_LENGTH || pos + keyLen > buffer.length)
            break;
        const key = readAscii(buffer, pos, keyLen);
        pos += keyLen;
        if (pos + 4 > buffer.length)
            break;
        const type = readAscii(buffer, pos, 4);
        pos += 4;
        if (pos + 2 > buffer.length)
            break;
        let valLen = view.getUint16(pos, true);
        pos += 2;
        // Corrupted value length: scan forward for the next valid entry start
        if (valLen > MAX_VALUE_LENGTH || pos + valLen > buffer.length) {
            const recovered = recoverValueLength(buffer, pos);
            if (recovered === null)
                break;
            valLen = recovered;
        }
        const value = readUtf8(buffer, pos, valLen);
        pos += valLen;
        entries.push({ key, type, value });
    }
    return entries;
}
/**
 * When the stored value length is clearly wrong, scan forward for the next
 * entry-like pattern and infer the value length from the gap.
 */
function recoverValueLength(buffer, pos) {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const limit = Math.min(pos + 10000, buffer.length - 10);
    for (let s = pos; s < limit; s++) {
        const keyLen = view.getUint16(s, true);
        if (keyLen > 0 && keyLen < MAX_KEY_LENGTH && s + 2 + keyLen + 4 <= buffer.length) {
            const type = readAscii(buffer, s + 2 + keyLen, 4);
            if (isValidType(type))
                return s - pos;
        }
    }
    return null;
}
// ---------------------------------------------------------------------------
// Private — helpers
// ---------------------------------------------------------------------------
function extractSection(entries, prefix) {
    const out = {};
    for (const e of entries) {
        if (e.key.startsWith(prefix))
            out[e.key.slice(prefix.length)] = e.value;
    }
    return out;
}
function isValidType(type) {
    return /^[A-Za-z]{4}$/.test(type);
}
function readAscii(buffer, offset, length) {
    let s = '';
    for (let i = 0; i < length; i++)
        s += String.fromCharCode(buffer[offset + i]);
    return s;
}
function writeAscii(buffer, offset, str, length) {
    for (let i = 0; i < length; i++)
        buffer[offset + i] = i < str.length ? str.charCodeAt(i) : 0;
}
function readUtf8(buffer, offset, length) {
    return new TextDecoder('utf-8').decode(buffer.slice(offset, offset + length));
}
function readNullTerminated(buffer, offset) {
    let end = offset;
    while (end < buffer.length && buffer[end] !== 0)
        end++;
    return { str: readUtf8(buffer, offset, end - offset), bytesRead: end - offset + 1 };
}

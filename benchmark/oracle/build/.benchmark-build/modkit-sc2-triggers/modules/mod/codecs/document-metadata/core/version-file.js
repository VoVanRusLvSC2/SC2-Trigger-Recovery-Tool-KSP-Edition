/**
 * StarCraft II `.version` file format parser and writer.
 *
 * A `.version` file is a fixed-size little-endian record stored next to a
 * component file inside `.SC2Mod`, `.SC2Campaign`, and `.SC2Map` archives. The
 * on-disk layout is the editor serializer order:
 *
 *   magic + type tag + version tuple + entry count/timestamp/terminal
 *
 * Supported sizes:
 *   - v0: 36 bytes
 *   - v1: 40 bytes
 *   - v2: 44 bytes
 *
 * The raw tag bytes are the little-endian form of the ComponentList FourCC.
 * For example, the `trig` component is stored as bytes/string `girt`.
 *
 * Known observed tags:
 *
 * | Raw tag | Component FourCC | File type |
 * | --- | --- | --- |
 * | `ofni` | `info` | DocumentInfo |
 * | `txet` | `text` | GameText |
 * | `adag` | `gada` | GameData |
 * | `rtta` | `attr` | Attributes |
 * | `iuiu` | `uiui` | DescIndex |
 * | `stuc` | `cuts` | Index |
 * | `tnof` | `font` | FontStyles |
 * | `ipam` | `mapi` | MapInfo |
 * | `rret` | `terr` | t3Terrain |
 * | `bolp` | `plob` | Objects |
 * | `iger` | `regi` | Regions |
 * | `girt` | `trig` | Triggers |
 * | `iaia` | `aiai` | CustomAI |
 */
const PREFIX = 'cdes';
const V0_SIZE = 36;
const V1_SIZE = 40;
const V2_SIZE = 44;
const TERMINAL_MIN = 0;
const TERMINAL_MAX = 1_000_000;
const FORMAT_SIZE = {
    0: V0_SIZE,
    1: V1_SIZE,
    2: V2_SIZE,
};
/**
 * Parse a `.version` sidecar file.
 *
 * Throws if the magic prefix is wrong, the file size is not 36/40/44 bytes, or
 * the embedded format version does not agree with the fixed-size layout.
 *
 * Zero-length files are valid (empty FontStyles sidecars) and return `null`.
 */
export function parseVersionFile(buffer) {
    if (buffer.length === 0)
        return null;
    if (buffer.length !== V0_SIZE && buffer.length !== V1_SIZE && buffer.length !== V2_SIZE) {
        throw new Error(`Invalid .version file: unexpected size ${buffer.length} bytes (expected 36, 40, or 44)`);
    }
    const prefix = readAscii(buffer, 0, 4);
    if (prefix !== PREFIX) {
        throw new Error(`Invalid .version file: bad prefix "${prefix}" (expected "cdes")`);
    }
    const typeTag = readAscii(buffer, 4, 4);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const formatVersion = view.getUint32(0x08, true);
    if (!isVersionFormat(formatVersion)) {
        throw new Error(`Invalid .version file: unrecognised format version ${formatVersion}`);
    }
    const expectedSize = FORMAT_SIZE[formatVersion];
    if (buffer.length !== expectedSize) {
        throw new Error(`Invalid .version file: format version ${formatVersion} requires ${expectedSize} bytes, got ${buffer.length}`);
    }
    const buildNumber = view.getUint32(0x0C, true);
    const majorVersion = view.getUint32(0x10, true);
    const minorVersion = view.getUint32(0x14, true);
    if (formatVersion === 0) {
        return versionFileData({
            typeTag,
            formatVersion,
            buildNumber,
            majorVersion,
            minorVersion,
            patchVersion: 0,
            buildNumber2: 0,
            entryCount: 0,
            timestamp: view.getUint32(0x18, true),
            terminal: view.getUint32(0x1C, true),
            bytesConsumed: buffer.length,
        });
    }
    if (formatVersion === 1) {
        return versionFileData({
            typeTag,
            formatVersion,
            buildNumber,
            majorVersion,
            minorVersion,
            patchVersion: view.getUint32(0x18, true),
            buildNumber2: 0,
            entryCount: view.getUint32(0x1C, true),
            timestamp: view.getUint32(0x20, true),
            terminal: view.getUint32(0x24, true),
            bytesConsumed: buffer.length,
        });
    }
    return versionFileData({
        typeTag,
        formatVersion,
        buildNumber,
        majorVersion,
        minorVersion,
        patchVersion: view.getUint32(0x18, true),
        buildNumber2: view.getUint32(0x1C, true),
        entryCount: view.getUint32(0x20, true),
        timestamp: view.getUint32(0x24, true),
        terminal: view.getUint32(0x28, true),
        bytesConsumed: buffer.length,
    });
}
/**
 * Serialize a `.version` file back to binary.
 *
 * Produces a 44-byte v2 file by default. Use `formatVersion: 0` or
 * `formatVersion: 1` to emit the older fixed-size layouts.
 */
export function writeVersionFile(data) {
    const formatVersion = data.formatVersion ?? 2;
    if (!isVersionFormat(formatVersion)) {
        throw new Error(`Invalid .version write: unsupported format version ${String(formatVersion)}`);
    }
    const out = new Uint8Array(FORMAT_SIZE[formatVersion]);
    const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
    writeAscii(out, 0, PREFIX, 4);
    writeAscii(out, 4, resolveWriteTypeTag(data), 4);
    view.setUint32(0x08, formatVersion, true);
    const buildNumber = requiredU32(data.buildNumber ?? data.buildCreated, 'buildNumber');
    const majorVersion = optionalU32(data.majorVersion ?? data.unknown1, 'majorVersion', 5);
    const minorVersion = optionalU32(data.minorVersion ?? data.unknown2, 'minorVersion', 0);
    const patchVersion = optionalU32(data.patchVersion ?? data.schemaVersion, 'patchVersion', 0);
    const buildNumber2 = optionalU32(data.buildNumber2 ?? data.buildLastSaved, 'buildNumber2', buildNumber);
    const entryCount = optionalU32(data.entryCount ?? data.changeCount, 'entryCount', 0);
    const timestamp = optionalU32(data.timestamp ?? data.contentHash, 'timestamp', 0);
    const terminal = checkedRange(optionalU32(data.terminal, 'terminal', formatVersion === 0 ? 0 : 1), 'terminal', TERMINAL_MIN, TERMINAL_MAX);
    view.setUint32(0x0C, buildNumber, true);
    view.setUint32(0x10, majorVersion, true);
    view.setUint32(0x14, minorVersion, true);
    if (formatVersion === 0) {
        view.setUint32(0x18, timestamp, true);
        view.setUint32(0x1C, terminal, true);
        return out;
    }
    view.setUint32(0x18, patchVersion, true);
    if (formatVersion === 1) {
        view.setUint32(0x1C, entryCount, true);
        view.setUint32(0x20, timestamp, true);
        view.setUint32(0x24, terminal, true);
        return out;
    }
    view.setUint32(0x1C, buildNumber2, true);
    view.setUint32(0x20, entryCount, true);
    view.setUint32(0x24, timestamp, true);
    view.setUint32(0x28, terminal, true);
    return out;
}
/**
 * Resolve the human-readable file type from a raw type tag.
 * Returns `undefined` if the tag is not in the known table.
 *
 * @example
 * resolveTypeTag('ofni') // 'DocumentInfo'
 */
export function resolveTypeTag(tag) {
    return TYPE_TAG_MAP[tag];
}
/**
 * Get the raw 4-byte type tag for a known file type name.
 * Returns `undefined` if the name is not in the known table.
 *
 * @example
 * typeTagFor('Triggers') // 'girt'
 */
export function typeTagFor(name) {
    const normalized = normalizeTypeName(name);
    const byName = Object.entries(TYPE_TAG_MAP).find(([, v]) => normalizeTypeName(v) === normalized)?.[0];
    if (byName)
        return byName;
    if (normalized.length === 4) {
        const rawTag = reverseFourCc(normalized);
        if (TYPE_TAG_MAP[rawTag])
            return rawTag;
    }
    return undefined;
}
/**
 * Get the raw 4-byte type tag for a `.version` path or component filename.
 *
 * @example
 * typeTagForVersionPath('Base.SC2Data/UI/Layout/DescIndex.version') // 'iuiu'
 */
export function typeTagForVersionPath(path) {
    let base = path.replace(/\\/g, '/');
    const slash = base.lastIndexOf('/');
    if (slash !== -1)
        base = base.slice(slash + 1);
    if (base.toLowerCase().endsWith('.version'))
        base = base.slice(0, -'.version'.length);
    return typeTagFor(base);
}
/** Maps raw 4-byte type tags to human-readable file type names. */
export const TYPE_TAG_MAP = {
    ofni: 'DocumentInfo',
    txet: 'GameText',
    adag: 'GameData',
    rtta: 'Attributes',
    iuiu: 'DescIndex',
    stuc: 'Index',
    tnof: 'FontStyles',
    ipam: 'MapInfo',
    rret: 't3Terrain',
    bolp: 'Objects',
    iger: 'Regions',
    girt: 'Triggers',
    iaia: 'CustomAI',
};
const TYPE_NAME_ALIASES = {
    cutscenes: 'index',
    cutsceneindex: 'index',
    indexcutscenes: 'index',
};
function versionFileData(fields) {
    return {
        ...fields,
        buildCreated: fields.buildNumber,
        unknown1: fields.majorVersion,
        unknown2: fields.minorVersion,
        schemaVersion: fields.patchVersion,
        buildLastSaved: fields.formatVersion === 2 ? fields.buildNumber2 : fields.buildNumber,
        changeCount: fields.entryCount,
        contentHash: fields.timestamp,
    };
}
function isVersionFormat(value) {
    return value === 0 || value === 1 || value === 2;
}
function requiredU32(value, field) {
    if (value === undefined) {
        throw new Error(`Invalid .version write: missing required ${field}`);
    }
    return checkedU32(value, field);
}
function optionalU32(value, field, fallback) {
    return checkedU32(value ?? fallback, field);
}
function checkedU32(value, field) {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
        throw new Error(`Invalid .version write: ${field} must be a uint32`);
    }
    return value;
}
function checkedRange(value, field, min, max) {
    if (value < min || value > max) {
        throw new Error(`Invalid .version write: ${field} must be between ${min} and ${max}`);
    }
    return value;
}
function resolveWriteTypeTag(data) {
    const tag = data.typeTag ??
        (data.fileType ? typeTagFor(data.fileType) : undefined) ??
        (data.versionPath ? typeTagForVersionPath(data.versionPath) : undefined);
    if (!tag) {
        throw new Error(`Invalid .version write: provide typeTag, fileType, or versionPath with a known component type`);
    }
    return checkedTypeTag(tag);
}
function normalizeTypeName(name) {
    let value = name.trim();
    value = value.replace(/\\/g, '/');
    const slash = value.lastIndexOf('/');
    if (slash !== -1)
        value = value.slice(slash + 1);
    if (value.toLowerCase().endsWith('.version'))
        value = value.slice(0, -'.version'.length);
    value = value.replace(/\s*\([^)]*\)\s*/g, '');
    const key = value.toLowerCase().replace(/[^a-z0-9]/g, '');
    return TYPE_NAME_ALIASES[key] ?? key;
}
function reverseFourCc(value) {
    let out = '';
    for (let i = value.length - 1; i >= 0; i--)
        out += value[i];
    return out;
}
function checkedTypeTag(tag) {
    if (tag.length !== 4) {
        throw new Error(`Invalid .version write: typeTag must be exactly 4 ASCII characters`);
    }
    for (let i = 0; i < tag.length; i++) {
        const code = tag.charCodeAt(i);
        if (code < 0x20 || code > 0x7e) {
            throw new Error(`Invalid .version write: typeTag must be exactly 4 ASCII characters`);
        }
    }
    return tag;
}
function readAscii(buffer, offset, length) {
    let s = '';
    for (let i = 0; i < length; i++)
        s += String.fromCharCode(buffer[offset + i] ?? 0);
    return s;
}
function writeAscii(buffer, offset, str, length) {
    for (let i = 0; i < length; i++)
        buffer[offset + i] = i < str.length ? str.charCodeAt(i) : 0;
}

import { decodeBlizzardCacheHandle } from '@modkit/blizzard-common-formats/content-address/cache-handle';
export function decodeCacheHeader(bytes) {
    if (bytes.length > 8 * 1024 * 1024)
        throw new Error('Cache metadata exceeds 8 MiB');
    let offset = 0, nodes = 0;
    const take = (length) => {
        if (!Number.isSafeInteger(length) || length < 0 || offset + length > bytes.length)
            throw new Error('Truncated cache metadata');
        const value = bytes.subarray(offset, offset + length);
        offset += length;
        return value;
    };
    const integer = () => {
        let byte = take(1)[0], shift = 6n, result = BigInt((byte & 127) >>> 1);
        const negative = byte & 1;
        while (byte & 128) {
            if (shift >= 64n)
                throw new Error('Cache integer overflow');
            byte = take(1)[0];
            result |= BigInt(byte & 127) << shift;
            shift += 7n;
        }
        if (result >= 1n << 64n)
            throw new Error('Cache integer overflow');
        return negative ? -result : result;
    };
    const count = () => {
        const value = integer();
        if (value < 0n || value > 100000n)
            throw new Error('Cache collection exceeds limit');
        return Number(value);
    };
    const node = (depth) => {
        if (++nodes > 100000 || depth > 64)
            throw new Error('Cache metadata nesting exceeds limit');
        const kind = take(1)[0];
        let value;
        switch (kind) {
            case 0:
                value = Array.from({ length: count() }, () => node(depth + 1));
                break;
            case 1: {
                const bits = count();
                value = take(Math.ceil(bits / 8));
                return { kind, value, bits };
            }
            case 2:
                value = take(count());
                break;
            case 3: {
                const index = integer();
                return { kind, index, value: node(depth + 1) };
            }
            case 4: {
                const present = take(1)[0];
                if (present > 1)
                    throw new Error('Invalid optional cache field');
                value = present ? node(depth + 1) : undefined;
                break;
            }
            case 5: {
                const fields = new Map(), length = count();
                for (let i = 0; i < length; i++) {
                    const tag = integer();
                    if (fields.has(tag))
                        throw new Error('Duplicate cache field');
                    fields.set(tag, node(depth + 1));
                }
                value = fields;
                break;
            }
            case 6:
            case 7:
            case 8:
                value = take({ 6: 1, 7: 4, 8: 8 }[kind]);
                break;
            case 9:
                value = integer();
                break;
            default: throw new Error('Unsupported cache metadata tag');
        }
        return { kind, value };
    };
    const result = node(0);
    if (offset !== bytes.length)
        throw new Error('Trailing cache metadata');
    return result;
}
/**
 * Write a node back in the same tagged format, so a header read from the game's cache can be
 * amended (identity, namespace) and republished. Decoding then encoding returns the same bytes.
 */
export function encodeCacheHeader(node) {
    const parts = [];
    const byte = (value) => parts.push(Uint8Array.of(value));
    const integer = (value) => {
        const negative = value < 0n;
        let rest = negative ? -value : value;
        if (rest >= 1n << 64n)
            throw new Error('Cache integer overflow');
        // The first byte carries the sign in bit 0 and six value bits; each further byte carries seven.
        let first = Number((rest & 63n) << 1n) | (negative ? 1 : 0);
        rest >>= 6n;
        if (rest)
            first |= 128;
        byte(first);
        while (rest) {
            let next = Number(rest & 127n);
            rest >>= 7n;
            if (rest)
                next |= 128;
            byte(next);
        }
    };
    const count = (value) => {
        if (!Number.isSafeInteger(value) || value < 0 || value > 100000)
            throw new Error('Cache collection exceeds limit');
        integer(BigInt(value));
    };
    const bytesOf = (node) => {
        if (!(node.value instanceof Uint8Array))
            throw new Error('Invalid cache byte field');
        return node.value;
    };
    const write = (node, depth) => {
        if (depth > 64)
            throw new Error('Cache metadata nesting exceeds limit');
        byte(node.kind);
        switch (node.kind) {
            case 0: {
                const items = array(node);
                count(items.length);
                for (const item of items)
                    write(item, depth + 1);
                break;
            }
            case 1: {
                const raw = bytesOf(node);
                const bits = node.bits ?? raw.length * 8;
                if (Math.ceil(bits / 8) !== raw.length)
                    throw new Error('Cache bit field length mismatch');
                count(bits);
                parts.push(raw);
                break;
            }
            case 2: {
                const raw = bytesOf(node);
                count(raw.length);
                parts.push(raw);
                break;
            }
            case 3: {
                if (node.index === undefined)
                    throw new Error('Cache tagged field has no index');
                integer(node.index);
                write(node.value, depth + 1);
                break;
            }
            case 4: {
                const present = node.value !== undefined;
                byte(present ? 1 : 0);
                if (present)
                    write(node.value, depth + 1);
                break;
            }
            case 5: {
                const fields = node.value;
                if (!(fields instanceof Map))
                    throw new Error('Invalid cache struct');
                count(fields.size);
                for (const [tag, child] of fields) {
                    integer(tag);
                    write(child, depth + 1);
                }
                break;
            }
            case 6:
            case 7:
            case 8: {
                const raw = bytesOf(node);
                if (raw.length !== { 6: 1, 7: 4, 8: 8 }[node.kind])
                    throw new Error('Cache fixed field length mismatch');
                parts.push(raw);
                break;
            }
            case 9: {
                if (typeof node.value !== 'bigint')
                    throw new Error('Invalid cache number');
                integer(node.value);
                break;
            }
            default:
                throw new Error('Unsupported cache metadata tag');
        }
    };
    write(node, 0);
    const size = parts.reduce((total, part) => total + part.length, 0);
    const output = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
        output.set(part, offset);
        offset += part.length;
    }
    return output;
}
export function field(node, tag) {
    const value = node.kind === 5 ? node.value.get(BigInt(tag)) : undefined;
    if (!value)
        throw new Error('Missing cache metadata field');
    return value;
}
/** An optional field's value, or undefined when the field or its value is absent. */
export function optionalField(node, tag) {
    const value = node.kind === 5 ? node.value.get(BigInt(tag)) : undefined;
    return value?.kind === 4 ? value.value : value;
}
export function number(node) {
    if (typeof node.value !== 'bigint' || node.value < 0n || node.value > BigInt(Number.MAX_SAFE_INTEGER))
        throw new Error('Invalid cache number');
    return Number(node.value);
}
export function blob(node) {
    if (!(node.value instanceof Uint8Array))
        throw new Error('Invalid cache byte field');
    return node.value;
}
export function array(node) {
    if (node.kind !== 0)
        throw new Error('Invalid cache array');
    return node.value;
}
export function reference(bytes) {
    return decodeBlizzardCacheHandle(bytes);
}
export function references(node) {
    const output = new Map();
    const visit = (node) => {
        if (node.value instanceof Uint8Array) {
            const ref = reference(node.value);
            if (ref)
                output.set(ref.file, ref);
        }
        else if (node.kind === 5)
            for (const child of node.value.values())
                visit(child);
        else if (node.kind === 0)
            for (const child of array(node))
                visit(child);
        else if (node.kind === 3 || (node.kind === 4 && node.value))
            visit(node.value);
    };
    visit(node);
    return [...output.values()];
}
//# sourceMappingURL=cache-header.js.map
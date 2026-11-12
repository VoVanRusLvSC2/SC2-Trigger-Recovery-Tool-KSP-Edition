/**
 * The loader's file system: package readers registered by protocol (`file:`, `content-source0:`,
 * `loose0:`, …) and routed by `protocol:path`. The surface is exactly what `ModContextManager`
 * uses — list, read, text, existence and closing.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
const PROTOCOL = /^([A-Za-z][A-Za-z0-9+.-]*:)(?:\/\/)?/u;
const decoder = new TextDecoder();
/** A path with `.`/empty segments dropped and `..` applied; one that climbs out is refused. */
function normalize(inner, uri) {
    const forward = inner.replace(/\\/gu, '/');
    const parts = [];
    for (const part of forward.split('/')) {
        if (part === '' || part === '.')
            continue;
        if (part !== '..')
            parts.push(part);
        else if (parts.pop() === undefined)
            throw new Error(`Path escapes its VFS root: ${uri}`);
    }
    return `${forward.startsWith('/') ? '/' : ''}${parts.join('/')}`;
}
/** Routes `protocol:path` to the reader registered for that protocol. */
export class VirtualFileSystem {
    readers = new Map();
    register(protocol, reader) {
        this.readers.set(protocol.toLowerCase(), reader);
        return this;
    }
    route(uri) {
        const match = PROTOCOL.exec(uri);
        const reader = match === null ? undefined : this.readers.get(match[1].toLowerCase());
        if (match === null || reader === undefined)
            throw new Error(`No reader registered for ${uri}`);
        return [reader, normalize(uri.slice(match[0].length), uri)];
    }
    list(uri) {
        const [reader, inner] = this.route(uri);
        return reader.list(inner);
    }
    get(uri) {
        const [reader, inner] = this.route(uri);
        return reader.get(inner);
    }
    getText(uri) {
        const [reader, inner] = this.route(uri);
        return reader.getText(inner);
    }
    exists(uri) {
        const [reader, inner] = this.route(uri);
        return reader.exists(inner);
    }
    /** Close every reader; all are attempted, and the first failure is rethrown. */
    async close() {
        const readers = [...this.readers.values()];
        this.readers.clear();
        const results = await Promise.allSettled(readers.map(async (reader) => reader.close?.()));
        const failed = results.find(result => result.status === 'rejected');
        if (failed !== undefined)
            throw failed.reason;
    }
}
/** The host disk: paths are absolute (or relative to the working directory). */
export class FsReader {
    async list(folder) {
        const root = path.resolve(folder);
        const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
        return entries
            .filter(entry => entry.isFile())
            .map(entry => path.relative(root, path.join(entry.parentPath, entry.name)).replace(/\\/gu, '/'))
            .sort((left, right) => left.localeCompare(right));
    }
    async get(file) {
        const bytes = await fs.readFile(path.resolve(file));
        return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
    async getText(file) {
        return decoder.decode(await this.get(file));
    }
    async exists(file) {
        return fs.stat(path.resolve(file)).then(() => true, () => false);
    }
}
//# sourceMappingURL=vfs.js.map
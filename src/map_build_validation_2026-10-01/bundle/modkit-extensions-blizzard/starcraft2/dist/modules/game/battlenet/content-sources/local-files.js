import { createHash } from 'node:crypto';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { openMpqReader } from '@modkit/blizzard-mpq/reader';
import { windowsHiddenPaths } from '@modkit/vfs/content-sources/node';
export const MAX_FILE = 64 * 1024 * 1024;
const MAX_ARCHIVE = 256 * 1024 * 1024;
export function parts(path) {
    if (path === '')
        return [];
    const result = path.split('/');
    if (path.length > 4096 || result.some(p => !p || p === '.' || p === '..' || /[\\:\u0000-\u001f]/u.test(p)))
        throw new Error('Invalid local source path');
    return result;
}
export const entry = (path, directory, size) => ({
    path, name: path.split('/').at(-1), directory, ...(size === undefined ? {} : { size }),
});
export const sorted = (items) => items.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name));
export async function confined(root, path) {
    if (!isAbsolute(root))
        throw new Error('Local source root must be absolute');
    const base = await realpath(root);
    let target = base;
    for (const part of parts(path)) {
        target = join(target, part);
        if ((await lstat(target)).isSymbolicLink())
            throw new Error('Filesystem links are not followed by this source');
    }
    const resolved = await realpath(target), tail = relative(base, resolved);
    if (isAbsolute(tail) || tail === '..' || tail.startsWith(`..${sep}`))
        throw new Error('Path leaves its local source');
    return resolved;
}
export async function readBounded(root, path, maximum, hash) {
    if (!Number.isSafeInteger(maximum) || maximum < 0 || maximum > MAX_ARCHIVE)
        throw new Error('Invalid read limit');
    const file = await open(await confined(root, path), 'r');
    try {
        const before = await file.stat();
        if (!before.isFile() || before.size > maximum)
            throw new Error('Local file exceeds the read limit');
        const bytes = new Uint8Array(before.size);
        let offset = 0;
        while (offset < bytes.length) {
            const result = await file.read(bytes, offset, bytes.length - offset, offset);
            if (!result.bytesRead)
                throw new Error('Local file changed during reading');
            offset += result.bytesRead;
        }
        const after = await file.stat();
        if (before.size !== after.size || before.mtimeMs !== after.mtimeMs)
            throw new Error('Local file changed during reading');
        if (hash && createHash('sha256').update(bytes).digest('hex') !== hash)
            throw new Error('Local cache SHA-256 mismatch');
        return bytes;
    }
    finally {
        await file.close();
    }
}
/** One retained MPQ per provider; operations/eviction are serialized so active reads cannot be disposed. */
export class LocalArchives {
    current;
    queue = Promise.resolve();
    closed = false;
    use(root, path, hash, action) {
        const task = this.queue.then(async () => {
            if (this.closed)
                throw new Error('Local source is closed');
            const location = await confined(root, path), info = await lstat(location);
            const key = `${location}:${info.size}:${info.mtimeMs}:${hash ?? ''}`;
            if (this.current?.key !== key) {
                this.current?.reader.dispose();
                this.current = undefined;
                const bytes = await readBounded(root, path, MAX_ARCHIVE, hash);
                const reader = await openMpqReader(bytes, { maxArchiveBytes: MAX_ARCHIVE, maxEntries: 100000, maxEntryBytes: MAX_FILE });
                this.current = { key, reader };
            }
            try {
                return await action(this.current.reader);
            }
            finally {
                if (this.current.reader.retainedBytes > MAX_ARCHIVE) {
                    this.current.reader.dispose();
                    this.current = undefined;
                }
            }
        });
        this.queue = task.catch(() => undefined);
        return task;
    }
    async refresh() { await this.queue; this.current?.reader.dispose(); this.current = undefined; }
    async dispose() { this.closed = true; await this.refresh(); }
}
export function archiveList(reader, base, inner) {
    const prefix = inner ? `${inner}/` : '', foldedPrefix = prefix.toLowerCase();
    const found = new Map();
    for (const file of reader.entries) {
        const path = file.path.replace(/\\/g, '/');
        parts(path);
        if (!path.toLowerCase().startsWith(foldedPrefix))
            continue;
        const tail = path.slice(prefix.length), name = tail.split('/')[0];
        if (!name)
            continue;
        const directory = tail.includes('/'), target = [base, inner, name].filter(Boolean).join('/');
        const old = found.get(name);
        if (old && old.directory !== directory)
            throw new Error('Conflicting MPQ file and directory names');
        const item = entry(target, directory, directory ? undefined : file.size);
        // The reader marks the archive's own bookkeeping, which sits at its root.
        found.set(name, !directory && file.hidden === true ? { ...item, hidden: true } : item);
    }
    if (inner && !found.size)
        throw new Error('Archive directory was not found');
    return sorted([...found.values()]);
}
export async function archiveRead(reader, inner, maximum) {
    parts(inner);
    const folded = inner.toLowerCase();
    const file = reader.entries.find(item => item.path.replace(/\\/g, '/').toLowerCase() === folded);
    if (!file)
        throw new Error('Archive file was not found');
    if (file.size > maximum)
        throw new Error('Archive file exceeds the preview limit');
    const bytes = await reader.read(file.id);
    if (bytes.length > maximum)
        throw new Error('Archive file exceeds the preview limit');
    return bytes;
}
/** Read-only folder source; packed maps/mods and loose package directories share one tree. */
export class Sc2FolderSource {
    directory;
    children;
    root;
    archives = new LocalArchives();
    closed = false;
    /** What Windows marks hidden under the root, read once per refresh; a name with a dot is not hidden. */
    hidden;
    constructor(directory, id, label, children) {
        this.directory = directory;
        this.children = children;
        if (!isAbsolute(directory))
            throw new Error('Local source root must be absolute');
        this.root = { id, label, kind: 'local', region: 'local' };
    }
    async locate(path) {
        if (this.closed)
            throw new Error('Local source is closed');
        const names = parts(path);
        if (this.children && names.length && !this.children.includes(names[0]))
            throw new Error('Select Maps or Mods');
        for (let count = 1; count <= names.length; count++) {
            const outer = names.slice(0, count).join('/'), absolute = await confined(this.directory, outer);
            const stat = await lstat(absolute);
            if (stat.isFile() && /\.SC2(?:Map|Mod|Campaign)$/iu.test(outer)) {
                return { outer, inner: names.slice(count).join('/'), archive: true, absolute };
            }
        }
        return { outer: path, inner: '', archive: false, absolute: await confined(this.directory, path) };
    }
    async list(path) {
        const location = await this.locate(path);
        if (location.archive)
            return this.archives.use(this.directory, location.outer, undefined, reader => archiveList(reader, location.outer, location.inner));
        const entries = await readdir(location.absolute, { withFileTypes: true }), output = [];
        const hidden = await (this.hidden ??= windowsHiddenPaths(this.directory));
        // Under a hidden folder everything is hidden, as the host's folder layers read it.
        const isHidden = (relativePath) => hidden.size > 0 &&
            relativePath.split('/').some((_, index, names) => hidden.has(names.slice(0, index + 1).join('/')));
        for (const item of entries) {
            if (item.isSymbolicLink() || (!path && this.children && !this.children.includes(item.name)))
                continue;
            if (!item.isFile() && !item.isDirectory())
                continue;
            const relativePath = [path, item.name].filter(Boolean).join('/');
            parts(relativePath);
            const directory = item.isDirectory() || /\.SC2(?:Map|Mod|Campaign)$/iu.test(item.name);
            const listed = entry(relativePath, directory, directory ? undefined : (await lstat(join(location.absolute, item.name))).size);
            output.push(isHidden(relativePath) ? { ...listed, hidden: true } : listed);
        }
        return sorted(output);
    }
    async read(path, maximum) {
        if (!Number.isSafeInteger(maximum) || maximum < 0 || maximum > MAX_FILE)
            throw new Error('Invalid preview limit');
        const location = await this.locate(path);
        return location.archive && location.inner
            ? this.archives.use(this.directory, location.outer, undefined, reader => archiveRead(reader, location.inner, maximum))
            : readBounded(this.directory, path, maximum);
    }
    async resolveLocalPath(path) {
        const location = await this.locate(path);
        // Entries below a packed package are virtual. Reveal the package which owns them.
        if (location.archive)
            return { path: location.absolute, kind: 'file' };
        const stat = await lstat(location.absolute);
        if (!stat.isFile() && !stat.isDirectory())
            throw new Error('Local source target is not revealable');
        return { path: location.absolute, kind: stat.isDirectory() ? 'directory' : 'file' };
    }
    refresh() { this.hidden = undefined; return this.archives.refresh(); }
    async dispose() { this.closed = true; await this.archives.dispose(); }
}
/**
 * The SC2 map-data cache stores logical packages in hash-named `.s2ma` directories. This adapter
 * keeps those physical names private and projects stable `.SC2Map` / `.SC2Mod` names while every
 * operation still runs through the confined folder source.
 */
export class Sc2MapsCacheSource {
    directory;
    labels;
    root = {
        id: 'local:sc2-maps-cache',
        label: 'StarCraft II — кеш данных карт',
        kind: 'local',
        region: 'local',
    };
    folder;
    mapping;
    constructor(directory, labels) {
        this.directory = directory;
        this.labels = labels;
        this.folder = new Sc2FolderSource(directory, this.root.id, this.root.label);
    }
    names() {
        this.mapping ??= this.buildNames();
        return this.mapping;
    }
    async buildNames() {
        const known = await this.labels().catch(() => new Map());
        const result = new Map(), used = new Set();
        for (const item of await this.folder.list('')) {
            const match = /^([a-f0-9]{64})\.s2ma$/iu.exec(item.name);
            let virtual = match === null
                ? item.name
                : known.get(item.name.toLowerCase()) ?? `Кеш карты [${match[1].slice(0, 16)}].SC2Map`;
            if (used.has(virtual.toLowerCase())) {
                const extension = /\.SC2(?:Map|Mod|Campaign)$/iu.exec(virtual)?.[0] ?? '.SC2Map';
                virtual = `${virtual.slice(0, -extension.length)} [${match?.[1]?.slice(0, 12) ?? item.name}]${extension}`;
            }
            used.add(virtual.toLowerCase());
            result.set(virtual, item.name);
        }
        return result;
    }
    async translate(path) {
        const names = parts(path);
        if (!names.length)
            return { virtual: '', physical: '' };
        const physical = (await this.names()).get(names[0]);
        if (!physical)
            throw new Error('Cached map was not found');
        return { virtual: names[0], physical: [physical, ...names.slice(1)].join('/') };
    }
    rewrite(item, virtual, physical) {
        const path = item.path === physical
            ? virtual
            : `${virtual}${item.path.slice(physical.length)}`;
        return { ...item, path, name: path.split('/').at(-1) };
    }
    async list(path) {
        if (path === '') {
            const mapping = await this.names(), rows = await this.folder.list('');
            const reverse = new Map([...mapping].map(([virtual, physical]) => [physical, virtual]));
            return sorted(rows.map(item => this.rewrite(item, reverse.get(item.name) ?? item.name, item.name)));
        }
        const translated = await this.translate(path);
        return (await this.folder.list(translated.physical)).map(item => this.rewrite(item, translated.virtual, translated.physical.split('/')[0]));
    }
    async read(path, maximum) {
        return this.folder.read((await this.translate(path)).physical, maximum);
    }
    async resolveLocalPath(path) {
        return this.folder.resolveLocalPath((await this.translate(path)).physical);
    }
    async refresh() { this.mapping = undefined; await this.folder.refresh(); }
    dispose() { return this.folder.dispose(); }
}
//# sourceMappingURL=local-files.js.map
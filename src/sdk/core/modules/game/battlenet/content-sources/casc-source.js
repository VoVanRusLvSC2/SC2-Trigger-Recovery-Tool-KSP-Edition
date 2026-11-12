import { isAbsolute } from 'node:path';
import { indexCacheEnabled } from '@modkit/sdk';
import { installationBuild, openCascInstallation } from '@modkit/blizzard-casc/installation-node';
import { entry, parts, sorted, MAX_FILE } from "./local-files.js";
/** What of the storage this source shows: the packages, as the installation folder shows its own. */
const TOP_LEVEL = new Map([['mods', 'Mods'], ['campaigns', 'Campaigns']]);
/** Rows one `files` page may scan before it answers, so a search over 666k names stays cancellable. */
const FILES_SCAN_BUDGET = 100_000;
const encoder = new TextEncoder();
/** Whether `needle` occurs in `bytes[from..to)` in order, not necessarily together. */
function inOrder(bytes, from, to, needle) {
    let at = 0;
    for (let i = from; i < to && at < needle.length; i++)
        if (bytes[i] === needle[at])
            at++;
    return at === needle.length;
}
/**
 * Whether the name ending at `to` has one of `extensions` (lower-case, no dot; empty is none). One
 * set lookup: a text search asks for every extension VS Code knows as a language — over three
 * hundred — and comparing each name with each of them cost seconds over 655k names.
 */
function hasExtension(bytes, from, to, extensions) {
    let dot = to - 1;
    while (dot >= from && bytes[dot] !== 0x2e && bytes[dot] !== 0x2f)
        dot--;
    const start = dot >= from && bytes[dot] === 0x2e ? dot + 1 : to;
    if (to - start > 32)
        return false;
    let extension = '';
    for (let i = start; i < to; i++)
        extension += String.fromCharCode(bytes[i]);
    return extensions.has(extension);
}
/**
 * The stock packages of an installed StarCraft II — `Mods/Core.SC2Mod`, Liberty and the rest — which
 * the game keeps in its CASC storage rather than in the `Mods` folder beside user mods.
 *
 * The storage is opened on first use and kept: indexing it costs seconds, and every map and mod
 * resolves Core through it. With a cache directory the parsed name index is kept between windows
 * (~2 s of MNDX parsing becomes a ~0.2 s file read until the game updates).
 */
export class Sc2CascSource {
    installation;
    cache;
    reader;
    constructor(installation, cache) {
        this.installation = installation;
        this.cache = cache;
        if (!isAbsolute(installation))
            throw new Error('Local source root must be absolute');
    }
    /**
     * Opening the installation as a container is answered with this root: one reader per window.
     * `revision` (the build key) and `product` come from `.build.info` each time, so a game update
     * shows as a new revision to the index caches that key by it.
     */
    get root() {
        const build = installationBuild(this.installation);
        return { id: 'local:casc', label: 'StarCraft II — CASC', kind: 'local', region: 'local', storageOf: this.installation,
            game: 'starcraft2', ...(build === undefined ? {} : { revision: build.buildKey, product: build.product }) };
    }
    open() {
        if (this.reader === undefined) {
            const cache = this.cache;
            const opening = openCascInstallation(this.installation, cache === undefined ? undefined : {
                directory: cache.directory,
                ...(cache.legacy === undefined ? {} : { legacy: cache.legacy }),
                names: product => indexCacheEnabled(cache.switches, product, 'names'),
            });
            // A refused open is not kept: the game may be repaired or finish updating.
            opening.catch(() => { if (this.reader === opening)
                this.reader = undefined; });
            this.reader = opening;
        }
        return this.reader;
    }
    async list(path) {
        const names = parts(path);
        if (names.length > 0 && !TOP_LEVEL.has(names[0].toLowerCase()))
            throw new Error('Select Mods or Campaigns');
        const index = (await this.open()).entryIndex;
        const prefix = names.length === 0 ? '' : `${names.join('/').toLowerCase()}/`;
        const end = index.lowerBound(`${prefix}￿`);
        const found = [];
        // Keys are sorted, so each child directory is skipped past in one jump.
        for (let at = index.lowerBound(prefix); at < end;) {
            const tail = index.keyAt(at).slice(prefix.length), slash = tail.indexOf('/');
            const name = slash === -1 ? tail : tail.slice(0, slash);
            const shown = names.length > 0 ? name : TOP_LEVEL.get(name);
            if (shown !== undefined) {
                found.push(entry([path, shown].filter(Boolean).join('/'), slash !== -1, slash === -1 ? index.contentSizeAt(at) : undefined));
            }
            at = slash === -1 ? at + 1 : index.lowerBound(`${prefix}${name}/￿`);
        }
        if (names.length > 0 && found.length === 0)
            throw new Error('CASC directory was not found');
        return sorted(found);
    }
    /**
     * Files beneath `path` for a workspace search, straight from the name index. Rows are sorted, so
     * a folder is one range of them, and a row the query rules out is judged on its bytes alone.
     */
    async files(path, query) {
        const names = parts(path);
        if (names.length > 0 && !TOP_LEVEL.has(names[0].toLowerCase()))
            throw new Error('Select Mods or Campaigns');
        if (!Number.isSafeInteger(query.limit) || query.limit < 1)
            throw new Error('Invalid file page limit');
        const index = (await this.open()).entryIndex;
        // Under the root this source shows Mods and Campaigns: each one range of the sorted keys.
        const prefixes = names.length === 0 ? [...TOP_LEVEL.keys()].sort().map(key => `${key}/`)
            : [`${names.join('/').toLowerCase()}/`];
        const ranges = prefixes.map(prefix => ({ prefix, start: index.lowerBound(prefix), end: index.lowerBound(`${prefix}￿`) }));
        const shown = (prefix, key) => names.length > 0 ? `${path}/${key.slice(prefix.length)}`
            : `${TOP_LEVEL.get(prefix.slice(0, -1))}/${key.slice(prefix.length)}`;
        const pattern = encoder.encode((query.pattern ?? '').replace(/\s+/gu, '').replaceAll('\\', '/').toLowerCase());
        const extensions = query.extensions === undefined ? undefined : new Set(query.extensions.map(extension => extension.toLowerCase()));
        let row = query.cursor === undefined ? ranges[0].start : Number(query.cursor);
        if (!Number.isSafeInteger(row) || row < 0)
            throw new Error('Invalid file cursor');
        const items = [];
        let scanned = 0;
        for (const range of ranges) {
            if (row >= range.end)
                continue;
            row = Math.max(row, range.start);
            index.forEachKey(row, range.end, (bytes, from, to, at) => {
                row = at + 1;
                if ((extensions === undefined || hasExtension(bytes, from, to, extensions)) &&
                    (pattern.length === 0 || inOrder(bytes, from, to, pattern))) {
                    items.push({ path: shown(range.prefix, index.keyAt(at)), size: index.contentSizeAt(at) });
                }
                return items.length < query.limit && ++scanned < FILES_SCAN_BUDGET;
            });
            if (items.length >= query.limit || scanned >= FILES_SCAN_BUDGET)
                break;
        }
        return row < ranges.at(-1).end && (items.length >= query.limit || scanned >= FILES_SCAN_BUDGET)
            ? { items, nextCursor: String(row) } : { items };
    }
    async read(path, maximum) {
        if (!Number.isSafeInteger(maximum) || maximum < 0 || maximum > MAX_FILE)
            throw new Error('Invalid preview limit');
        parts(path);
        const reader = await this.open(), size = reader.contentSizeOf(path);
        if (size === undefined)
            throw new Error('CASC file was not found');
        if (size > maximum)
            throw new Error('CASC file exceeds the read limit');
        return reader.readPath(path);
    }
    async resolveLocalPath() { return undefined; }
    async refresh() { }
    async dispose() {
        const reader = this.reader;
        this.reader = undefined;
        await reader?.then(value => value.close(), () => undefined);
    }
}
//# sourceMappingURL=casc-source.js.map
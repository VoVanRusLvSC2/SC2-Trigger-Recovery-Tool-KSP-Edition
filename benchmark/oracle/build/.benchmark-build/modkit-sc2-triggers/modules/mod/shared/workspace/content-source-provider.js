const PACKAGE = /\.(sc2mod|sc2map|sc2campaign)$/iu;
/** Packages are found where the game keeps them; the rest of a source is not searched for them. */
const PACKAGE_FOLDERS = ['Mods', 'Maps', 'Campaigns'];
/** The content sources refuse a single read past 64 MiB; nothing a package holds is larger. */
const MAXIMUM_FILE = 64 * 1024 * 1024;
const trim = (path) => path.replace(/\\/gu, '/').replace(/^\/+|\/+$/gu, '');
const baseName = (path) => path.slice(path.lastIndexOf('/') + 1);
/** A content source as a loader file system, each directory listed once. */
export class ContentSourceReader {
    storage;
    listings = new Map();
    constructor(storage) {
        this.storage = storage;
    }
    entries(path) {
        const key = trim(path);
        let listing = this.listings.get(key);
        if (listing === undefined) {
            listing = this.storage.list(key);
            listing.catch(() => this.listings.delete(key));
            this.listings.set(key, listing);
        }
        return listing;
    }
    /** Every file under `path`, relative to it. */
    async list(path) {
        const files = [];
        const walk = async (directory, prefix) => {
            for (const entry of await this.entries(directory)) {
                const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
                if (entry.directory)
                    await walk(directory === '' ? entry.name : `${directory}/${entry.name}`, relative);
                else
                    files.push(relative);
            }
        };
        await walk(trim(path), '');
        return files;
    }
    async get(path) {
        return this.storage.read(trim(path), MAXIMUM_FILE);
    }
    async getText(path) {
        return new TextDecoder().decode(await this.get(path));
    }
    async exists(path) {
        const key = trim(path);
        if (key === '')
            return true;
        const parent = key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : '';
        const name = baseName(key).toLowerCase();
        const entries = await this.entries(parent).catch(() => []);
        return entries.some(entry => entry.name.toLowerCase() === name);
    }
    async close() {
        await this.storage.dispose?.();
    }
}
/**
 * Finds a package in one content source: a qualified reference (`Mods/Void.SC2Mod`) in its own
 * folder, a bare name in `Mods`, `Maps` and `Campaigns`. A name with a package extension matches
 * only that kind — `Void.SC2Campaign` is never `Mods/Void.SC2Mod`; one without matches any kind.
 */
export function contentSourceResolver(protocol, reader, label) {
    return {
        label,
        async resolve(name) {
            const wanted = trim(name);
            const target = baseName(wanted).toLowerCase();
            const matches = (entry) => PACKAGE.test(target)
                ? entry.toLowerCase() === target
                : PACKAGE.test(entry) && entry.toLowerCase().replace(PACKAGE, '') === target;
            const folders = wanted.includes('/') ? [wanted.slice(0, wanted.lastIndexOf('/'))] : PACKAGE_FOLDERS;
            for (const folder of folders) {
                const hit = (await reader.entries(folder).catch(() => [])).find(entry => matches(entry.name));
                // Every SC2 storage is case-insensitive; a named package keeps the reference's spelling
                // (CASC lists `core.sc2mod`, the game and its files say `Core.SC2Mod`).
                if (hit !== undefined)
                    return `${protocol}${folder}/${PACKAGE.test(target) ? baseName(wanted) : hit.name}`;
            }
            return undefined;
        },
    };
}

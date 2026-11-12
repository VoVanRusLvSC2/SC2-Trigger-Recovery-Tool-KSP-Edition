import { lstat, readdir } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { blob, decodeCacheHeader, field, number, reference, references } from './cache-header.js';
import { headerLocales, headerText, parseLocaleTable, stringReference } from './header-strings.js';
import { archiveList, archiveRead, confined, entry, LocalArchives, MAX_FILE, parts, readBounded, sorted } from './local-files.js';
const utf8 = (bytes) => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const clean = (text) => text.replace(/<[^>]*>/gu, '').replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '_').trim().replace(/[. ]+$/u, '').slice(0, 140) || 'Без названия';
/** Offline Battle.net cache catalogue. Only the selected Cache subtree is read; no network or account access. */
export class BattleNetCacheSource {
    directory;
    locale;
    root = { id: 'local:cache', label: 'Кеш Battle.net — карты и моды', kind: 'local', region: 'local' };
    index;
    archives = new LocalArchives();
    closed = false;
    constructor(directory, locale = 'ruRU') {
        this.directory = directory;
        this.locale = locale;
        if (!isAbsolute(directory))
            throw new Error('Cache source root must be absolute');
    }
    ensure() { if (this.closed)
        throw new Error('Cache source is closed'); }
    getIndex() {
        this.ensure();
        if (!this.index) {
            const task = this.scan();
            this.index = task;
            void task.catch(() => { if (this.index === task)
                this.index = undefined; });
        }
        return this.index;
    }
    async scan() {
        const files = new Map();
        let examined = 0;
        const walk = async (path, depth) => {
            this.ensure();
            if (depth > 16)
                throw new Error('Cache directory depth exceeds limit');
            for (const item of await readdir(await confined(this.directory, path), { withFileTypes: true })) {
                if (++examined > 100000)
                    throw new Error('Cache index exceeds 100000 entries');
                if (item.isSymbolicLink())
                    continue;
                const child = [path, item.name].filter(Boolean).join('/');
                if (item.isDirectory())
                    await walk(child, depth + 1);
                else if (item.isFile() && /^[a-f0-9]{64}\.s2m[a-z]$/iu.test(item.name)) {
                    const name = item.name.toLowerCase();
                    if (!files.has(name))
                        files.set(name, child);
                }
            }
        };
        await walk('', 0);
        const records = new Map(), knownArchives = new Set();
        const localeTables = new Map();
        const index = { files, records, headers: 0, malformed: 0, orphans: 0 };
        // A missing/corrupt localization must not hide the header's original filename: headerText skips it.
        const localizedText = async (header, tag) => headerText(headerLocales(header, this.locale), stringReference(field(field(header, 4), tag)), async (bytes) => {
            const handle = reference(bytes), path = handle && files.get(handle.file);
            if (!handle || !path)
                return undefined;
            let table = localeTables.get(handle.file);
            if (!table) {
                table = parseLocaleTable(utf8(await readBounded(this.directory, path, 1024 * 1024, handle.sha256)));
                if (localeTables.size >= 64)
                    localeTables.delete(localeTables.keys().next().value);
                localeTables.set(handle.file, table);
            }
            return table;
        });
        for (const [file, path] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
            this.ensure();
            if (!file.endsWith('.s2mh'))
                continue;
            index.headers++;
            const ownHeader = { file, type: 's2mh', sha256: file.slice(0, 64), region: '' };
            let record;
            try {
                const header = field(decodeCacheHeader(await readBounded(this.directory, path, 8 * 1024 * 1024, ownHeader.sha256)), 0);
                const identity = field(header, 0), originalName = utf8(blob(field(header, 1)));
                const archive = reference(blob(field(header, 2))), version = number(field(identity, 1)), id = number(field(identity, 0));
                if (id > 0xffffffff || version > 0xffffffff || (archive && archive.type !== 's2ma'))
                    throw new Error('Invalid cached publication identity');
                if (archive)
                    knownArchives.add(archive.file);
                let title, description;
                try {
                    title = await localizedText(header, 0);
                }
                catch { /* Original package name is still useful. */ }
                try {
                    description = await localizedText(header, 1);
                }
                catch { /* Description is optional. */ }
                title ??= originalName.replace(/^.*[\\/]/u, '').replace(/\.SC2(?:Map|Mod|Campaign)$/iu, '');
                const suffix = /\.SC2(Map|Mod|Campaign)$/iu.exec(originalName)?.[1];
                const available = archive && files.has(archive.file);
                const directory = `${clean(title)} [${archive?.region || '?'} ${id} v${version >>> 16}.${version & 65535}${available ? '' : '; метаданные'} ${file.slice(0, 12)}]${suffix ? `.SC2${suffix}` : '.s2mh'}`;
                record = { directory, title, ...(description ? { description } : {}), originalName, id, version, region: archive?.region ?? '',
                    ...(archive ? { archive } : {}), components: [ownHeader, ...references(header)] };
            }
            catch {
                index.malformed++;
                record = { directory: `Нераспознанный заголовок [${file.slice(0, 12)}].s2mh`, title: 'Нераспознанный заголовок',
                    error: 'Не удалось проверить хеш или разобрать заголовок. Доступен исходный компонент.', components: [ownHeader] };
            }
            if (records.has(record.directory))
                record.directory = `${record.directory} [${file.slice(12, 64)}]`;
            records.set(record.directory, record);
        }
        for (const file of files.keys())
            if (file.endsWith('.s2ma') && !knownArchives.has(file)) {
                index.orphans++;
                const ref = { file, type: 's2ma', sha256: file.slice(0, 64), region: '' };
                let directory = `Неизвестная карта или мод [${file.slice(0, 16)}].s2ma`;
                if (records.has(directory))
                    directory += ` [${file.slice(16, 64)}]`;
                records.set(directory, { directory, title: 'Неизвестная карта или мод', archive: ref, components: [ref],
                    error: 'В кеше нет заголовка, связывающего этот компонент с именем карты. Компонент может быть частью карты или Standard Data.' });
            }
        return index;
    }
    metadata(record, index) {
        return new TextEncoder().encode(JSON.stringify({ title: record.title, description: record.description, originalName: record.originalName,
            id: record.id, version: record.version, region: record.region,
            archivePresent: !!record.archive && index.files.has(record.archive.file),
            note: record.error ?? 'Наличие компонента не гарантирует полный проект. Хеши проверяются при чтении; зависимости автоматически не собираются.',
            components: record.components.map(ref => ({ ...ref, present: index.files.has(ref.file) })) }, null, 2));
    }
    async resolveArchive(handle) {
        this.ensure();
        if (!/^s2m[a-z]$/u.test(handle.type) ||
            !/^[a-f0-9]{64}$/u.test(handle.sha256) ||
            handle.file !== `${handle.sha256}.${handle.type}`) {
            throw new TypeError('Invalid Blizzard cache handle');
        }
        const index = await this.getIndex();
        if (!index.files.has(handle.file)) {
            return { sourceId: this.root.id, state: 'missing', handle };
        }
        const record = [...index.records.values()].find(item => item.archive?.file === handle.file);
        if (record === undefined) {
            return { sourceId: this.root.id, state: 'missing', handle };
        }
        return {
            sourceId: this.root.id,
            state: 'resolved',
            handle,
            path: `${record.directory}/Content`,
        };
    }
    /** Logical package names keyed by the physical cache component filename. */
    async archiveDisplayNames() {
        const result = new Map();
        for (const record of (await this.getIndex()).records.values()) {
            if (!record.archive || !record.originalName)
                continue;
            const original = record.originalName.replace(/^.*[\\/]/u, '');
            const match = /^(.*?)(\.SC2(?:Map|Mod|Campaign))$/iu.exec(original);
            if (match)
                result.set(record.archive.file, `${clean(match[1])}${match[2]}`);
        }
        return result;
    }
    async list(path) {
        const names = parts(path), index = await this.getIndex();
        if (!names.length)
            return sorted([...index.records.keys()].map(path => entry(path, true)));
        const record = index.records.get(names[0]);
        if (!record)
            throw new Error('Cached map was not found');
        if (names.length === 1)
            return [entry(`${path}/metadata.json`, false, this.metadata(record, index).length),
                entry(`${path}/Components`, true), ...(record.archive && index.files.has(record.archive.file) ? [entry(`${path}/Content`, true)] : [])];
        if (names[1] === 'Components' && names.length === 2) {
            return Promise.all(record.components.filter(ref => index.files.has(ref.file)).map(async (ref) => entry(`${path}/${ref.file}`, false, (await lstat(await confined(this.directory, index.files.get(ref.file)))).size)));
        }
        if (names[1] === 'Content' && record.archive) {
            const file = index.files.get(record.archive.file);
            if (!file)
                throw new Error('Archive is absent from the local cache');
            return this.archives.use(this.directory, file, record.archive.sha256, reader => archiveList(reader, `${record.directory}/Content`, names.slice(2).join('/')));
        }
        throw new Error('Cached directory was not found');
    }
    async read(path, maximum) {
        if (!Number.isSafeInteger(maximum) || maximum < 0 || maximum > MAX_FILE)
            throw new Error('Invalid preview limit');
        const names = parts(path), index = await this.getIndex(), record = index.records.get(names[0] ?? '');
        if (!record)
            throw new Error('Cached map was not found');
        if (names.length === 2 && names[1] === 'metadata.json') {
            const bytes = this.metadata(record, index);
            if (bytes.length > maximum)
                throw new Error('Metadata exceeds read limit');
            return bytes;
        }
        if (names.length === 3 && names[1] === 'Components') {
            const ref = record.components.find(ref => ref.file === names[2]), file = ref && index.files.get(ref.file);
            if (ref && file)
                return readBounded(this.directory, file, maximum, ref.sha256);
        }
        if (names[1] === 'Content' && names.length > 2 && record.archive) {
            const file = index.files.get(record.archive.file);
            if (file)
                return this.archives.use(this.directory, file, record.archive.sha256, reader => archiveRead(reader, names.slice(2).join('/'), maximum));
        }
        throw new Error('Cached file was not found');
    }
    async resolveLocalPath(path) {
        const names = parts(path);
        if (!names.length)
            return { path: await confined(this.directory, ''), kind: 'directory' };
        const index = await this.getIndex(), record = index.records.get(names[0]);
        if (!record)
            throw new Error('Cached map was not found');
        let file;
        if (names.length === 1 || names[1] === 'Content')
            file = record.archive && index.files.get(record.archive.file);
        if (names[1] === 'Components' && names.length === 3)
            file = index.files.get(names[2]);
        if (!file)
            return undefined;
        return { path: await confined(this.directory, file), kind: 'file' };
    }
    async refresh() { await this.index?.catch(() => undefined); this.index = undefined; await this.archives.refresh(); }
    async dispose() { this.closed = true; await this.refresh(); await this.archives.dispose(); }
}
//# sourceMappingURL=cache-source.js.map
/**
 * JSON mod format — a self-contained JSON representation of a mod's catalog: per namespace, each
 * entity's raw fields plus its `class` (when not the namespace's base class) and `parent`, with a
 * top-level `deps` list and a `manifest`. `export.convert` writes it (`exportJsonMod`); this module
 * reads it back.
 *
 * `jsonModToFiles(jsonMod)` synthesizes the SC2Components layout (GameData `<Catalog>` XML,
 * DocumentInfo, ComponentList). `jsonModContentSource` serves JSON mods as a content source, so the
 * one mod loader opens one — or resolves one as a dependency — exactly like a folder mod.
 */
import { entityToXml, constEntryToXml } from '../../data/shared/format/entity-xml.js';
import { writeSc2DocumentInfoDependencies } from '../codecs/document-metadata/dependencies.js';
export const JSON_MOD_FORMAT = 'modkit-json-mod@1';
/** Map namespace → SC2 data file name (lowercase + "data.xml"), as the editor uses. */
function nsToFileName(ns) {
    return `${ns.toLowerCase()}data.xml`;
}
/** Split an entity object into its structural attrs and its raw data fields. */
function splitEntity(entity) {
    const { class: cls, parent, ...rest } = entity;
    return { cls, parent, data: rest };
}
/**
 * Synthesize the SC2Components file layout for a JSON mod: one GameData `<Catalog>`
 * XML per namespace (+ a `DocumentInfo` declaring deps, + a `ComponentList`). Paths
 * are relative to the mod root, matching `exportSc2Components`.
 */
export function jsonModToFiles(jsonMod, indent = '    ') {
    const files = [];
    for (const [ns, byId] of Object.entries(jsonMod.entries)) {
        const ids = Object.keys(byId);
        if (ids.length === 0)
            continue;
        const xmlLines = ['<?xml version="1.0" encoding="utf-8"?>', '<Catalog>'];
        for (const id of ids) {
            const { cls, parent, data } = splitEntity(byId[id]);
            if (ns === 'Const') {
                const type = typeof data['type'] === 'string' ? data['type'] : '';
                const value = typeof data['value'] === 'string' ? data['value'] : '';
                xmlLines.push(constEntryToXml(id, type, value, indent));
            }
            else {
                const className = cls ?? `C${ns}`;
                xmlLines.push(entityToXml(className, id, parent, data, id === '', { indent, writeDefaultAttr: true }));
            }
        }
        xmlLines.push('</Catalog>');
        files.push({
            path: `base.sc2data/GameData/${nsToFileName(ns)}`,
            content: xmlLines.join('\n') + '\n',
        });
    }
    if (jsonMod.deps.length > 0) {
        files.push({ path: 'DocumentInfo', content: buildDocumentInfo(jsonMod.deps) });
    }
    files.push({ path: 'ComponentList.SC2Components', content: buildComponentList() });
    return files;
}
function buildDocumentInfo(deps) {
    const values = deps.map(dep => {
        const name = /\.(sc2mod|sc2map|sc2campaign)$/i.test(dep) ? dep : `${dep}.SC2Mod`;
        return `file:Mods\\${name}`;
    });
    return writeSc2DocumentInfoDependencies(values);
}
function buildComponentList() {
    return [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<Components>',
        '    <DataComponent Type="gada">GameData</DataComponent>',
        '    <DataComponent Type="info">DocumentInfo</DataComponent>',
        '</Components>',
        '',
    ].join('\n');
}
/** Read a JSON mod, refusing anything that does not name this format. */
export function parseJsonMod(text) {
    const value = JSON.parse(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError('a JSON mod must be an object');
    }
    if (value.manifest?.format !== JSON_MOD_FORMAT) {
        throw new TypeError(`a JSON mod must declare manifest.format "${JSON_MOD_FORMAT}"`);
    }
    if (!Array.isArray(value.deps) || !value.deps.every(dep => typeof dep === 'string')) {
        throw new TypeError('a JSON mod must list its deps as strings');
    }
    const entries = value.entries;
    if (entries === null ||
        typeof entries !== 'object' ||
        Array.isArray(entries) ||
        !Object.values(entries).every(byId => byId !== null && typeof byId === 'object' && !Array.isArray(byId))) {
        throw new TypeError('a JSON mod must map namespaces to entities by id');
    }
    return value;
}
/** The package folder a JSON mod is served as: its manifest name (or key), `.SC2Mod` unless named. */
function rootName(key, jsonMod) {
    const explicit = jsonMod.manifest.name ?? key;
    return /\.(sc2mod|sc2map|sc2campaign)$/i.test(explicit) ? explicit : `${explicit}.SC2Mod`;
}
/**
 * JSON mods as a content source: each under `Mods/<name>.SC2Mod`, holding the files
 * `jsonModToFiles` synthesizes. Paths are case-insensitive, as in every StarCraft II storage.
 */
export function jsonModContentSource(id, mods) {
    const files = new Map();
    const encoder = new TextEncoder();
    for (const [key, jsonMod] of mods) {
        const root = `Mods/${rootName(key, jsonMod)}`;
        for (const file of jsonModToFiles(jsonMod)) {
            const path = `${root}/${file.path}`;
            const bytes = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
            files.set(path.toLowerCase(), { path, bytes });
        }
    }
    const fold = (path) => path.replace(/\\/gu, '/').replace(/^\/+|\/+$/gu, '').toLowerCase();
    return Object.freeze({
        id,
        async list(folder) {
            const prefix = fold(folder) === '' ? '' : `${fold(folder)}/`;
            const children = new Map();
            for (const [key, file] of files) {
                if (!key.startsWith(prefix))
                    continue;
                const rest = file.path.slice(prefix.length);
                const name = rest.split('/')[0];
                const directory = rest.includes('/');
                children.set(name.toLowerCase(), directory ? { name, directory } : { name, directory, size: file.bytes.byteLength });
            }
            if (children.size === 0 && prefix !== '')
                throw new Error(`${folder} is not in ${id}`);
            return [...children.values()];
        },
        async read(path, maxBytes) {
            const file = files.get(fold(path));
            if (file === undefined)
                throw new Error(`${path} is not in ${id}`);
            if (file.bytes.byteLength > maxBytes)
                throw new RangeError(`${path} exceeds ${maxBytes} bytes`);
            return file.bytes;
        },
    });
}
//# sourceMappingURL=json-mod.js.map
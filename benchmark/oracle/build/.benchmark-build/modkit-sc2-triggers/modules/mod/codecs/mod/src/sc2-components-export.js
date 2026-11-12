/**
 * SC2Components export belongs to the SC2 mod codec: it chooses the document layout, retains
 * opaque document files, and writes the component list. Per-namespace GameData XML remains owned
 * by the sc2-data formatter.
 */
import { catalogNamespaceFileName, catalogNamespaceXml } from '../../../../data/shared/format/export.js';
import { writeDocumentHeader } from '../../document-metadata/core/document-header.js';
const localeFolder = {
    enus: 'enUS',
    frfr: 'frFR',
    dede: 'deDE',
    eses: 'esES',
    esmx: 'esMX',
    ruru: 'ruRU',
    kokr: 'koKR',
    zhcn: 'zhCN',
    zhtw: 'zhTW',
    plpl: 'plPL',
    itit: 'itIT',
    ptbr: 'ptBR',
};
/** Serialize a resolved mod as an unpacked SC2Components directory tree. */
export function exportSc2Components(mod, options = {}) {
    const { namespaces, writeDefaultAttr = true, indent = '    ' } = options;
    const files = [];
    for (const namespace of (namespaces ?? mod.namespaces()).filter(item => mod.all(item).length > 0)) {
        files.push({
            path: `base.sc2data/GameData/${catalogNamespaceFileName(namespace)}`,
            content: catalogNamespaceXml(mod, namespace, {
                indent,
                writeDefaultAttr,
            }),
        });
    }
    for (const [localeCode, fileMap] of mod.locales) {
        const folder = localeFolder[localeCode] ?? localeCode;
        for (const [fileName, entries] of fileMap) {
            if (entries.size === 0)
                continue;
            files.push({
                path: `${folder.toLowerCase()}.sc2data/LocalizedData/${fileName}.txt`,
                content: serializeStrings(entries),
            });
        }
    }
    for (const [path, content] of mod.opaqueFiles) {
        files.push({
            path,
            content: path.toLowerCase() === 'documentheader' && mod.documentHeader !== undefined
                ? writeDocumentHeader(mod.documentHeader)
                : content,
        });
    }
    const locales = [...mod.locales.keys()].map(code => localeFolder[code] ?? code).filter(Boolean);
    files.push({ path: 'ComponentList.SC2Components', content: buildComponentList(locales) });
    return files;
}
function serializeStrings(entries) {
    return [...entries].map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
}
function buildComponentList(localeFolders) {
    const lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<Components>',
        '    <DataComponent Type="gada">GameData</DataComponent>',
        ...localeFolders.map(locale => `    <DataComponent Type="text" Locale="${locale}">GameText</DataComponent>`),
        '    <DataComponent Type="info">DocumentInfo</DataComponent>',
        '</Components>',
        '',
    ];
    return lines.join('\n');
}

/**
 * `sc2-data`'s `export.convert` surface: catalog/entity-level export (Phase D item 3).
 *
 * Moved here from `@modkitx/export`:
 *
 * - `exportJson` → {@link exportCatalogJson}: resolved-or-raw entity fields, one object per
 *   namespace keyed by entity id. Pure catalog semantics (inheritance merge, token substitution,
 *   default-entity diffing) — nothing mod-shaped.
 * - the per-namespace `<Catalog>` XML emission that `exportSc2Components` used to inline →
 *   {@link catalogNamespaceXml} / {@link catalogNamespaceFileName}, built on
 *   `./entity-xml.js`'s `entityToXml`/`constEntryToXml`.
 *
 * Mod-level SC2Components/JSON export now lives in `sc2-mod`; JSON-mod tree synthesis and
 * reading live in `mod-workspace`. `@modkitx/export` remains a compatibility facade.
 *
 * {@link exportCatalogOutputs} is the `RenameOutput`-shaped wrapper the codec operation dispatches
 * to, so a host gets bytes + media types without knowing which function produced them.
 */
import { Sc2EditInputError, } from '../../../../shared/editing/rename-transaction.js';
import { constEntryToXml, entityToXml } from './entity-xml.js';
import { SC2_DATA_CODEC_ID } from './identity.js';
/**
 * Export catalog entities to JSON — one object per namespace, keyed by entity id.
 *
 * mode='full'  (default): resolved fields (parent chain applied, tokens substituted).
 * mode='raw':             only fields explicitly set on each entity.
 *
 * Returns a plain JS object; the caller serialises with `JSON.stringify`.
 */
export function exportCatalogJson(store, options = {}) {
    const { mode = 'full', omitDefaults = false, namespaces } = options;
    const nsList = namespaces ?? store.namespaces();
    const result = {};
    for (const ns of nsList) {
        const entities = store.all(ns);
        if (entities.length === 0)
            continue;
        const baseClass = `C${ns}`;
        const nsOut = {};
        // Pre-compute default entity fields for omitDefaults
        const defaultResolved = omitDefaults && mode === 'full' ? (store.getResolved(ns, '') ?? {}) : undefined;
        for (const entity of entities) {
            const fields = mode === 'full' ? (store.getResolved(ns, entity.id) ?? {}) : entity.data;
            let out = { ...fields };
            if (defaultResolved !== undefined && entity.id !== '') {
                // Remove fields that equal the default value
                for (const key of Object.keys(out)) {
                    if (JSON.stringify(out[key]) === JSON.stringify(defaultResolved[key])) {
                        delete out[key];
                    }
                }
            }
            // Include class only when it differs from the base class (e.g. CAbilEffectTarget vs CAbil)
            if (entity.class !== baseClass) {
                out = { class: entity.class, ...out };
            }
            nsOut[entity.id] = out;
        }
        result[ns] = nsOut;
    }
    return result;
}
/** SC2 GameData file name for one namespace (SC2 convention: lowercase + "data.xml"). */
export function catalogNamespaceFileName(namespace) {
    return `${namespace.toLowerCase()}data.xml`;
}
/**
 * Serialize one namespace's entities as a complete `<Catalog>` GameData document.
 *
 * `Const` entries use the lowercase `<const type= value=>` form; every other namespace uses the
 * class-tagged entity element. This is the exact emission `exportSc2Components` used to inline.
 */
export function catalogNamespaceXml(store, namespace, options = {}) {
    const { writeDefaultAttr = true, indent = '    ' } = options;
    const xmlLines = ['<?xml version="1.0" encoding="utf-8"?>', '<Catalog>'];
    for (const entity of store.all(namespace)) {
        if (namespace === 'Const') {
            const type = typeof entity.data['type'] === 'string' ? entity.data['type'] : '';
            const value = typeof entity.data['value'] === 'string' ? entity.data['value'] : '';
            xmlLines.push(constEntryToXml(entity.id, type, value, indent));
        }
        else {
            const isDefault = entity.id === '';
            xmlLines.push(entityToXml(entity.class, entity.id, entity.parent, entity.data, isDefault, {
                indent,
                writeDefaultAttr,
            }));
        }
    }
    xmlLines.push('</Catalog>');
    return xmlLines.join('\n') + '\n';
}
function fail(message) {
    throw new Sc2EditInputError(message, {
        codecId: SC2_DATA_CODEC_ID,
        operation: 'export.convert',
    });
}
/** Validates and normalizes the JSON operation input received over a session handler. */
export function parseSc2DataExportInput(input) {
    if (input === undefined || input === null)
        return {};
    if (typeof input !== 'object' || Array.isArray(input)) {
        fail('sc2-data export.convert input must be an object.');
    }
    const { format, mode, omitDefaults, namespaces, indent, writeDefaultAttr } = input;
    if (format !== undefined && format !== 'json' && format !== 'xml') {
        fail("sc2-data export.convert `format` must be 'json' or 'xml'.");
    }
    if (mode !== undefined && mode !== 'full' && mode !== 'raw') {
        fail("sc2-data export.convert `mode` must be 'full' or 'raw'.");
    }
    if (omitDefaults !== undefined && typeof omitDefaults !== 'boolean') {
        fail('sc2-data export.convert `omitDefaults` must be a boolean.');
    }
    if (writeDefaultAttr !== undefined && typeof writeDefaultAttr !== 'boolean') {
        fail('sc2-data export.convert `writeDefaultAttr` must be a boolean.');
    }
    if (indent !== undefined && typeof indent !== 'string') {
        fail('sc2-data export.convert `indent` must be a string.');
    }
    if (namespaces !== undefined &&
        (!Array.isArray(namespaces) || namespaces.some(item => typeof item !== 'string'))) {
        fail('sc2-data export.convert `namespaces` must be an array of strings.');
    }
    return {
        ...(format === undefined ? {} : { format }),
        ...(mode === undefined ? {} : { mode }),
        ...(omitDefaults === undefined ? {} : { omitDefaults }),
        ...(writeDefaultAttr === undefined ? {} : { writeDefaultAttr }),
        ...(indent === undefined ? {} : { indent }),
        ...(namespaces === undefined ? {} : { namespaces: [...namespaces] }),
    };
}
/**
 * The `export.convert` operation body: catalog export rendered as `RenameOutput`s.
 *
 * Paths are mount-relative and deliberately carry no mod root — where a `GameData/` directory
 * lands inside an `.SC2Mod` is `sc2-mod`'s business, not the catalog's.
 */
export function exportCatalogOutputs(store, input = {}) {
    const encoder = new TextEncoder();
    if (input.format === 'xml') {
        const nsList = (input.namespaces ?? store.namespaces()).filter(ns => store.all(ns).length > 0);
        return nsList.map(ns => ({
            path: `GameData/${catalogNamespaceFileName(ns)}`,
            data: encoder.encode(catalogNamespaceXml(store, ns, input)),
            mediaType: 'application/xml',
            role: 'sc2-data',
        }));
    }
    const json = exportCatalogJson(store, input);
    return [
        {
            path: 'catalog.json',
            data: encoder.encode(JSON.stringify(json, null, 2) + '\n'),
            mediaType: 'application/json',
            role: 'sc2-data',
        },
    ];
}

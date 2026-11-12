import { getDocumentInfo, getLoadingScreenInfo, getMapInfo, parseDocumentHeader, writeDocumentHeader, } from './core/document-header.js';
import { documentInfoDependencies, documentInfoPreloads, parseDocumentInfo, writeDocumentInfo, } from './core/document-info.js';
import { parseVersionFile, resolveTypeTag, writeVersionFile } from './core/version-file.js';
import { createInspectionCodec, createTreeDataSource, editPlanFromInput, replaceBytes } from '@modkit/codec-kit';
import { isComponentListText, parseComponentListEntries } from './core/component-list.js';
import { componentListFacts, documentHeaderFacts, documentInfoFacts, versionFacts } from './facts.js';
export { buildSc2DocumentInfoDependencies, writeSc2DocumentInfoDependencies } from './dependencies.js';
const ID = 'blizzard/sc2-document-metadata';
const decoder = new TextDecoder('utf-8', { fatal: false });
const encoder = new TextEncoder();
export const operations = Object.freeze([
    Object.freeze({ id: 'asset.validate', handlerId: 'validate', mutatesSource: false, requiredPermissions: Object.freeze(['read-source']), outputKinds: Object.freeze(['json']) }),
    Object.freeze({ id: 'export.raw', handlerId: 'export-raw', mutatesSource: false, requiredPermissions: Object.freeze(['read-source']), outputKinds: Object.freeze(['bytes']) }),
    Object.freeze({ id: 'export.convert', handlerId: 'export-convert', mutatesSource: false, requiredPermissions: Object.freeze(['read-source']), outputKinds: Object.freeze(['bytes']) }),
    Object.freeze({ id: 'edit.content', handlerId: 'replace-dependencies', mutatesSource: true, requiredPermissions: Object.freeze(['read-source', 'write-source']), outputKinds: Object.freeze(['edit-plan']) }),
]);
function basename(uri) {
    return String(uri).replaceAll('\\', '/').split('/').at(-1)?.toLowerCase() ?? '';
}
function hasAscii(bytes, value) {
    if (bytes.byteLength < value.length)
        return false;
    for (let index = 0; index < value.length; index += 1)
        if (bytes[index] !== value.charCodeAt(index))
            return false;
    return true;
}
function documentInfoText(bytes) {
    const text = decoder.decode(bytes);
    return /^\s*(?:<\?xml\b[^>]*>\s*)?<DocInfo(?:\s|>)/u.test(text) ? text : undefined;
}
function componentListText(bytes) {
    const text = decoder.decode(bytes);
    return isComponentListText(text) ? text : undefined;
}
export function metadataFormat(bytes, uri = '') {
    if (bytes.byteLength >= 48 && hasAscii(bytes, 'H2CS'))
        return 'document-header';
    if (bytes.byteLength > 0) {
        try {
            if (parseVersionFile(bytes) !== null)
                return 'version-file';
        }
        catch {
            // A malformed non-empty .version sidecar is not a valid structural match.
        }
    }
    if (documentInfoText(bytes) !== undefined)
        return 'document-info';
    if (componentListText(bytes) !== undefined)
        return 'component-list';
    if (bytes.byteLength === 0 && basename(uri).endsWith('.version'))
        return 'version-file';
    return undefined;
}
function detectEmptyVersion(uri) {
    const normalized = String(uri).replaceAll('\\', '/');
    if (/\.sc2(?:map|mod|campaign)\//iu.test(normalized))
        return 0.92;
    return 0;
}
function nodeTree(node, path = []) {
    return Object.freeze({
        kind: node.name === 'Value' ? 'value' : 'section',
        label: node.name,
        ...(node.values.length === 0 ? {} : { preview: node.values.join(', ') }),
        semanticPath: Object.freeze(path),
        children: Object.freeze(node.children.map((child, index) => nodeTree(child, [...path, child.name, String(index)]))),
    });
}
/*
 * What the number does not say.
 *
 * Every one of these misled someone: a field named after a size that is not an offset, two hashes
 * that are the same value in every shipped file until they are not, a reserved run whose only
 * meaning is that it is zero. The codec is the only side that knows, so it says so beside the
 * value rather than leaving a reader to guess from the name.
 */
const METADATA_NOTES = Object.freeze({
    headerSize: 'Build/version-correlated; not an entry offset',
    markerVersion: 'Format marker; unchanged across shipped documents',
    gameSignature: 'Game signature written by the editor',
    artifactType: 'Derived from the type value below',
    artifactTypeValue: '0 = map, 2 = mod or campaign',
    hash1: 'Opaque content checksum; preserved verbatim, never recomputed',
    hash2: 'Expected to match the first hash',
    timestamp1: 'Game build the editor wrote this with, not a date',
    timestamp2: 'Second copy of the build; usually equal to the first',
    entryCount: 'Localized header entries, not dependencies',
    buildNumber: 'Game build the editor wrote this with',
    typeTag: 'Four-character component tag',
});
function headerSummary(data) {
    return Object.freeze({
        format: 'document-header', markerVersion: data.unknown1, gameSignature: data.unknown2,
        flags: data.flags, headerSize: data.headerSize, timestamp1: data.timestamp1,
        timestamp2: data.timestamp2,
        artifactType: data.unknown3 === 0 ? 'map' : data.unknown3 === 2 ? 'mod-or-campaign' : 'unknown',
        artifactTypeValue: data.unknown3, hash1: data.hash1, hash2: data.hash2,
        dependencies: Object.freeze([...data.dependencies]), entryCount: data.entries.length,
        documentInfo: getDocumentInfo(data), mapInfo: getMapInfo(data), loadingScreen: getLoadingScreenInfo(data),
        entries: Object.freeze(data.entries.map(entry => Object.freeze({ ...entry }))),
    });
}
function versionSummary(data) {
    return data === null ? Object.freeze({ format: 'version-file', empty: true }) : Object.freeze({ format: 'version-file', ...data, componentType: resolveTypeTag(data.typeTag) ?? 'unknown' });
}
function infoSummary(data) {
    return Object.freeze({ format: 'document-info', root: data.root, dependencies: Object.freeze(documentInfoDependencies(data)), preloads: Object.freeze(documentInfoPreloads(data)) });
}
function componentSummary(components) {
    return Object.freeze({ format: 'component-list', componentCount: components.length, components: Object.freeze([...components]) });
}
function sourceLabel(uri) {
    return String(uri).replaceAll('\\', '/').split('/').filter(Boolean).at(-1) ?? String(uri);
}
/** Descriptor metadata carries scalars; lists and records are the card's typed facts. */
function scalarEntries(summary) {
    return Object.entries(summary)
        .filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value))
        .map(([key, value]) => ({ key, value: value, ...(METADATA_NOTES[key] === undefined ? {} : { note: METADATA_NOTES[key] }) }));
}
function diagnosticsFor(format, data) {
    if (format !== 'document-header')
        return Object.freeze([]);
    const diagnostics = [];
    const header = data;
    if (header.unknown1 !== 8)
        diagnostics.push({ id: 'sc2-document-metadata.header.format-version', category: 'structure', severity: 'warning', code: 'blizzard.sc2-document-metadata/header-marker', message: `expected marker 8, got ${header.unknown1}` });
    if (header.unknown2 !== 0x5332)
        diagnostics.push({ id: 'sc2-document-metadata.header.game-signature', category: 'structure', severity: 'warning', code: 'blizzard.sc2-document-metadata/header-signature', message: `expected game signature 0x5332, got 0x${header.unknown2.toString(16)}` });
    if (header.unknown3 !== 0 && header.unknown3 !== 2)
        diagnostics.push({ id: 'sc2-document-metadata.header.artifact-type', category: 'structure', severity: 'warning', code: 'blizzard.sc2-document-metadata/header-artifact-type', message: `unknown artifact type ${header.unknown3}` });
    return Object.freeze(diagnostics.map(item => Object.freeze(item)));
}
function serialized(format, data, bytes) {
    if (format === 'component-list')
        return bytes.slice();
    if (format === 'document-header')
        return writeDocumentHeader(data);
    if (format === 'document-info')
        return encoder.encode(writeDocumentInfo(data));
    return data === null ? new Uint8Array() : writeVersionFile(data);
}
function replacementInfoDependencies(data, dependencies) {
    const root = structuredClone(data.root);
    const replacement = { name: 'Dependencies', values: [], children: dependencies.map(value => ({ name: 'Value', values: [value], children: [] })) };
    const index = root.children.findIndex(child => child.name === 'Dependencies');
    // A missing node goes first, where the editor writes it (and where MK2 inserted it).
    if (index < 0)
        root.children.unshift(replacement);
    else
        root.children.splice(index, 1, replacement);
    return { root };
}
function requestedDependencies(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input) || !Array.isArray(input.dependencies))
        throw new TypeError('edit.content requires an ordered dependencies array');
    if (input.dependencies.some((value) => typeof value !== 'string'))
        throw new TypeError('edit.content dependencies must contain only strings');
    return input.dependencies.map((value) => String(value));
}
const definition = Object.freeze({
    id: ID,
    format: Object.freeze({ id: 'sc2-document-metadata', label: 'StarCraft II Document Metadata' }),
    operations,
    async detect(prefix, uri) {
        const format = metadataFormat(prefix, uri);
        if (format === undefined)
            return { confidence: 0, kind: 'structure', note: 'sc2-document-metadata-structure-missing' };
        const empty = prefix.byteLength === 0;
        return { confidence: empty ? detectEmptyVersion(uri) : (format === 'document-info' && /DocumentInfo$/iu.test(uri)) || (format === 'component-list' && /\.SC2Components$/iu.test(uri)) ? 0.999 : format === 'component-list' ? 0.6 : 0.995, kind: empty ? 'context' : 'structure', note: empty ? 'empty-sc2-version-sidecar-path-evidence' : format };
    },
    async inspect(bytes, context) {
        const format = metadataFormat(bytes, context.primary.source.uri);
        if (format === undefined)
            throw new TypeError('source is not supported SC2 document metadata');
        let data;
        let summary;
        let tree;
        let traits;
        let text = false;
        let caveats = [];
        let facts;
        const factsInput = { source: context.primary.source, snapshotId: String(context.input.revisions.revision), label: sourceLabel(context.primary.source.uri), notes: METADATA_NOTES };
        if (format === 'document-header') {
            data = parseDocumentHeader(bytes);
            summary = headerSummary(data);
            facts = documentHeaderFacts(factsInput, data);
            tree = createTreeDataSource({ kind: 'document-header', label: 'DocumentHeader', children: data.entries.map((entry, index) => ({ kind: 'entry', label: entry.key, preview: entry.value, semanticPath: ['entries', String(index)] })) });
            traits = [{ id: 'content.binary', parameters: { bytes: bytes.byteLength } }, { id: 'content.metadata', parameters: { format } }, { id: 'source.dependencies', parameters: { count: data.dependencies.length } }];
            caveats = ['checksum-recomputation'];
        }
        else if (format === 'version-file') {
            data = parseVersionFile(bytes);
            summary = versionSummary(data);
            facts = versionFacts(factsInput, data, data === null ? undefined : resolveTypeTag(data.typeTag));
            tree = createTreeDataSource({ kind: 'version-file', label: data === null ? '.version (empty)' : `${resolveTypeTag(data.typeTag) ?? data.typeTag}.version`, preview: data === null ? 'semantic absence' : `build ${data.buildNumber}` });
            traits = [{ id: 'content.binary', parameters: { bytes: bytes.byteLength } }, { id: 'content.metadata', parameters: { format, empty: data === null } }];
        }
        else if (format === 'component-list') {
            const components = parseComponentListEntries(componentListText(bytes));
            data = components;
            summary = componentSummary(components);
            facts = componentListFacts(factsInput, components);
            text = true;
            tree = createTreeDataSource({ kind: 'component-list', label: 'Components', children: components.map((component, index) => ({ kind: 'component', label: component.path, preview: component.locale === undefined ? component.type : `${component.type} ${component.locale}`, semanticPath: ['components', String(index)] })) });
            traits = [{ id: 'content.text', parameters: { language: 'xml' } }, { id: 'content.metadata', parameters: { format } }, { id: 'structure.hierarchy', parameters: { root: 'Components' } }];
        }
        else {
            data = parseDocumentInfo(documentInfoText(bytes));
            summary = infoSummary(data);
            facts = documentInfoFacts(factsInput, data, summary.dependencies);
            tree = createTreeDataSource(nodeTree(data.root, ['DocInfo']));
            text = true;
            traits = [{ id: 'content.text', parameters: { language: 'xml' } }, { id: 'content.metadata', parameters: { format } }, { id: 'source.dependencies', parameters: { count: summary.dependencies.length } }, { id: 'structure.hierarchy', parameters: { root: 'DocInfo' } }];
            caveats = ['document-info-normalization'];
        }
        const diagnostics = diagnosticsFor(format, data);
        return {
            summary, metadata: [{ id: format, label: format === 'document-info' ? 'DocumentInfo' : format === 'component-list' ? 'ComponentList' : format, entries: scalarEntries(summary) }], traits, text,
            operationStates: format === 'version-file' ? [{ id: 'edit.content', state: 'disabled', reason: '.version sidecars have no dependency list' }] : format === 'component-list' ? [{ id: 'edit.content', state: 'disabled', reason: 'a component list has no dependency list' }] : [],
            dataSources: { 'common.view/tree-data-source': tree, 'common.view/subject-facts-source': facts }, diagnostics,
            unsupportedFeatures: Object.freeze(['source.save', ...caveats]),
            handlers: {
                validate: async () => ({ kind: 'json', value: diagnostics }),
                'export-raw': async () => ({ kind: 'bytes', value: bytes.slice() }),
                'export-convert': async () => ({ kind: 'bytes', value: serialized(format, data, bytes) }),
                'replace-dependencies': async (input) => {
                    if (format === 'version-file')
                        throw new TypeError('edit.content is unavailable for .version sidecars');
                    if (format === 'component-list')
                        throw new TypeError('edit.content is unavailable for component lists');
                    const dependencies = requestedDependencies(input);
                    const next = format === 'document-header' ? { ...data, dependencies } : replacementInfoDependencies(data, dependencies);
                    const output = serialized(format, next, bytes);
                    if (format === 'document-header')
                        parseDocumentHeader(output);
                    else
                        parseDocumentInfo(decoder.decode(output));
                    return { kind: 'edit-plan', plan: editPlanFromInput(context.input, { planId: `sc2-document-metadata:${format}:dependencies`, edits: [replaceBytes(0, bytes.byteLength, output, 'replace SC2 metadata dependencies')], fidelity: { roundTrip: 'semantic', preservesUnknownData: format === 'document-header', notes: format === 'document-header' ? ['DocumentHeader checksum is preserved but cannot be recomputed', 'source.save remains disabled; the host owns persistence'] : ['DocumentInfo XML formatting and entity spelling are normalized', 'source.save remains disabled; the host owns persistence'] } }) };
                },
            },
        };
    },
});
export const abiVersion = 1;
export const createCodec = (context) => createInspectionCodec(definition, context);

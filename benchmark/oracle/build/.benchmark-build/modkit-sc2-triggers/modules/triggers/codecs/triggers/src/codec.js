/** Native M5 SC2 TriggerData adapter over the exact-pin semantic implementation. */
import { createInspectionCodec, createSubjectFactsSource, createTableDataSource, createTreeDataSource, editPlanFromInput, fact, replaceBytes, } from '@modkit/codec-kit';
import { parseTriggerXmlSync } from '@modkit/blizzard-starcraft2/triggers/document/sax-reader.js';
import { scanTriggerSource, } from '@modkit/blizzard-starcraft2/triggers/document/source-index.js';
import { validateLibraryStructure, } from '@modkit/blizzard-starcraft2/triggers/document/structure-validate.js';
import { triggerLibrariesToEngineProgram } from '@modkit/blizzard-starcraft2/triggers/document/to-engine.js';
import { prepareTriggerGamelinkRename, } from '../../../services/editing/rename.js';
import { editTriggerTree, getTriggerTreeElement } from '../../../services/editing/tree-edit.js';
import { convertGalaxyToTriggers, convertTriggersToGalaxy, } from '../../../services/galaxy-conversion/index.js';
import { detectTriggerBytes } from '../../../services/source-detection.js';
const ID = 'blizzard/sc2-triggers';
const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();
export const SC2_TRIGGER_OPERATION_MAP = Object.freeze({
    'view.inspect': 'inspect',
    'script.symbols': 'symbols',
    'script.references': 'references',
    'asset.validate': 'validate',
    'asset.search': 'search',
    'asset.compare': 'compare',
    'blizzard/sc2-triggers.tree-page': 'tree-page',
    'blizzard/sc2-triggers.element-get': 'element-get',
    'blizzard/sc2-triggers.parameter-update': 'parameter-update',
    'blizzard/sc2-triggers.element-insert': 'element-insert',
    'blizzard/sc2-triggers.element-move': 'element-move',
    'blizzard/sc2-triggers.element-delete': 'element-delete',
    'edit.content': 'rename-gamelinks',
    'export.convert': 'export-convert',
    'blizzard/sc2-triggers.to-engine': 'to-engine',
    'export.raw': 'export-raw',
    'blizzard/sc2-triggers.trigger-to-galaxy': 'trigger-to-galaxy',
    'blizzard/sc2-triggers.galaxy-to-triggers': 'galaxy-to-triggers',
});
const read = Object.freeze(['read-source']);
const write = Object.freeze(['read-source', 'write-source']);
const operation = (id, outputKinds, mutatesSource = false) => Object.freeze({
    id,
    handlerId: SC2_TRIGGER_OPERATION_MAP[id],
    mutatesSource,
    requiredPermissions: mutatesSource ? write : read,
    outputKinds: Object.freeze(outputKinds),
});
export const operations = Object.freeze([
    operation('view.inspect', ['json']),
    operation('script.symbols', ['json']),
    operation('script.references', ['json']),
    operation('asset.validate', ['json']),
    operation('asset.search', ['json']),
    operation('asset.compare', ['json']),
    operation('blizzard/sc2-triggers.tree-page', ['json']),
    operation('blizzard/sc2-triggers.element-get', ['json']),
    operation('blizzard/sc2-triggers.parameter-update', ['edit-plan'], true),
    operation('blizzard/sc2-triggers.element-insert', ['edit-plan'], true),
    operation('blizzard/sc2-triggers.element-move', ['edit-plan'], true),
    operation('blizzard/sc2-triggers.element-delete', ['edit-plan'], true),
    operation('edit.content', ['edit-plan'], true),
    operation('export.convert', ['bytes']),
    operation('blizzard/sc2-triggers.to-engine', ['json']),
    operation('export.raw', ['bytes']),
    operation('blizzard/sc2-triggers.trigger-to-galaxy', ['json']),
    operation('blizzard/sc2-triggers.galaxy-to-triggers', ['json']),
]);
function triggerRoot(text) {
    return /^\s*(?:<\?xml\b[^>]*>\s*)?<(?:TriggerData|TriggerLib)(?:\s|>)/u.test(text);
}
function sourceName(uri) {
    const normalized = uri.replaceAll('\\', '/');
    return normalized.slice(normalized.lastIndexOf('/') + 1) || 'Triggers';
}
function wrapImplicitMapLibrary(text, libraryId = 'Map') {
    const open = /<TriggerData(?:\s[^>]*)?>/u.exec(text);
    if (open === null)
        return text;
    const offset = open.index + open[0].length;
    return `${text.slice(0, offset)}<Standard Id="${libraryId}"/>${text.slice(offset)}`;
}
function parsePrimaryLibraries(text) {
    const direct = [...parseTriggerXmlSync(text).values()];
    return direct.length === 0
        ? [...parseTriggerXmlSync(wrapImplicitMapLibrary(text)).values()]
        : direct;
}
function textOf(bytes, budget) {
    if (BigInt(bytes.byteLength) > budget.maxInputBytes) {
        throw new RangeError('TriggerData exceeds maxInputBytes budget');
    }
    if (bytes.byteLength > budget.maxScalarBytes) {
        throw new RangeError('TriggerData exceeds maxScalarBytes budget');
    }
    if (bytes.includes(0))
        throw new TypeError('TriggerData contains a NUL byte');
    const text = decoder.decode(bytes);
    if (!triggerRoot(text))
        throw new TypeError('SC2 TriggerData root is missing');
    return text;
}
function records(value) {
    return Array.isArray(value)
        ? value.filter((item) => item !== null && typeof item === 'object' && !Array.isArray(item))
        : [];
}
function dependencyInputs(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input))
        return [];
    const raw = input.dependencyLibraries;
    if (!Array.isArray(raw))
        return [];
    return raw.map((item, index) => {
        if (typeof item === 'string')
            return { triggerData: item };
        if (item === null || typeof item !== 'object' || Array.isArray(item)) {
            throw new TypeError(`dependencyLibraries[${index}] must be TriggerData text or an object`);
        }
        const value = item;
        if (typeof value['triggerData'] !== 'string') {
            throw new TypeError(`dependencyLibraries[${index}].triggerData must be a string`);
        }
        return {
            triggerData: value['triggerData'],
            ...(typeof value['triggerStrings'] === 'string' ? { triggerStrings: value['triggerStrings'] } : {}),
            ...(typeof value['gameStrings'] === 'string' ? { gameStrings: value['gameStrings'] } : {}),
            ...(typeof value['sourcePath'] === 'string' ? { sourcePath: value['sourcePath'] } : {}),
        };
    });
}
function parseDependencies(input) {
    const libraries = [];
    for (const dependency of dependencyInputs(input)) {
        libraries.push(...parsePrimaryLibraries(dependency.triggerData));
    }
    return libraries;
}
/**
 * Library ids this document references but does not define. Like MK2, they may stay unresolved
 * when no dependency library is supplied; a supplied dependency is still checked.
 */
function externalLibraryIds(index, libraries) {
    const own = new Set(libraries.map(library => library.id));
    const external = new Set();
    for (const reference of index.references) {
        const library = reference.target.library;
        if (library !== undefined && !own.has(library))
            external.add(library);
    }
    for (const reference of index.libraryReferences) {
        if (!own.has(reference.targetLibrary))
            external.add(reference.targetLibrary);
    }
    return external;
}
function rangeValue(range) {
    return Object.freeze({
        start: range.start,
        end: range.end,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
    });
}
function findingDiagnostic(finding, index, ordinal) {
    const source = index.elements.find(element => element.id === finding.elementId &&
        (finding.library === undefined || element.library === finding.library));
    return Object.freeze({
        id: `sc2-triggers.structure.${ordinal}.${finding.code}`,
        category: 'structure',
        code: `blizzard.sc2-triggers/${finding.code.toLowerCase().replaceAll('_', '-')}`,
        message: finding.message,
        severity: 'error',
        data: Object.freeze({
            ...(finding.library === undefined ? {} : { library: finding.library }),
            ...(finding.elementId === undefined ? {} : { elementId: finding.elementId }),
            ...(source === undefined ? {} : { range: rangeValue(source.range) }),
        }),
    });
}
function symbolValue(index) {
    return Object.freeze(index.elements.map(element => Object.freeze({
        type: element.type,
        id: element.id,
        name: element.identifier?.value,
        library: element.library,
        offset: element.range.startOffset,
        range: rangeValue(element.range),
        complete: element.complete,
    })));
}
function referenceValue(index) {
    return Object.freeze([
        ...index.libraryReferences.map(reference => Object.freeze({
            kind: reference.kind,
            sourceLibrary: reference.sourceLibrary,
            target: Object.freeze({ library: reference.targetLibrary }),
            range: rangeValue(reference.range),
            complete: reference.complete,
        })),
        ...index.references.map(reference => Object.freeze({
            kind: reference.kind,
            role: reference.role,
            source: reference.source,
            target: reference.target,
            range: rangeValue(reference.range),
            complete: reference.complete,
        })),
    ]);
}
function searchValue(index, input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('asset.search requires an object input');
    }
    const query = input.query;
    if (typeof query !== 'string')
        throw new TypeError('asset.search requires query text');
    const lower = query.toLocaleLowerCase();
    const types = new Set(records(input.types)
        .map(item => item['type'])
        .filter((item) => typeof item === 'string'));
    const rawTypes = input.types;
    if (Array.isArray(rawTypes)) {
        for (const item of rawTypes)
            if (typeof item === 'string')
                types.add(item);
    }
    return Object.freeze(index.elements.filter(element => (types.size === 0 || types.has(element.type)) &&
        `${element.identifier?.value ?? ''}\n${element.id}`.toLocaleLowerCase().includes(lower)).map(element => Object.freeze({
        type: element.type,
        id: element.id,
        name: element.identifier?.value,
        library: element.library,
        range: rangeValue(element.range),
    })));
}
function pageInput(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('tree-page requires an object input');
    }
    const value = input;
    const cursor = value.cursor === undefined ? 0 : Number(value.cursor);
    const limit = value.limit === undefined ? 100 : Number(value.limit);
    if (!Number.isSafeInteger(cursor) || cursor < 0)
        throw new RangeError('tree-page cursor is invalid');
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
        throw new RangeError('tree-page limit must be between 1 and 1000');
    }
    return { cursor, limit };
}
function elementInput(input) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('element-get requires an object input');
    }
    const value = input;
    if (typeof value.id !== 'string' || value.id.length === 0) {
        throw new TypeError('element-get requires a non-empty id');
    }
    if (value.library !== undefined && typeof value.library !== 'string') {
        throw new TypeError('element-get library must be a string');
    }
    if (value.type !== undefined && typeof value.type !== 'string') {
        throw new TypeError('element-get type must be a string');
    }
    return value;
}
function treeOf(index, name) {
    const sourceLibraries = index.libraries.length === 0
        ? [{ syntax: 'Library', id: 'Map' }]
        : index.libraries;
    return createTreeDataSource({
        kind: 'trigger-data',
        label: name,
        preview: `${index.elements.length} elements in ${sourceLibraries.length} libraries`,
        children: sourceLibraries.map(library => ({
            kind: library.syntax === 'Standard' ? 'standard-library' : 'trigger-library',
            label: library.id,
            semanticPath: Object.freeze(['libraries', library.id]),
            children: index.elements
                .filter(element => index.libraries.length === 0 || element.library === library.id)
                .map(element => ({
                kind: element.type,
                label: element.identifier?.value ?? element.id,
                preview: element.identifier === undefined ? undefined : element.id,
                semanticPath: Object.freeze(['libraries', library.id, element.type, element.id]),
            })),
        })),
    });
}
function treeEditBounds(budget) {
    return {
        maxChars: budget.maxScalarBytes,
        maxDepth: budget.maxDepth,
        maxNodes: budget.maxNodes,
        maxDiagnostics: budget.maxDiagnostics,
    };
}
const definition = Object.freeze({
    id: ID,
    format: Object.freeze({
        id: 'sc2-triggers',
        label: 'StarCraft II Trigger XML',
        mediaType: 'application/xml',
    }),
    operations,
    async detect(prefix, uri) {
        const result = detectTriggerBytes(prefix, { uri });
        const evidence = result.evidence.find(item => item.kind === 'structure' && item.weight > 0)
            ?? result.evidence.at(-1);
        return {
            confidence: result.confidence,
            kind: evidence?.kind ?? 'structure',
            note: evidence?.note ?? 'trigger-data-root-missing',
        };
    },
    async inspect(bytes, context) {
        const text = textOf(bytes, context.budget);
        const name = sourceName(context.primary.source.uri);
        const sourceIndex = scanTriggerSource(text, { sourcePath: name });
        if (sourceIndex.elements.length > context.budget.maxNodes) {
            throw new RangeError('TriggerData exceeds maxNodes budget');
        }
        const libraries = parsePrimaryLibraries(text);
        if (libraries.length === 0)
            throw new TypeError('TriggerData has no semantic library');
        const allowExternalLibraryIds = externalLibraryIds(sourceIndex, libraries);
        const findings = validateLibraryStructure(libraries, { allowExternalLibraryIds });
        const diagnostics = Object.freeze(findings.slice(0, context.budget.maxDiagnostics).map((finding, ordinal) => findingDiagnostic(finding, sourceIndex, ordinal)));
        const symbols = symbolValue(sourceIndex);
        const references = referenceValue(sourceIndex);
        const typeCounts = {};
        for (const element of sourceIndex.elements) {
            typeCounts[element.type] = (typeCounts[element.type] ?? 0) + 1;
        }
        return {
            summary: Object.freeze({
                format: 'sc2-triggers',
                fileName: name,
                bytes: bytes.byteLength,
                libraries: libraries.map(library => library.id),
                elements: sourceIndex.elements.length,
                references: references.length,
                scripts: sourceIndex.scripts.length,
                gameLinks: sourceIndex.gameLinks.length,
                findings: findings.length,
                typeCounts: Object.freeze(typeCounts),
            }),
            metadata: [Object.freeze({
                    id: 'trigger-data',
                    label: 'TriggerData',
                    entries: Object.freeze([
                        { key: 'fileName', value: name },
                        { key: 'libraries', value: libraries.map(library => library.id) },
                        { key: 'elements', value: sourceIndex.elements.length },
                        { key: 'references', value: references.length },
                        { key: 'scripts', value: sourceIndex.scripts.length },
                        { key: 'gameLinks', value: sourceIndex.gameLinks.length },
                    ]),
                })],
            traits: Object.freeze([
                Object.freeze({ id: 'content.text', parameters: { language: 'xml', encoding: 'utf-8' } }),
                Object.freeze({ id: 'code.source', parameters: { language: 'sc2-triggers', authority: 'native' } }),
                Object.freeze({ id: 'structure.hierarchy', parameters: { kind: 'trigger-elements' } }),
                ...(sourceIndex.scripts.length === 0
                    ? []
                    : [Object.freeze({ id: 'content.scripts', parameters: { blocks: sourceIndex.scripts.length } })]),
            ]),
            text,
            dataSources: {
                'common.view/tree-data-source': treeOf(sourceIndex, name),
                /*
                 * The elements as a table, which is the shape a reader wants when the question is "what is
                 * in this library" rather than "how does this one trigger nest". `complete` earns a column
                 * because an incomplete declaration is a mid-edit artefact the tree shows as an ordinary
                 * node, and it is the first thing to check when something does not compile.
                 */
                'common.view/table-data-source': createTableDataSource({
                    header: ['Library', 'Type', 'Id', 'Identifier', 'Complete'],
                    rows: sourceIndex.elements.map(element => [
                        element.library ?? '',
                        element.type,
                        element.id,
                        element.identifier?.value ?? '',
                        element.complete ? 'yes' : 'no',
                    ]),
                }),
                /*
                 * The card for a trigger library. Its shape is the interesting part — which libraries it
                 * declares, how many elements and how much of it is hand-written Galaxy rather than
                 * generated — and its game links, which are the references that break when the data they
                 * name is renamed elsewhere.
                 */
                'common.view/subject-facts-source': createSubjectFactsSource({
                    snapshotId: String(context.input.revisions.revision),
                    subjectId: context.primary.source.id,
                    label: name,
                    kind: 'sc2-trigger-library',
                    type: 'StarCraft II trigger data',
                    source: context.primary.source,
                    groups: [
                        {
                            id: 'identity',
                            label: 'Trigger data',
                            facts: [
                                fact(context.primary.source, 'libraries', 'Libraries', libraries.map(library => library.id)),
                                fact(context.primary.source, 'elements', 'Elements', sourceIndex.elements.length),
                            ],
                        },
                        {
                            id: 'references',
                            label: 'References',
                            facts: [
                                fact(context.primary.source, 'references', 'Internal references', references.length),
                                fact(context.primary.source, 'game-links', 'Game links', sourceIndex.gameLinks.length),
                            ],
                        },
                        {
                            id: 'scripts',
                            label: 'Custom script',
                            facts: [
                                fact(context.primary.source, 'scripts', 'Script blocks', sourceIndex.scripts.length),
                            ],
                        },
                    ],
                }),
            },
            diagnostics,
            unsupportedFeatures: Object.freeze([
                'installed Trigger library discovery must be supplied by the host as explicit dependencies',
                'runtime execution is owned by the separately permissioned sc2-runtime codec',
                'cross-document reference and Root ordering repair for structural edits remains deferred',
            ]),
            handlers: {
                symbols: async () => ({ kind: 'json', value: symbols }),
                references: async () => ({ kind: 'json', value: references }),
                validate: async (input) => {
                    const dependencies = parseDependencies(input);
                    const values = validateLibraryStructure(libraries, { dependencyLibraries: dependencies, allowExternalLibraryIds });
                    return {
                        kind: 'json',
                        value: Object.freeze(values.slice(0, context.budget.maxDiagnostics).map((finding, ordinal) => findingDiagnostic(finding, sourceIndex, ordinal))),
                    };
                },
                search: async (input) => ({ kind: 'json', value: searchValue(sourceIndex, input) }),
                compare: async (input, options) => {
                    const forward = await convertTriggersToGalaxy(text, input, options.signal);
                    const reverse = await convertGalaxyToTriggers({
                        ...(input === null || typeof input !== 'object' || Array.isArray(input) ? {} : input),
                        libraryId: forward.output.libraryId,
                        script: forward.output.script,
                        header: forward.output.header,
                    }, options.signal);
                    return {
                        kind: 'json',
                        value: Object.freeze({
                            sourceLibraryId: forward.output.libraryId,
                            generatedTriggerDataReparsed: reverse.fidelity.verification.generatedTriggerDataReparsed,
                            elementCountExact: reverse.fidelity.verification.elementCountExact,
                            typeCountsExact: reverse.fidelity.verification.typeCountsExact,
                            galaxyScriptCanonicalExact: reverse.fidelity.verification.galaxyScriptCanonicalExact,
                            galaxyHeaderCanonicalExact: reverse.fidelity.verification.galaxyHeaderCanonicalExact,
                            forwardDigest: forward.digest,
                            reverseDigest: reverse.digest,
                        }),
                    };
                },
                'tree-page': async (input) => {
                    const { cursor, limit } = pageInput(input);
                    const selected = sourceIndex.elements.slice(cursor, cursor + limit);
                    return {
                        kind: 'json',
                        value: Object.freeze({
                            items: symbolValue({ ...sourceIndex, elements: selected }),
                            nextCursor: cursor + selected.length < sourceIndex.elements.length
                                ? String(cursor + selected.length)
                                : null,
                            total: sourceIndex.elements.length,
                        }),
                    };
                },
                'element-get': async (input, options) => {
                    const query = elementInput(input);
                    const found = sourceIndex.elements.find(element => element.id === query.id &&
                        (query.library === undefined || element.library === query.library) &&
                        (query.type === undefined || element.type === query.type));
                    return {
                        kind: 'json',
                        value: found === undefined ? null : Object.freeze({
                            ...symbolValue({ ...sourceIndex, elements: [found] })[0],
                            ...(await getTriggerTreeElement(text, query, treeEditBounds(context.budget), options.signal)),
                        }),
                    };
                },
                'parameter-update': async (input, options) => {
                    const result = await editTriggerTree(text, { ...input, action: 'parameter-update' }, treeEditBounds(context.budget), options.signal);
                    return {
                        kind: 'edit-plan',
                        plan: editPlanFromInput(context.input, {
                            planId: `${ID}:${context.input.revisions.revision}:parameter-update:${result.element.id}`,
                            edits: [replaceBytes(0, bytes.byteLength, encoder.encode(result.xml), `update ${result.element.type}/${result.element.id} parameter value`)],
                            fidelity: { roundTrip: 'byte-identical', preservesUnknownData: true, notes: ['Only the selected Value text is replaced; XML markup and all other source bytes are preserved.'] },
                        }),
                    };
                },
                'element-insert': async (input, options) => {
                    const result = await editTriggerTree(text, { ...input, action: 'element-insert' }, treeEditBounds(context.budget), options.signal);
                    return {
                        kind: 'edit-plan',
                        plan: editPlanFromInput(context.input, {
                            planId: `${ID}:${context.input.revisions.revision}:element-insert:${result.element.id}`,
                            edits: [replaceBytes(0, bytes.byteLength, encoder.encode(result.xml), `insert ${result.element.type}/${result.element.id}`)],
                            fidelity: { roundTrip: 'semantic', preservesUnknownData: true, notes: ['The validated Element fragment is inserted without reparsing or serializing surrounding TriggerData.'] },
                        }),
                    };
                },
                'element-move': async (input, options) => {
                    const result = await editTriggerTree(text, { ...input, action: 'element-move' }, treeEditBounds(context.budget), options.signal);
                    return {
                        kind: 'edit-plan',
                        plan: editPlanFromInput(context.input, {
                            planId: `${ID}:${context.input.revisions.revision}:element-move:${result.element.id}`,
                            edits: [replaceBytes(0, bytes.byteLength, encoder.encode(result.xml), `move ${result.element.type}/${result.element.id}`)],
                            fidelity: { roundTrip: 'semantic', preservesUnknownData: true, notes: ['The complete Element source slice is moved and reindented for its target library.'] },
                        }),
                    };
                },
                'element-delete': async (input, options) => {
                    const result = await editTriggerTree(text, { ...input, action: 'element-delete' }, treeEditBounds(context.budget), options.signal);
                    return {
                        kind: 'edit-plan',
                        plan: editPlanFromInput(context.input, {
                            planId: `${ID}:${context.input.revisions.revision}:element-delete:${result.element.id}`,
                            edits: [replaceBytes(0, bytes.byteLength, encoder.encode(result.xml), `delete ${result.element.type}/${result.element.id}`)],
                            fidelity: { roundTrip: 'semantic', preservesUnknownData: true, notes: ['Only the selected complete Element source range and its otherwise-empty line are removed.'] },
                        }),
                    };
                },
                'rename-gamelinks': async (input) => {
                    const result = prepareTriggerGamelinkRename(text, sourceIndex.scripts.length, input);
                    const output = encoder.encode(result.xml);
                    const blocked = result.diagnostics.some(item => item.severity === 'error');
                    return {
                        kind: 'edit-plan',
                        plan: editPlanFromInput(context.input, {
                            planId: `${ID}:${context.input.revisions.revision}:gamelinks:${result.patched}`,
                            // The host rejects empty edit plans. A valid no-op is therefore represented by an
                            // explicit byte-identical replacement; an invalid/conflicting request remains empty
                            // and is rejected before commit because its plan contains an error diagnostic.
                            edits: blocked
                                ? []
                                : [replaceBytes(0, bytes.byteLength, output, `rename ${result.patched} TriggerData gamelink value(s)`)],
                            fidelity: {
                                roundTrip: 'byte-identical',
                                preservesUnknownData: true,
                                notes: [`Rewrote ${result.patched} exact typed value(s); all other source bytes are preserved.`],
                            },
                            diagnostics: result.diagnostics,
                        }),
                    };
                },
                'export-convert': async (input, options) => {
                    const result = await convertTriggersToGalaxy(text, input, options.signal);
                    const part = input?.part;
                    const output = part === 'header'
                        ? result.output.header
                        : part === 'script'
                            ? result.output.script
                            : `${result.output.header}\n${result.output.script}`;
                    return { kind: 'bytes', value: encoder.encode(output) };
                },
                'to-engine': async (input) => {
                    const dependencies = parseDependencies(input);
                    const program = triggerLibrariesToEngineProgram(libraries, {
                        fileName: name,
                        nativeLibraries: dependencies,
                        includeRawFallbacks: input?.includeRawFallbacks !== false,
                    });
                    return { kind: 'json', value: Object.freeze({ program }) };
                },
                'export-raw': async () => ({ kind: 'bytes', value: bytes.slice() }),
                'trigger-to-galaxy': async (input, options) => ({
                    kind: 'json',
                    value: await convertTriggersToGalaxy(text, input, options.signal),
                }),
                'galaxy-to-triggers': async (input, options) => ({
                    kind: 'json',
                    value: await convertGalaxyToTriggers(input, options.signal),
                }),
            },
        };
    },
});
export const abiVersion = 1;
export const createCodec = (context) => createInspectionCodec(definition, context);

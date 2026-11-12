import { convertGalaxyToTriggerLibrary, parseGalaxySource, resetGalaxyToTriggerIdCounter, } from './internal/galaxy-to-trigger.js';
import { parseTriggerXmlSync, readTriggerLibrariesFast, } from '@modkit/blizzard-starcraft2/triggers/document/sax-reader.js';
import { convertTriggerLibraryToGalaxyFull } from './internal/trigger-to-galaxy.js';
import { triggerConverterProvenance } from './converter-entry.js';
import { normalizeTriggerLibrary, serializeTriggerLibrary, triggerLibraryTypeCounts, } from '../../shared/trigger-document/trigger-xml.js';
import { validateGalaxyPair } from './validation.js';
import { Printer, SyntaxKind, getKindName, isKeywordTypeKind, tokenToString } from '@modkit/blizzard-starcraft2/galaxy/language-core';
import { functionFlags, assertConversionReferences, sanitizeIdentifier, lowerInitial, startupFunctionName, withImplicitLibrary } from './internal/conversion-model.js';
import { parseTriggerStrings, applyTriggerStringsByType } from '@modkit/blizzard-starcraft2/triggers/document/trigger-strings.js';
import { preservedInitializationRoot } from './internal/g2t-initialization.js';
import { mapParameterTypeToGalaxy, toGalaxyFunctionName } from './internal/ttg-core.js';
import { isInlineTemplate } from './internal/ttg-template.js';
// A hand-written Galaxy file expands into far more XML than it occupies itself:
// every expression becomes an element with an identity. Sizing the default from
// the input would refuse authored work rather than protect against it.
const DEFAULT_MAX_OUTPUT_BYTES = 512 * 1024 * 1024;
const HARD_MAX_OUTPUT_BYTES = 1024 * 1024 * 1024;
// Real SC2 Trigger documents run past 70 MiB, so a smaller default would refuse
// authored input rather than protect against it. The default leaves room well
// past anything observed; the ceiling below is what a caller may raise it to.
const MAX_PRIMARY_BYTES = 512 * 1024 * 1024;
const MAX_DEPENDENCY_BYTES = 512 * 1024 * 1024;
// Multi-library SC2Mods can legitimately contain dozens of local libraries;
// each sibling library is a distinct dependency document while one body is
// reconstructed. The aggregate byte budget remains the primary memory bound.
const MAX_DEPENDENCY_DOCUMENTS = 512;
// The authored COMI library is 92,065 elements and rebuilding it from its script
// gives 113,840; a hand-written map reached 314,599. A bound below those refuses
// documents the game itself ships. Cost scales with the count — 314,599 elements
// held about 2.3 GB — so the ceiling below stays finite.
const MAX_LIBRARY_ELEMENTS = 1_000_000;
const MAX_DIAGNOSTICS = 1_000;
const encoder = new TextEncoder();
const printer = new Printer();
const DEFAULT_LIMITS = Object.freeze({ maxInputBytes: MAX_PRIMARY_BYTES, maxDependencyBytes: MAX_DEPENDENCY_BYTES, maxLibraryElements: MAX_LIBRARY_ELEMENTS, maxTotalElements: 4_000_000 });
const HARD_LIMITS = Object.freeze({ maxInputBytes: 1024 * 1024 * 1024, maxDependencyBytes: 1024 * 1024 * 1024, maxLibraryElements: 4_000_000, maxTotalElements: 16_000_000 });
// One entry per dependency document of the largest real document plus room to spare:
// a 17-library mod evicted every sibling on every pass at 16 (1226 misses, 32 hits, 26 min).
// The source-byte budget below is what actually bounds retention.
const DEFAULT_DEPENDENCY_CACHE_ENTRIES = 64;
const DEFAULT_DEPENDENCY_CACHE_SOURCE_BYTES = 64 * 1024 * 1024;
const conversionContextStates = new WeakMap();
/** A conversion service may reuse immutable parsed dependencies without
 * leaking them into unrelated callers. Source bytes provide a deterministic
 * source-based retention budget; callers can disable it with
 * maxDependencyCacheEntries: 0. Parsed heap size remains engine-dependent. */
export function createTriggerConversionContext(options = {}) {
    record(options, 'conversion context options');
    const maxEntries = options.maxDependencyCacheEntries ?? DEFAULT_DEPENDENCY_CACHE_ENTRIES;
    const maxSourceBytes = options.maxDependencyCacheSourceBytes ?? DEFAULT_DEPENDENCY_CACHE_SOURCE_BYTES;
    if (!Number.isSafeInteger(maxEntries) || maxEntries < 0 || maxEntries > MAX_DEPENDENCY_DOCUMENTS) {
        throw new RangeError(`maxDependencyCacheEntries must be between 0 and ${MAX_DEPENDENCY_DOCUMENTS}`);
    }
    if (!Number.isSafeInteger(maxSourceBytes) || maxSourceBytes < 0 || maxSourceBytes > HARD_MAX_OUTPUT_BYTES) {
        throw new RangeError(`maxDependencyCacheSourceBytes must be between 0 and ${HARD_MAX_OUTPUT_BYTES}`);
    }
    const state = {
        entries: new Map(), sourceBytes: 0, maxEntries, maxSourceBytes,
        hits: 0, misses: 0, stores: 0, evictions: 0,
    };
    const context = Object.freeze({
        clear() {
            state.entries.clear();
            state.sourceBytes = 0;
        },
        stats() {
            return Object.freeze({
                entries: state.entries.size, sourceBytes: state.sourceBytes,
                hits: state.hits, misses: state.misses, stores: state.stores, evictions: state.evictions,
            });
        },
    });
    conversionContextStates.set(context, state);
    return context;
}
function conversionContextState(input) {
    if (input.conversionContext === undefined)
        return undefined;
    const state = conversionContextStates.get(input.conversionContext);
    if (!state)
        throw new TypeError('conversionContext must be created by createTriggerConversionContext');
    return state;
}
function conversionLimits(input) {
    const requested = input.limits === undefined ? {} : record(input.limits, 'limits');
    const limits = { ...DEFAULT_LIMITS };
    for (const [key, value] of Object.entries(requested)) {
        if (!Object.hasOwn(HARD_LIMITS, key) || !Number.isSafeInteger(value) || value < 1 || value > HARD_LIMITS[key])
            throw new RangeError(`Invalid conversion limit ${key}`);
        limits[key] = value;
    }
    return limits;
}
const KNOWN_ELEMENT_TYPES = new Set([
    'Comment',
    'CustomScript',
    'Category',
    'FunctionCall',
    'FunctionDef',
    'Label',
    'Param',
    'ParamDef',
    'Preset',
    'PresetValue',
    'Structure',
    'SubFuncType',
    'Trigger',
    'Variable',
]);
const EDITOR_ONLY_TYPES = new Set(['Category', 'Label', 'Comment']);
function throwIfAborted(signal) {
    if (!signal?.aborted)
        return;
    throw new DOMException('operation cancelled', 'AbortError');
}
async function checkpoint(signal) {
    throwIfAborted(signal);
    await new Promise(resolve => setTimeout(resolve, 0));
    throwIfAborted(signal);
}
function record(value, label) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`${label} requires an object input`);
    }
    return value;
}
function progressReporter(input, operation) {
    if (input.onProgress !== undefined && typeof input.onProgress !== 'function') {
        throw new TypeError('onProgress must be a function');
    }
    const callback = input.onProgress;
    let sequence = 0;
    return event => {
        if (!callback)
            return;
        const completed = Number.isFinite(event.completed) ? event.completed : 0;
        const total = Number.isFinite(event.total) ? event.total : 0;
        const progress = Object.freeze({
            operation,
            sequence: sequence++,
            phase: event.phase,
            ...(event.stage ? { stage: event.stage } : {}),
            completed,
            total,
            ratio: total > 0 ? Math.max(0, Math.min(1, completed / total)) : undefined,
            ...(Number.isFinite(event.elements) ? { elements: event.elements } : {}),
        });
        // Telemetry must not alter conversion semantics. AbortSignal remains the
        // explicit cancellation channel.
        try {
            callback(progress);
        }
        catch { }
    };
}
function boundedString(value, label, maximum, required = false) {
    if (value === undefined && !required)
        return undefined;
    if (typeof value !== 'string')
        throw new TypeError(`${label} must be a string`);
    if (encoder.encode(value).byteLength > maximum) {
        throw new RangeError(`${label} exceeds ${maximum} UTF-8 bytes`);
    }
    return value;
}
function outputBound(input) {
    if (input.maxOutputBytes === undefined)
        return DEFAULT_MAX_OUTPUT_BYTES;
    if (!Number.isSafeInteger(input.maxOutputBytes) ||
        input.maxOutputBytes < 1 ||
        input.maxOutputBytes > HARD_MAX_OUTPUT_BYTES) {
        throw new RangeError(`maxOutputBytes must be between 1 and ${HARD_MAX_OUTPUT_BYTES}`);
    }
    return input.maxOutputBytes;
}
function generationOptions(input) {
    if (input.initialization !== undefined && !['library', 'preserve'].includes(input.initialization))
        throw new TypeError('initialization must be library or preserve');
    if (input.entryPoint !== undefined && (typeof input.entryPoint !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/u.test(input.entryPoint)))
        throw new TypeError('entryPoint must be a Galaxy identifier');
    if (input.entryPoint !== undefined && input.initialization === 'library')
        throw new TypeError('entryPoint conflicts with generated library initialization');
    return { ...(input.initialization ? { initialization: input.initialization } : {}), ...(input.entryPoint ? { entryPoint: input.entryPoint } : {}) };
}
function reverseVerification(input) {
    const verification = input.verification ?? 'full';
    if (!['full', 'semantic'].includes(verification))
        throw new TypeError('verification must be full or semantic');
    return verification;
}
function galaxyDeclarations(input) {
    if (input.strictSymbols !== undefined && typeof input.strictSymbols !== 'boolean')
        throw new TypeError('strictSymbols must be a boolean');
    const files = input.galaxyDeclarations ?? [];
    if (!Array.isArray(files) || files.length > MAX_DEPENDENCY_DOCUMENTS)
        throw new TypeError('galaxyDeclarations must be a bounded array');
    let bytes = 0;
    return files.map((item, i) => {
        record(item, `galaxyDeclarations[${i}]`);
        const fileName = boundedString(item.fileName, 'declaration fileName', 1024, true);
        const text = boundedString(item.text, 'declaration text', MAX_DEPENDENCY_BYTES, true);
        bytes += encoder.encode(text).byteLength;
        if (bytes > MAX_DEPENDENCY_BYTES)
            throw new RangeError('Galaxy declarations exceed the dependency byte bound');
        return { fileName, text };
    });
}
function validateGalaxyOutput(output, libraryId, declarations, strictSymbols, prefix = 'Lib') {
    try {
        return validateGalaxyPair([
            { fileName: `${prefix}${libraryId}_h.galaxy`, text: output.header },
            { fileName: `${prefix}${libraryId}.galaxy`, text: output.script },
        ], declarations, strictSymbols);
    }
    catch (error) {
        return { declaredSymbols: [], diagnostics: [diagnostic('sc2-triggers/galaxy-validation-failed', 'error', `Galaxy validation did not finish: ${String(error)}`)],
            verification: { status: 'failed', errors: 1, unresolvedSymbols: [], uncheckedTypes: 0, diagnosticsOmitted: 0, declarationFiles: declarations.map(file => file.fileName), validationCompleted: false } };
    }
}
function modelDeclarations(libraries, primaryId, supplied = []) {
    const signatures = new Map();
    const explicit = new Set(supplied.flatMap(file => [...parseGalaxySource(file.text).statements].filter(node => node.kind === 142 /* SyntaxKind.FunctionDeclaration */).map(node => node.name.name)));
    const primitives = new Set(Object.values(SyntaxKind).filter(kind => typeof kind === 'number' && isKeywordTypeKind(kind)).map(kind => tokenToString(kind)));
    for (const library of libraries.values()) {
        if (library.id === primaryId)
            continue;
        const context = { libId: library.id, library, allLibraries: libraries, functionNameGroups: new Map() };
        for (const definition of Object.values(library.elements)) {
            if (definition.type !== 'FunctionDef' || definition.disabled || !definition.name || isInlineTemplate(definition) || definition.flags?.includes('CustomScript'))
                continue;
            const formals = (definition.parameters ?? []).map(ref => {
                const owner = libraries.get(ref.library ?? library.id);
                return owner?.elementsByType?.ParamDef?.[ref.id];
            });
            // A GUI action can discard a native return value; absence is not proof of void.
            const result = definition.returnType ?? (definition.flags?.includes('Native') ? undefined : { type: definition.isFuncCall ? 'any' : 'void' });
            if (formals.some(formal => !formal) || [result, ...formals.map(formal => formal.paramType)].some(type => !type || /^(any|sameas)/u.test(type.type)))
                continue;
            const name = toGalaxyFunctionName(definition, context);
            if (explicit.has(name))
                continue;
            const type = item => mapParameterTypeToGalaxy(item, library, undefined, libraries);
            if (![result, ...formals.map(formal => formal.paramType)].every(item => primitives.has(type(item))))
                continue;
            const parameters = [...(definition.flags?.includes('Event') ? ['trigger eventTarget'] : []), ...formals.map((formal, index) => `${type(formal.paramType)} arg${index}`)];
            signatures.set(name, `${type(result)} ${name}(${parameters.join(', ')});`);
        }
    }
    return signatures.size ? [{ fileName: 'trigger-model-declarations.galaxy', text: [...signatures.values()].join('\n') }] : [];
}
function canonicalJson(value) {
    if (Array.isArray(value))
        return `[${value.map(canonicalJson).join(',')}]`;
    if (value !== null && typeof value === 'object') {
        return `{${Object.keys(value)
            .filter(key => value[key] !== undefined)
            .sort()
            .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
            .join(',')}}`;
    }
    return JSON.stringify(value);
}
const CANONICAL_STRING_CHUNK_UNITS = 64 * 1024;
function* canonicalJsonStringChunks(value) {
    yield '"';
    for (let offset = 0; offset < value.length;) {
        let end = Math.min(value.length, offset + CANONICAL_STRING_CHUNK_UNITS);
        // JSON.stringify emits a surrogate pair as one Unicode scalar. Splitting
        // between its UTF-16 units would instead encode two lone surrogates and
        // change the digest, so move that boundary by one code unit.
        if (end < value.length) {
            const previous = value.charCodeAt(end - 1);
            const next = value.charCodeAt(end);
            if (previous >= 0xD800 && previous <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF)
                end++;
        }
        const encoded = JSON.stringify(value.slice(offset, end));
        yield encoded.slice(1, -1);
        offset = end;
    }
    yield '"';
}
function* canonicalJsonChunks(value) {
    if (Array.isArray(value)) {
        yield '[';
        for (let index = 0; index < value.length; index++) {
            if (index > 0)
                yield ',';
            yield* canonicalJsonChunks(value[index]);
        }
        yield ']';
        return;
    }
    if (value !== null && typeof value === 'object') {
        yield '{';
        const keys = Object.keys(value).filter(key => value[key] !== undefined).sort();
        for (let index = 0; index < keys.length; index++) {
            if (index > 0)
                yield ',';
            const key = keys[index];
            yield* canonicalJsonStringChunks(key);
            yield ':';
            yield* canonicalJsonChunks(value[key]);
        }
        yield '}';
        return;
    }
    if (typeof value === 'string') {
        yield* canonicalJsonStringChunks(value);
        return;
    }
    yield JSON.stringify(value);
}
async function digest(value, maximum) {
    // Node's incremental hash avoids retaining one canonical JSON string and a
    // second complete UTF-8 buffer. Count the very same stream so enforcing the
    // output bound does not require another complete traversal.
    if (globalThis.process?.versions?.node) {
        const [{ createHash }, { Buffer }] = await Promise.all([import('node:crypto'), import('node:buffer')]);
        const hash = createHash('sha256');
        let bytes = 0;
        for (const chunk of canonicalJsonChunks(value)) {
            bytes += Buffer.byteLength(chunk, 'utf8');
            if (maximum !== undefined && bytes > maximum)
                throw new RangeError(`conversion output exceeds ${maximum} UTF-8 bytes`);
            hash.update(chunk, 'utf8');
        }
        return { algorithm: 'sha-256', value: hash.digest('hex') };
    }
    if (maximum !== undefined)
        ensureOutputBound(value, maximum);
    const bytes = encoder.encode(canonicalJson(value));
    const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return {
        algorithm: 'sha-256',
        value: [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join(''),
    };
}
function diagnostic(code, severity, message, details = undefined) {
    return {
        code,
        severity,
        message,
        ...(details === undefined ? {} : { details }),
    };
}
function limitedDiagnostics(items) {
    if (items.length <= MAX_DIAGNOSTICS)
        return items;
    return [
        ...items.slice(0, MAX_DIAGNOSTICS - 1),
        diagnostic('sc2-triggers/diagnostics-truncated', 'warning', `${items.length - MAX_DIAGNOSTICS + 1} additional diagnostics were omitted`),
    ];
}
function disposition(items) {
    return { count: items.reduce((total, item) => total + item.count, 0), items };
}
function groupedElements(library, predicate, reason) {
    const counts = new Map();
    for (const element of Object.values(library.elements ?? {})) {
        const type = String(element?.type ?? 'Unknown');
        if (!predicate(type))
            continue;
        counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return [...counts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([type, count]) => ({ kind: 'element-type', type, count, reason }));
}
function authoredElementTypeCounts(xml) {
    const counts = new Map();
    for (const match of xml.matchAll(/<Element\b([^>]*)>/gu)) {
        const type = /\bType="([^"]+)"/u.exec(match[1])?.[1] ?? 'Unknown';
        counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return counts;
}
// A map keeps its trigger content directly under <TriggerData>, with no
// <Library> declaration and no Library attribute on references into itself; a
// mod declares one. The reader wants a library either way, so a map document
// gets a synthesized one -- and every library so synthesized is marked
// `implicit`, because the serializer has to reproduce the document it read.
function parsePrimaryDocument(xml, libraryId = 'Map') {
    if (typeof libraryId !== 'string' || !/^[A-Za-z0-9_]+$/u.test(libraryId))
        throw new TypeError('libraryId must be an ASCII identifier');
    const parsed = parseTriggerXmlSync(xml);
    if (parsed.size > 0)
        return parsed;
    const root = /<TriggerData(?:\s[^>]*)?>/u.exec(xml);
    if (root === null)
        return parsed;
    const offset = root.index + root[0].length;
    const synthesized = parseTriggerXmlSync(`${xml.slice(0, offset)}<Standard Id="${libraryId}"/>${xml.slice(offset)}`);
    for (const library of synthesized.values())
        library.implicit = true;
    return synthesized;
}
// The document kind is a property of the container the scripts came from, not
// of their text: a map carries MapScript.galaxy at its root, a mod carries
// Base.SC2Data/Lib<Id>.galaxy. Callers that know the container say so; callers
// that do not get the library shape, which is what mods use.
function documentIsImplicit(input) {
    const kind = input.documentKind;
    if (kind === undefined)
        return false;
    if (kind !== 'map' && kind !== 'library')
        throw new TypeError("documentKind must be 'map' or 'library'");
    return kind === 'map';
}
function validateLibraries(libraries, limits = DEFAULT_LIMITS) {
    if (libraries.size === 0)
        throw new TypeError('TriggerData contains no semantic libraries');
    let elements = 0;
    for (const [libraryId, result] of libraries) {
        const count = Object.keys(result.library.elements ?? {}).length;
        elements += count;
        if (count > limits.maxLibraryElements)
            throw new RangeError(`Trigger library ${libraryId} exceeds maxLibraryElements (${count} > ${limits.maxLibraryElements})`);
        if (elements > limits.maxTotalElements)
            throw new RangeError(`Trigger semantic model exceeds maxTotalElements (${elements} > ${limits.maxTotalElements})`);
        if (libraryId !== result.library.id)
            throw new TypeError('Trigger library identity mismatch');
    }
}
function dependencyDocuments(input) {
    const limits = conversionLimits(input);
    const dependencies = input.dependencyLibraries ?? [];
    if (!Array.isArray(dependencies) || dependencies.length > MAX_DEPENDENCY_DOCUMENTS) {
        throw new RangeError(`dependencyLibraries is limited to ${MAX_DEPENDENCY_DOCUMENTS} items`);
    }
    let bytes = 0;
    return dependencies.map((item, index) => {
        const dependency = record(item, `dependencyLibraries[${index}]`);
        const xml = boundedString(dependency.triggerData, `dependencyLibraries[${index}].triggerData`, limits.maxDependencyBytes, true);
        const triggerStrings = boundedString(dependency.triggerStrings, `dependencyLibraries[${index}].triggerStrings`, limits.maxDependencyBytes);
        const gameStrings = boundedString(dependency.gameStrings, `dependencyLibraries[${index}].gameStrings`, limits.maxDependencyBytes);
        const sourceBytes = encoder.encode(xml).byteLength + encoder.encode(triggerStrings ?? '').byteLength + encoder.encode(gameStrings ?? '').byteLength;
        bytes += sourceBytes;
        if (bytes > limits.maxDependencyBytes) {
            throw new RangeError('dependencyLibraries exceeds the aggregate byte bound');
        }
        return { xml, triggerStrings: [triggerStrings, gameStrings].filter(value => value !== undefined).join('\n') || undefined, sourceBytes };
    });
}
const LIBRARY_LAYER_POLICIES = new Set(['strict', 'first-document-wins']);
/** How two documents that declare the same library id are combined.
 * `strict` refuses; `first-document-wins` keeps the earlier document's library
 * whole. Element-wise merging is deliberately absent — see the note on
 * `layerDifference`. */
function libraryLayerPolicy(input) {
    const policy = input?.libraryLayers ?? 'strict';
    if (!LIBRARY_LAYER_POLICIES.has(policy)) {
        throw new TypeError(`libraryLayers must be one of ${[...LIBRARY_LAYER_POLICIES].join(', ')}`);
    }
    return policy;
}
/** Editor output shows a library belonging to exactly one document: each
 * document emits its own Lib<Id>.galaxy, and the higher-priority document's
 * file replaces the other wholesale — dependent documents were observed
 * lacking functions their dependency declares. So a layer is never merged
 * element by element, and an element the winner omits is not a deletion of a
 * shared element; it is simply not part of that library. This summary exists to
 * report what the loser held, not to combine the two. */
function layerDifference(previous, next) {
    const typed = library => new Map(Object.values(library.elementsByType).flatMap(group => Object.values(group)).map(element => [`${element.type}:${element.id}`, element]));
    const left = typed(previous.library), right = typed(next.library);
    const changed = [...right].filter(([key, value]) => left.has(key) && canonicalJson(left.get(key)) !== canonicalJson(value)).map(([key]) => key);
    const roots = library => canonicalJson(library.rootRefs ?? library.items.map(item => ({ type: item.type, id: item.id })));
    return {
        changedElements: changed.length,
        addedElements: [...right.keys()].filter(key => !left.has(key)).length,
        omittedElements: [...left.keys()].filter(key => !right.has(key)).length,
        changedSample: changed.slice(0, 16),
        rootsChanged: roots(previous.library) !== roots(next.library),
    };
}
/** Identical shared libraries are harmless; conflicting layers need explicit resolution.
 * Compare localized semantic models, never document whitespace or bare element IDs.
 */
async function dependencyDocumentCacheKey(document) {
    return (await digest(['sc2-trigger-dependency-v1', document.xml, document.triggerStrings ?? ''])).value;
}
// Presentation is bounded, verification is not.  An error after the display
// cap must still prevent a fidelity claim even if its individual diagnostic is
// no longer present in the UI slice.
function hasError(items) {
    return items.some(item => item.severity === 'error');
}
function validationFailed(verification) {
    return verification?.status === 'failed' || (verification?.errors ?? 0) > 0;
}
function retainDependencyDocument(state, key, loaded, sourceBytes) {
    if (state.maxEntries === 0 || sourceBytes > state.maxSourceBytes)
        return;
    while (state.entries.size >= state.maxEntries || state.sourceBytes + sourceBytes > state.maxSourceBytes) {
        const oldest = state.entries.keys().next().value;
        if (oldest === undefined)
            break;
        const removed = state.entries.get(oldest);
        state.entries.delete(oldest);
        state.sourceBytes -= removed.sourceBytes;
        state.evictions++;
    }
    if (sourceBytes > state.maxSourceBytes)
        return;
    state.entries.set(key, { loaded, sourceBytes });
    state.sourceBytes += sourceBytes;
    state.stores++;
}
async function loadSemanticDocument(document, signal, contextState) {
    if (document.parsed !== undefined) {
        const strings = new Map(document.triggerStrings === undefined ? [] : [...document.parsed.keys()].map(id => [id, document.triggerStrings]));
        return readTriggerLibrariesFast([document.parsed], strings);
    }
    if (!contextState || contextState.maxEntries === 0 || contextState.maxSourceBytes === 0) {
        const parsed = parseTriggerXmlSync(document.xml);
        const strings = new Map(document.triggerStrings === undefined ? [] : [...parsed.keys()].map(id => [id, document.triggerStrings]));
        return readTriggerLibrariesFast([parsed], strings);
    }
    await checkpoint(signal);
    const key = await dependencyDocumentCacheKey(document);
    const cached = contextState.entries.get(key);
    if (cached) {
        contextState.entries.delete(key);
        contextState.entries.set(key, cached);
        contextState.hits++;
        return cached.loaded;
    }
    contextState.misses++;
    const parsed = parseTriggerXmlSync(document.xml);
    const strings = new Map(document.triggerStrings === undefined ? [] : [...parsed.keys()].map(id => [id, document.triggerStrings]));
    const loaded = await readTriggerLibrariesFast([parsed], strings);
    const sourceBytes = document.sourceBytes ?? encoder.encode(document.xml).byteLength + encoder.encode(document.triggerStrings ?? '').byteLength;
    retainDependencyDocument(contextState, key, loaded, sourceBytes);
    return loaded;
}
async function loadSemanticDocuments(documents, signal, limits, policy = 'strict', contextState) {
    const results = new Map();
    const origins = new Map();
    const layers = [];
    for (const [index, document] of documents.entries()) {
        await checkpoint(signal);
        const loaded = await loadSemanticDocument(document, signal, contextState);
        if (loaded.size === 0)
            throw new TypeError(`Trigger document ${index} has no library`);
        for (const [id, result] of loaded) {
            const previous = results.get(id);
            if (previous) {
                if (canonicalJson(normalizeTriggerLibrary(previous.library)) === canonicalJson(normalizeTriggerLibrary(result.library)))
                    continue;
                const difference = layerDifference(previous, result);
                if (policy === 'first-document-wins') {
                    layers.push({ libraryId: id, keptDocument: origins.get(id), supersededDocument: index, ...difference });
                    continue;
                }
                const error = new TypeError(`Conflicting Trigger library layers ${id} in documents ${origins.get(id)} and ${index}; supply one resolved library`);
                error.context = { conversionCode: 'LIBRARY_LAYER_CONFLICT', libraryId: id, documents: [origins.get(id), index], ...difference };
                throw error;
            }
            results.set(id, result);
            origins.set(id, index);
        }
        validateLibraries(results, limits);
    }
    return { libraries: results, layers };
}
async function semanticLibraries(primaryParsed, input, signal) {
    return loadSemanticDocuments([
        { parsed: primaryParsed, triggerStrings: [input.triggerStrings, input.gameStrings].filter(value => value !== undefined).join('\n') || undefined },
        ...dependencyDocuments(input),
    ], signal, conversionLimits(input), libraryLayerPolicy(input), conversionContextState(input));
}
async function semanticDependencyLibraries(dependencies, signal, limits, policy, contextState) {
    const { libraries, layers } = await loadSemanticDocuments(dependencies, signal, limits, policy, contextState);
    return { libraries: new Map([...libraries].map(([id, result]) => [id, normalizeTriggerLibrary(result.library)])), layers };
}
/** One diagnostic per library whose losing layer was dropped, so a resolved
 * conversion still says which document supplied the library and what the other
 * one held. */
function layerDiagnostics(layers) {
    return layers.map(layer => diagnostic('sc2-triggers/library-layer-superseded', 'warning', `Library ${layer.libraryId} was taken whole from document ${layer.keptDocument}; document ${layer.supersededDocument} declared a different body`, layer));
}
function primaryLibraryId(parsed, requested) {
    if (requested !== undefined) {
        if (typeof requested !== 'string' || !/^[A-Za-z0-9_]+$/u.test(requested)) {
            throw new TypeError('libraryId must be an ASCII identifier');
        }
        if (!parsed.has(requested))
            throw new TypeError(`source TriggerData has no library ${requested}`);
        return requested;
    }
    const first = parsed.keys().next().value;
    if (parsed.size > 1)
        throw new TypeError(`TriggerData contains multiple libraries; supply libraryId explicitly: ${[...parsed.keys()].join(', ')}`);
    if (first === undefined)
        throw new TypeError('source TriggerData has no semantic library');
    return first;
}
function ensureOutputBound(output, maximum) {
    let bytes = 0;
    for (const chunk of canonicalJsonChunks(output)) {
        bytes += encoder.encode(chunk).byteLength;
        if (bytes > maximum)
            throw new RangeError(`conversion output exceeds ${maximum} UTF-8 bytes`);
    }
}
function provenance(direction) {
    return {
        direction,
        sourceCommit: triggerConverterProvenance.commit,
        sourceEntrypoints: triggerConverterProvenance.entrypoints,
        adaptation: 'modkit-blizzard/structured-trigger-galaxy@3',
        galaxyParser: 'modkit-blizzard/galaxy-language/language-core',
    };
}
export async function convertTriggersToGalaxy(primaryText, rawInput, signal) {
    throwIfAborted(signal);
    const input = record(rawInput ?? {}, 'trigger-to-galaxy');
    const generation = generationOptions(input);
    let declarations = galaxyDeclarations(input);
    const maximum = outputBound(input);
    const primary = boundedString(primaryText, 'triggerData', conversionLimits(input).maxInputBytes, true);
    boundedString(input.triggerStrings, 'triggerStrings', MAX_DEPENDENCY_BYTES);
    boundedString(input.gameStrings, 'gameStrings', MAX_DEPENDENCY_BYTES);
    const primaryParsed = parsePrimaryDocument(primary, input.libraryId ?? 'Map');
    const libraryId = primaryLibraryId(primaryParsed, input.libraryId);
    const implicitDocument = primaryParsed.get(libraryId)?.implicit === true;
    const { libraries, layers } = await semanticLibraries(primaryParsed, input, signal);
    const library = libraries.get(libraryId)?.library;
    if (library === undefined)
        throw new TypeError(`semantic library ${libraryId} is unavailable`);
    const allLibraries = new Map([...libraries].map(([id, result]) => [id, result.library]));
    const nativeLibrary = allLibraries.get('Ntve');
    declarations = [...modelDeclarations(allLibraries, libraryId, declarations), ...declarations];
    await checkpoint(signal);
    const output = convertTriggerLibraryToGalaxyFull(library, nativeLibrary, allLibraries, { ...generation, galaxyDeclarations: declarations });
    throwIfAborted(signal);
    const validation = validateGalaxyOutput(output, libraryId, declarations, input.strictSymbols);
    const diagnostics = [...layerDiagnostics(layers), ...validation.diagnostics];
    const rewritten = disposition(groupedElements(library, type => KNOWN_ELEMENT_TYPES.has(type) && !EDITOR_ONLY_TYPES.has(type), 'lowered-to-galaxy'));
    const preserved = disposition(groupedElements(library, type => EDITOR_ONLY_TYPES.has(type), 'editor-layout-preserved-in-galaxy-comments'));
    const dropped = disposition([]);
    const unsupportedItems = groupedElements(library, type => !KNOWN_ELEMENT_TYPES.has(type), 'unknown-trigger-element-type');
    const authoredTypes = authoredElementTypeCounts(primary);
    const semanticTypes = new Map();
    for (const parsedLibrary of primaryParsed.values()) {
        for (const element of Object.values(parsedLibrary.elements ?? {})) {
            const type = String(element?.type ?? 'Unknown');
            semanticTypes.set(type, (semanticTypes.get(type) ?? 0) + 1);
        }
    }
    for (const [type, authoredCount] of [...authoredTypes].sort(([left], [right]) => left.localeCompare(right))) {
        const gap = authoredCount - (semanticTypes.get(type) ?? 0);
        if (gap <= 0)
            continue;
        unsupportedItems.push({
            kind: 'semantic-reader-element-type',
            type,
            count: gap,
            reason: 'element-type-outside-pinned-library-model',
        });
    }
    const valueGameTypeCount = (primary.match(/<ValueGameType\b/gu) ?? []).length;
    if (valueGameTypeCount > 0) {
        unsupportedItems.push({
            kind: 'trigger-xml-field',
            field: 'ValueGameType',
            count: valueGameTypeCount,
            reason: 'field-not-retained-by-pinned-semantic-reader',
        });
    }
    const labelReferenceCount = (primary.match(/<Label\b/gu) ?? []).length;
    if (labelReferenceCount > 0) {
        unsupportedItems.push({
            kind: 'trigger-xml-field',
            field: 'Label',
            count: labelReferenceCount,
            reason: 'editor-label-reference-not-lowered',
        });
    }
    const unsupported = disposition(unsupportedItems);
    if (dropped.count > 0) {
        diagnostics.push(diagnostic('sc2-triggers/editor-hierarchy-dropped', 'warning', `${dropped.count} Category/Label elements do not have Galaxy runtime syntax`));
    }
    const readerRemainder = unsupportedItems
        .filter(item => item.kind === 'semantic-reader-element-type' || item.kind === 'trigger-xml-field')
        .reduce((total, item) => total + item.count, 0);
    if (readerRemainder > 0) {
        diagnostics.push(diagnostic('sc2-triggers/semantic-reader-remainder', 'warning', `${readerRemainder} TriggerData elements or fields are outside the pinned semantic model`));
    }
    const boundedDiagnostics = limitedDiagnostics(diagnostics);
    const fidelity = {
        direction: 'trigger-to-galaxy',
        sourceFormat: 'sc2-triggers',
        targetFormat: 'galaxy',
        preserved,
        rewritten,
        dropped,
        unsupported,
        completeness: dropped.count === 0 &&
            unsupported.count === 0 &&
            !hasError(diagnostics) &&
            !validationFailed(validation.verification)
            ? 'complete'
            : 'partial',
        diagnostics: boundedDiagnostics,
        verification: { galaxyValidation: validation.verification },
        provenance: provenance('trigger-to-galaxy'),
    };
    const base = {
        schemaVersion: 1,
        operation: 'trigger-to-galaxy',
        output: {
            libraryId,
            // Reported so a caller can hand the same kind back on the way in
            // without having to re-inspect the container it read from.
            documentKind: implicitDocument ? 'map' : 'library',
            scriptFileName: `Lib${libraryId}.galaxy`,
            headerFileName: `Lib${libraryId}_h.galaxy`,
            script: output.script,
            header: output.header,
            ...(output.initialization ? { initialization: output.initialization } : {}),
        },
        fidelity,
    };
    const result = { ...base, digest: await digest(base, maximum) };
    throwIfAborted(signal);
    return result;
}
function statementName(statement) {
    return statement.name?.name ?? statement.name ?? '';
}
function reverseStatementDisposition(sourceFile, libraryId) {
    const rewritten = new Map();
    const unsupported = new Map();
    const add = (target, reason, kind) => {
        const key = `${reason}:${kind}`;
        const item = target.get(key) ?? { kind: 'galaxy-statement', syntaxKind: kind, count: 0, reason };
        item.count += 1;
        target.set(key, item);
    };
    for (const statement of sourceFile.statements ?? []) {
        const kind = getKindName(statement.kind);
        const supportedKind = statement.kind === 136 /* SyntaxKind.IncludeStatement */ ||
            statement.kind === 142 /* SyntaxKind.FunctionDeclaration */ ||
            statement.kind === 141 /* SyntaxKind.VariableDeclaration */ ||
            statement.kind === 140 /* SyntaxKind.StructDeclaration */;
        if (supportedKind) {
            add(rewritten, 'reconstructed-as-trigger-semantics', kind);
        }
        else {
            add(unsupported, 'unsupported-galaxy-syntax', kind);
        }
    }
    return {
        rewritten: [...rewritten.values()].sort((left, right) => `${left.reason}:${left.syntaxKind}`.localeCompare(`${right.reason}:${right.syntaxKind}`)),
        unsupported: [...unsupported.values()].sort((left, right) => `${left.reason}:${left.syntaxKind}`.localeCompare(`${right.reason}:${right.syntaxKind}`)),
    };
}
function canonicalGalaxy(sourceFile) {
    return printer.printFile(sourceFile).replaceAll('\r\n', '\n').trim();
}
function exactTypeCounts(left, right) {
    return (canonicalJson(triggerLibraryTypeCounts(left)) === canonicalJson(triggerLibraryTypeCounts(right)));
}
function cleanSemanticValue(value, implicitLibrary) {
    if (value === undefined || value === false)
        return undefined;
    if (Array.isArray(value))
        return value.length ? value.map(child => cleanSemanticValue(child, implicitLibrary)) : undefined;
    if (!value || typeof value !== 'object')
        return value;
    const copy = { ...value };
    if (implicitLibrary !== undefined && (copy.library === implicitLibrary || copy.library === ''))
        delete copy.library;
    if (copy.name && copy.identifier === undefined && copy.displayName === undefined)
        copy.identifier = copy.name;
    if (copy.grammar !== undefined && copy.grammarSource === undefined)
        copy.grammarSource = 'xml';
    delete copy.catalogRefs;
    if (copy.type === 'Param' && copy.array && !Array.isArray(copy.array))
        copy.array = [copy.array];
    if (copy.type === 'FunctionDef') {
        copy.flags = functionFlags(copy).sort();
        delete copy.isFuncAction;
        delete copy.isFuncCall;
        delete copy.isSubFunction;
    }
    return Object.fromEntries(Object.entries(copy)
        .map(([key, child]) => [key, cleanSemanticValue(child, implicitLibrary)])
        .filter(([, child]) => child !== undefined));
}
function semanticModelsEqual(left, right) {
    // In a map document a reference into the document itself is written without
    // a Library attribute, so naming the owning library and omitting it are the
    // same reference and must compare equal.
    const implicit = library => library.implicit === true ? String(library.id ?? '') : undefined;
    const refs = (library, implicitLibrary) => library.items.map(item => ({
        type: item.type, ...(implicitLibrary === undefined ? { library: item.library ?? library.id } : {}), id: item.id,
    }));
    const leftImplicit = implicit(left), rightImplicit = implicit(right);
    if (canonicalJson(refs(left, leftImplicit)) !== canonicalJson(refs(right, rightImplicit)))
        return false;
    const order = library => Object.values(library.elements).sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`));
    const leftElements = order(left), rightElements = order(right);
    if (leftElements.length !== rightElements.length)
        return false;
    // Compare one normalized element at a time. The previous whole-library
    // snapshot retained two cloned models and two giant JSON strings at once.
    for (let index = 0; index < leftElements.length; index++) {
        if (canonicalJson(cleanSemanticValue(leftElements[index], leftImplicit)) !==
            canonicalJson(cleanSemanticValue(rightElements[index], rightImplicit)))
            return false;
    }
    return true;
}
function semanticModelDifference(left, right) {
    const implicit = library => library.implicit === true ? String(library.id ?? '') : undefined;
    const refs = (library, implicitLibrary) => library.items.map(item => ({
        type: item.type, ...(implicitLibrary === undefined ? { library: item.library ?? library.id } : {}), id: item.id,
    }));
    const leftImplicit = implicit(left), rightImplicit = implicit(right);
    const leftRefs = canonicalJson(refs(left, leftImplicit));
    const rightRefs = canonicalJson(refs(right, rightImplicit));
    if (leftRefs !== rightRefs)
        return { kind: 'root-items', left: leftRefs.slice(0, 2048), right: rightRefs.slice(0, 2048) };
    const order = library => Object.values(library.elements).sort((a, b) => `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`));
    const leftElements = order(left), rightElements = order(right);
    if (leftElements.length !== rightElements.length) {
        return { kind: 'element-count', left: leftElements.length, right: rightElements.length };
    }
    for (let index = 0; index < leftElements.length; index++) {
        const leftValue = canonicalJson(cleanSemanticValue(leftElements[index], leftImplicit));
        const rightValue = canonicalJson(cleanSemanticValue(rightElements[index], rightImplicit));
        if (leftValue !== rightValue) {
            return {
                kind: 'element',
                index,
                leftKey: `${leftElements[index].type}:${leftElements[index].id}`,
                rightKey: `${rightElements[index].type}:${rightElements[index].id}`,
                left: leftValue.slice(0, 4096),
                right: rightValue.slice(0, 4096),
            };
        }
    }
    return undefined;
}
// An element's displayed name is not in the trigger document: the editor keeps
// it in TriggerStrings and writes <Identifier> only for a script name authored
// by hand. Galaxy carries the sanitized form of that name, which is the one
// thing both sides share, so the authored name is recoverable by matching on
// it -- and once recovered the invented <Identifier> is dropped, because the
// editor would not have written one.
const NAME_SHAPES = {
    Variable: name => lowerInitial(sanitizeIdentifier(name)),
    ParamDef: name => lowerInitial(sanitizeIdentifier(name)),
};
function nameShapes(type, name) {
    const shaped = NAME_SHAPES[type]?.(name);
    const plain = sanitizeIdentifier(name);
    return shaped === undefined || shaped === plain ? [plain] : [plain, shaped];
}
// A Galaxy identifier may carry a scope prefix and, where two names sanitized
// alike, a disambiguating element id. Both are added by the generator, so both
// are stripped before the name underneath is looked up.
function galaxyNameShapes(identifier) {
    const shapes = new Set([identifier]);
    for (const shape of [...shapes]) {
        const scoped = /^(?:lv|gv|gf|gt|ge)_(.+)$/u.exec(shape);
        if (scoped !== null)
            shapes.add(scoped[1]);
    }
    for (const shape of [...shapes]) {
        const suffixed = /^(.+)_[0-9A-Fa-f]{8}$/u.exec(shape);
        if (suffixed !== null)
            shapes.add(suffixed[1]);
    }
    return shapes;
}
function mapEditorLabel(identifier) {
    // The map owns its namespace. `lib..._` and the generated role prefixes
    // belong to Galaxy linking, while the Trigger Editor wants the human-facing
    // part of the same symbol. Keep this deliberately structural: no library id
    // or user-defined identifier is recognized specially.
    const unscoped = identifier.replace(/^(?:lib[A-Za-z0-9_]+_)?g[vefts]_/u, '');
    return unscoped.replaceAll('_', ' ');
}
function recoverElementNames(library, triggerStringsText, implicitDocument = false) {
    const recovered = [];
    // A shape shared by two different names identifies neither, so it is dropped
    // rather than guessed at.
    const byShape = new Map();
    if (typeof triggerStringsText === 'string' && triggerStringsText.length > 0) {
        for (const [key, name] of parseTriggerStrings(triggerStringsText)) {
            const separator = key.indexOf(':');
            if (separator <= 0 || key.startsWith('Grammar:') || key.startsWith('Library:'))
                continue;
            const type = key.slice(0, separator);
            for (const shape of nameShapes(type, name)) {
                const shapeKey = `${type}\u0000${shape}`;
                if (!byShape.has(shapeKey))
                    byShape.set(shapeKey, name);
                else if (byShape.get(shapeKey) !== name)
                    byShape.set(shapeKey, null);
            }
        }
    }
    for (const element of Object.values(library.elements ?? {})) {
        // The reconstructed model carries the Galaxy spelling as `name`, which the
        // serializer prints as an <Identifier> the editor never wrote.
        const identifier = element.identifier ?? element.name;
        if (typeof identifier !== 'string' || identifier.length === 0)
            continue;
        let name;
        for (const candidate of galaxyNameShapes(identifier)) {
            const found = byShape.get(`${element.type}\u0000${candidate}`);
            if (typeof found === 'string' && nameShapes(element.type, found).includes(candidate)) {
                name = found;
                break;
            }
        }
        if (name === undefined)
            continue;
        element.displayName = name;
        element.name = name;
        delete element.identifier;
        recovered.push({ type: element.type, id: element.id, name });
    }
    // Hand-written Galaxy has no companion TriggerStrings document to recover a
    // display label from. Its identifier is still authored information, though:
    // keep it as the script identifier and also emit it as a usable editor name.
    // Do not manufacture labels for internal calls/parameters whose identifiers
    // are not editor-facing elements.
    for (const element of Object.values(library.elements ?? {})) {
        if (!['FunctionDef', 'Trigger', 'Variable', 'ParamDef', 'Structure'].includes(element.type))
            continue;
        if (typeof element.displayName === 'string' && element.displayName.length > 0)
            continue;
        const identifier = element.identifier ?? element.name;
        if (typeof identifier !== 'string' || identifier.length === 0)
            continue;
        // `name` is the model's code spelling for reconstructed elements.  The
        // serializer intentionally omits it when a display label exists, so retain
        // an explicit Identifier as well: Galaxy round-tripping still needs the
        // executable symbol while TriggerStrings gives the editor its label.
        element.identifier ??= identifier;
        // TriggerStrings parsing deliberately trims editor-facing element names.
        // Apply the same normalization before the exact serialize/reparse gate so
        // an encoded identifier that decodes to boundary whitespace cannot make
        // the in-memory model disagree with the document the editor will read.
        const decodedDisplayName = implicitDocument ? mapEditorLabel(identifier) : identifier;
        const displayName = decodedDisplayName.trim() || identifier;
        element.displayName = displayName;
        recovered.push({ type: element.type, id: element.id, name: displayName, source: 'galaxy-identifier' });
    }
    return recovered;
}
// The companion document the editor reads names from. A map keys entries by the
// bare element id; a mod qualifies them with its library.
function serializeTriggerStrings(library, implicit) {
    const lines = [];
    for (const element of Object.values(library.elements ?? {})) {
        const name = element.displayName;
        const id = String(element.id ?? '');
        const type = String(element.type ?? '');
        if (typeof name !== 'string' || name.length === 0 || !id || !type)
            continue;
        lines.push(`${type}/Name/${implicit ? id : `lib_${library.id}_${id}`}=${name}`);
    }
    if (lines.length === 0)
        return '';
    return `\ufeff${lines.sort().join('\n')}\n`;
}
function serializeGameStrings(library, implicit) {
    const lines = [];
    for (const element of Object.values(library.elements ?? {})) {
        if (element.type !== 'Param' || element.localizedValue === undefined)
            continue;
        const id = String(element.id ?? '');
        if (!id)
            continue;
        const value = String(element.localizedValue).replace(/[\r\n]/gu, ' ');
        lines.push(`Param/Value/${implicit ? id : `lib_${library.id}_${id}`}=${value}`);
    }
    return lines.length ? `\ufeff${lines.sort().join('\n')}\n` : '';
}
export async function convertGalaxyToTriggers(rawInput, signal) {
    throwIfAborted(signal);
    const input = record(rawInput, 'galaxy-to-triggers');
    const reportProgress = progressReporter(input, 'galaxy-to-triggers');
    reportProgress({ phase: 'input', completed: 0, total: 1 });
    const generation = generationOptions(input);
    const verification = reverseVerification(input);
    let declarations = galaxyDeclarations(input);
    const maximum = outputBound(input);
    const script = boundedString(input.script, 'script', MAX_DEPENDENCY_BYTES, true);
    const header = boundedString(input.header, 'header', MAX_DEPENDENCY_BYTES, true);
    const libraryId = input.libraryId;
    if (typeof libraryId !== 'string' || !/^[A-Za-z0-9_]+$/u.test(libraryId)) {
        throw new TypeError('libraryId must be an ASCII identifier');
    }
    const implicitDocument = documentIsImplicit(input);
    reportProgress({ phase: 'input', completed: 1, total: 1 });
    const sourceTriggerStrings = boundedString(input.triggerStrings, 'triggerStrings', MAX_DEPENDENCY_BYTES);
    const sourceGameStrings = boundedString(input.gameStrings, 'gameStrings', MAX_DEPENDENCY_BYTES);
    const dependencyInput = { ...input, dependencyLibraries: input.dependencyLibraries ?? [] };
    const dependencies = dependencyDocuments(dependencyInput);
    reportProgress({ phase: 'dependencies', completed: 0, total: dependencies.length });
    const { libraries: allLibraries, layers } = await semanticDependencyLibraries(dependencies, signal, conversionLimits(input), libraryLayerPolicy(input), conversionContextState(input));
    reportProgress({ phase: 'dependencies', completed: dependencies.length, total: dependencies.length });
    declarations = [...modelDeclarations(allLibraries, libraryId, declarations), ...declarations];
    const nativeLibrary = allLibraries.get('Ntve');
    await checkpoint(signal);
    reportProgress({ phase: 'parse', completed: 0, total: 1 });
    const scriptSource = parseGalaxySource(script, `Lib${libraryId}.galaxy`);
    const headerSource = parseGalaxySource(header, `Lib${libraryId}_h.galaxy`);
    reportProgress({ phase: 'parse', completed: 1, total: 1 });
    // Recognizing the startup functions means knowing what they are called, and a
    // map calls them InitMap/InitLibs/InitGlobals rather than lib<Id>_Init*.
    const sourceRoot = withImplicitLibrary(implicitDocument ? libraryId : undefined, () => preservedInitializationRoot([...headerSource.statements, ...scriptSource.statements], libraryId, generation.entryPoint));
    // A structurally complete editor-generated map startup graph is folded into
    // TriggerData and must be generated again on the forward path. Marking it as
    // `preserve` after the fold suppresses the regenerated InitMap/InitLibs graph
    // even though the original functions are no longer present in the XML.
    const generatedMapStartup = implicitDocument && generation.initialization === undefined && generation.entryPoint === undefined &&
        sourceRoot === withImplicitLibrary(libraryId, () => startupFunctionName(libraryId, 'InitLib'));
    // An arbitrary source file does not imply an editor library startup protocol.
    if (!sourceRoot && generation.initialization === undefined)
        generation.initialization = 'preserve';
    const sourceValidation = validateGalaxyOutput({ script, header }, libraryId, declarations, input.strictSymbols);
    const diagnostics = [...layerDiagnostics(layers), ...sourceValidation.diagnostics];
    throwIfAborted(signal);
    resetGalaxyToTriggerIdCounter();
    const constantFolds = [];
    let reconstructed = normalizeTriggerLibrary(convertGalaxyToTriggerLibrary(scriptSource, headerSource, {
        libraryId,
        implicitLibrary: implicitDocument,
        ...(typeof input.libraryName === 'string' ? { libraryName: input.libraryName } : {}),
        nativeLibrary,
        dependencyLibraries: allLibraries,
        galaxyDeclarations: declarations,
        constantFolds,
        preserveInitialization: generation.initialization === 'preserve' || !!generation.entryPoint,
        onProgress: event => reportProgress({ ...event, phase: 'reconstruct', stage: event.phase }),
    }));
    // The source AST is only needed to reconstruct the model and to establish
    // the later canonical/disposition comparisons. Retain those compact results,
    // not every source node, while serializing, reparsing, and regenerating the
    // library. This is especially material for large hand-written map scripts.
    const sourceScriptCanonical = verification === 'full' ? canonicalGalaxy(scriptSource) : undefined;
    const sourceHeaderCanonical = verification === 'full' ? canonicalGalaxy(headerSource) : undefined;
    const scriptDisposition = reverseStatementDisposition(scriptSource, libraryId);
    const headerDisposition = reverseStatementDisposition(headerSource, libraryId);
    scriptSource.statements = [];
    headerSource.statements = [];
    const reconstructedElementCount = Object.keys(reconstructed.elements).length;
    const reconstructedTypeCounts = triggerLibraryTypeCounts(reconstructed);
    reportProgress({ phase: 'reconstruct', stage: 'complete', completed: 1, total: 1, elements: reconstructedElementCount });
    for (const fold of constantFolds)
        diagnostics.push(diagnostic('sc2-triggers/constant-fold', 'info', 'Array length was evaluated from loaded Galaxy constants', fold));
    if (reconstructedElementCount > conversionLimits(input).maxLibraryElements) {
        throw new RangeError('reconstructed Trigger library exceeds the element bound');
    }
    await checkpoint(signal);
    reportProgress({ phase: 'reference-validation', completed: 0, total: 1, elements: reconstructedElementCount });
    assertConversionReferences(reconstructed, allLibraries);
    reportProgress({ phase: 'reference-validation', completed: 1, total: 1, elements: reconstructedElementCount });
    if (implicitDocument)
        reconstructed.implicit = true;
    const recoveredNames = recoverElementNames(reconstructed, sourceTriggerStrings, implicitDocument);
    if (sourceTriggerStrings || sourceGameStrings) {
        applyTriggerStringsByType(libraryId, reconstructed.elementsByType, parseTriggerStrings([sourceTriggerStrings, sourceGameStrings].filter(value => value !== undefined).join('\n')));
    }
    for (const item of recoveredNames) {
        diagnostics.push(diagnostic('sc2-triggers/recovered-name', 'info', `Restored the authored name of ${item.type} ${item.id} from TriggerStrings`, item));
    }
    const triggerData = serializeTriggerLibrary(reconstructed);
    const triggerStrings = serializeTriggerStrings(reconstructed, implicitDocument);
    const gameStrings = serializeGameStrings(reconstructed, implicitDocument);
    reportProgress({ phase: 'serialization', completed: 1, total: 1, elements: reconstructedElementCount });
    const reparsedMap = parsePrimaryDocument(triggerData, libraryId);
    const reparsed = reparsedMap.get(libraryId);
    // The pair is what the editor reads, so the pair is what has to reparse.
    if (reparsed !== undefined && (triggerStrings.length > 0 || gameStrings.length > 0)) {
        applyTriggerStringsByType(libraryId, reparsed.elementsByType, parseTriggerStrings(`${triggerStrings}\n${gameStrings}`));
    }
    const reparsedElementCount = reparsed === undefined ? undefined : Object.keys(reparsed.elements).length;
    const elementCountExact = reparsedElementCount === reconstructedElementCount;
    const typeCountsExact = reparsed !== undefined && exactTypeCounts(reparsed, reconstructed);
    const semanticDifference = reparsed === undefined ? { kind: 'missing-library', libraryId } : semanticModelDifference(reparsed, reconstructed);
    if (reparsed === undefined || !elementCountExact || !typeCountsExact || semanticDifference !== undefined) {
        throw new TypeError(`generated TriggerData failed exact semantic reparse checks: ${JSON.stringify({
            libraryId,
            reconstructedElementCount,
            reparsedElementCount,
            elementCountExact,
            typeCountsExact,
            semanticDifference,
        })}`);
    }
    reconstructed = undefined;
    reportProgress({ phase: 'semantic-reparse', completed: 1, total: 1, elements: reconstructedElementCount });
    const unsupportedItems = [...scriptDisposition.unsupported, ...headerDisposition.unsupported];
    let roundTrip;
    let outputVerification;
    let scriptExact = null;
    let headerExact = null;
    if (verification === 'full') {
        reportProgress({ phase: 'galaxy-roundtrip', completed: 0, total: 1, elements: reconstructedElementCount });
        roundTrip = convertTriggerLibraryToGalaxyFull(reparsed, nativeLibrary, allLibraries, {
            ...generation,
            galaxyDeclarations: declarations,
            onProgress: event => reportProgress({ ...event, phase: 'galaxy-roundtrip', stage: event.phase }),
        });
        const roundTripScript = parseGalaxySource(roundTrip.script, `RoundTrip${libraryId}.galaxy`);
        const roundTripHeader = parseGalaxySource(roundTrip.header, `RoundTrip${libraryId}_h.galaxy`);
        const outputValidation = validateGalaxyOutput(roundTrip, libraryId, declarations, input.strictSymbols, 'RoundTrip');
        reportProgress({ phase: 'galaxy-roundtrip', completed: 1, total: 1, elements: reconstructedElementCount });
        const sourceBindings = new Set(sourceValidation.declaredSymbols);
        const sourceUnresolved = new Set(sourceValidation.verification.unresolvedSymbols);
        const lostBindings = outputValidation.verification.unresolvedSymbols.filter(name => sourceBindings.has(name) && !sourceUnresolved.has(name));
        if (lostBindings.length) {
            outputValidation.verification.status = 'failed';
            outputValidation.verification.errors += lostBindings.length;
            for (const name of lostBindings)
                outputValidation.diagnostics.push(diagnostic('sc2-triggers/galaxy-lost-binding', 'error', `Source declaration '${name}' is no longer bound in the generated Galaxy`, { symbol: name }));
        }
        outputValidation.verification.lostSourceBindings = lostBindings;
        diagnostics.push(...outputValidation.diagnostics);
        outputVerification = outputValidation.verification;
        scriptExact = sourceScriptCanonical === canonicalGalaxy(roundTripScript);
        headerExact = sourceHeaderCanonical === canonicalGalaxy(roundTripHeader);
        roundTripScript.statements = [];
        roundTripHeader.statements = [];
        if (!scriptExact) {
            unsupportedItems.push({
                kind: 'canonical-roundtrip',
                file: 'script',
                count: 1,
                reason: 're-emitted-galaxy-differs-after-reparse',
            });
        }
        if (!headerExact) {
            unsupportedItems.push({
                kind: 'canonical-roundtrip',
                file: 'header',
                count: 1,
                reason: 're-emitted-galaxy-differs-after-reparse',
            });
        }
        if (!scriptExact || !headerExact) {
            diagnostics.push(diagnostic('sc2-triggers/reverse-roundtrip-difference', 'warning', 'Galaxy was reconstructed, reparsed, and compared canonically; at least one file differs', { scriptExact, headerExact }));
        }
    }
    else {
        reportProgress({ phase: 'galaxy-roundtrip', stage: 'deferred', completed: 0, total: 0, elements: reconstructedElementCount });
        outputVerification = {
            status: 'incomplete',
            errors: 0,
            unresolvedSymbols: [],
            uncheckedTypes: 0,
            diagnosticsOmitted: 0,
            declarationFiles: declarations.map(file => file.fileName),
            validationCompleted: false,
            lostSourceBindings: [],
            deferred: true,
        };
        unsupportedItems.push({
            kind: 'verification',
            count: 1,
            reason: 'galaxy-roundtrip-deferred',
        });
        diagnostics.push(diagnostic('sc2-triggers/reverse-roundtrip-deferred', 'warning', 'Galaxy roundtrip validation was deferred; TriggerData completed exact semantic reparse checks', { verification }));
    }
    const rewritten = disposition([
        ...scriptDisposition.rewritten,
        ...headerDisposition.rewritten,
        {
            kind: 'trigger-element',
            count: reconstructedElementCount,
            reason: 'created-by-conservative-reconstruction',
        },
    ]);
    const unsupported = disposition(unsupportedItems);
    const boundedDiagnostics = limitedDiagnostics(diagnostics);
    const fidelity = {
        direction: 'galaxy-to-triggers',
        sourceFormat: 'galaxy',
        targetFormat: 'sc2-triggers',
        preserved: disposition([]),
        rewritten,
        dropped: disposition([]),
        unsupported,
        completeness: unsupported.count === 0 &&
            !hasError(diagnostics) &&
            !validationFailed(sourceValidation.verification) &&
            !validationFailed(outputVerification)
            ? 'complete'
            : 'partial',
        diagnostics: boundedDiagnostics,
        verification: {
            generatedTriggerDataReparsed: true,
            elementCountExact: true,
            typeCountsExact: true,
            semanticModelExact: true,
            galaxyScriptCanonicalExact: scriptExact,
            galaxyHeaderCanonicalExact: headerExact,
            galaxyValidation: outputVerification,
            sourceGalaxyValidation: sourceValidation.verification,
        },
        provenance: provenance('galaxy-to-triggers'),
    };
    const base = {
        schemaVersion: 1,
        operation: 'galaxy-to-triggers',
        output: {
            libraryId,
            documentKind: implicitDocument ? 'map' : 'library',
            triggerData,
            // Names live beside the document, not in it; a caller that writes one
            // without the other loses every authored name.
            ...(triggerStrings.length > 0 ? { triggerStrings, triggerStringsFileName: 'TriggerStrings.txt' } : {}),
            ...(gameStrings.length > 0 ? { gameStrings, gameStringsFileName: 'GameStrings.txt' } : {}),
            elements: reconstructedElementCount,
            typeCounts: reconstructedTypeCounts,
            ...(roundTrip?.initialization
                ? { generationOptions: { initialization: 'preserve', ...(roundTrip.initialization.entryPoint ? { entryPoint: roundTrip.initialization.entryPoint } : {}) } }
                : verification === 'semantic' && (!generatedMapStartup && (sourceRoot || generation.initialization === 'preserve' || generation.entryPoint))
                    ? { generationOptions: { initialization: 'preserve', ...(generation.entryPoint ? { entryPoint: generation.entryPoint } : {}) } }
                    : {}),
        },
        fidelity,
    };
    reportProgress({ phase: 'output-bound', completed: 0, total: 1, elements: reconstructedElementCount });
    reportProgress({ phase: 'digest', completed: 0, total: 1, elements: reconstructedElementCount });
    const result = { ...base, digest: await digest(base, maximum) };
    reportProgress({ phase: 'output-bound', completed: 1, total: 1, elements: reconstructedElementCount });
    reportProgress({ phase: 'digest', completed: 1, total: 1, elements: reconstructedElementCount });
    throwIfAborted(signal);
    reportProgress({ phase: 'complete', completed: 1, total: 1, elements: reconstructedElementCount });
    return result;
}
export const triggerConversionBounds = Object.freeze({
    defaults: DEFAULT_LIMITS,
    hardLimits: HARD_LIMITS,
    defaultMaxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES,
    hardMaxOutputBytes: HARD_MAX_OUTPUT_BYTES,
    maxPrimaryBytes: MAX_PRIMARY_BYTES,
    maxDependencyBytes: MAX_DEPENDENCY_BYTES,
    maxDependencyDocuments: MAX_DEPENDENCY_DOCUMENTS,
    maxLibraryElements: MAX_LIBRARY_ELEMENTS,
});

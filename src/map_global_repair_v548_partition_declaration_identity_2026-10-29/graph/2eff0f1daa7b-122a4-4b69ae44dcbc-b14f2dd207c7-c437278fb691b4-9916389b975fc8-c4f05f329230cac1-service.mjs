import {finalizeLocalRetirements} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/deferred-local-retirement.linear.mjs";
import {pruneUnreachableElements as finalPruneLocals} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-lossless-colors-v148-2026-10-05/dist/modules/triggers/services/galaxy-conversion/internal/g2t-prune.js";
import {describeReferenceFailure} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/reference-failure-owners.mjs";
import {
  convertGalaxyToTriggerLibrary,
  parseGalaxySource,
  resetGalaxyToTriggerIdCounter,
} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v548_partition_declaration_identity_2026-10-29/graph/c75cfea5f929-0c96107dab-c128394f1d8e-ad45c007986c-21527f3b8ae393-a0ee87a3fc6c5c22-galaxy-to-trigger.mjs'
import {
  parseTriggerXmlSync,
  readTriggerLibrariesFast,
} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/c065b7a32beb-2246569e8e8d-7a5c10537b21-996d15a4f33e-99ab3f7e7e47-sax-reader.js'
import { convertTriggerLibraryToGalaxyFull } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v532_selector_metadata_private_handles_2026-10-29/graph/4e3e50e68dca-494804bcf021-4c2282e78686-2bebc296f55e0e-049296a56ba59bab-trigger-to-galaxy.mjs'
import { triggerConverterProvenance } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/triggers/services/galaxy-conversion/converter-entry.js'
import {
  normalizeTriggerLibrary,
  serializeTriggerLibrary,
  triggerLibraryTypeCounts,
} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/b917409db9a8-de27e453eb94-3ba44366c72e-f591373cb01f-5477c27ec2e1-trigger-xml.js'
import { validateGalaxyPair } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/ecb896d5b88b-02521511d22d-3906da691b0a7b4e-validation.mjs'
import { Printer, SyntaxKind, getKindName, isKeywordTypeKind, tokenToString } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d6ed2165dd4b-index.js'
import { functionFlags, assertConversionReferences, sanitizeIdentifier, lowerInitial, startupFunctionName, withImplicitLibrary } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js'
import { parseTriggerStrings, applyTriggerStringsByType } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/triggers/shared/trigger-document/trigger-strings.js'
import { preservedInitializationRoot } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/6046b2f98501-8a5323d4e243-334653ad7d77af54-g2t-initialization.mjs'
import { reserveGalaxyToTriggerId } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/a7544f5d1468-bc1585ddb935-a0500896c8979f73-g2t-core.mjs'
import { splitEmbeddedLibraries } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/da9b2debc4da-3059335f83c1-18d3771ef813713d-embedded-libraries.mjs'
import { documentDependencies, mapParameterTypeToGalaxy, toGalaxyFunctionName } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/78e2c7a105b4-06b6407a2245-39006703de6e-core.mjs'
import { isInlineTemplate } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v532_selector_metadata_private_handles_2026-10-29/graph/56a76ab299ef-d7d7e99749ed-aab1475a27fb-2a48e52f93f67c-efb973f0dceafd0e-ttg-template.mjs'
import { recoverCustomAi } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/triggers/services/galaxy-conversion/internal/custom-ai-recovery.js'
import { customAiScriptFiles, emitCustomAi, recoveredCustomAiOutput } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/618d7dfedc4d-44aed051b39a-5665c87d0a180808-custom-ai.mjs'
import { recoverAttributes } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/triggers/services/galaxy-conversion/internal/attributes-recovery.js'
import { writeAttributes } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/map/shared/format/formats/attributes.js'

// A hand-written Galaxy file expands into far more XML than it occupies itself:
// every expression becomes an element with an identity. Sizing the default from
// the input would refuse authored work rather than protect against it.
const DEFAULT_MAX_OUTPUT_BYTES = 512 * 1024 * 1024
const HARD_MAX_OUTPUT_BYTES = 1024 * 1024 * 1024
// Real SC2 Trigger documents run past 70 MiB, so a smaller default would refuse
// authored input rather than protect against it. The default leaves room well
// past anything observed; the ceiling below is what a caller may raise it to.
const MAX_PRIMARY_BYTES = 512 * 1024 * 1024
const MAX_DEPENDENCY_BYTES = 512 * 1024 * 1024
// Multi-library SC2Mods can legitimately contain dozens of local libraries;
// each sibling library is a distinct dependency document while one body is
// reconstructed. The aggregate byte budget remains the primary memory bound.
const MAX_DEPENDENCY_DOCUMENTS = 512
// The authored COMI library is 92,065 elements and rebuilding it from its script
// gives 113,840; a hand-written map reached 314,599. A bound below those refuses
// documents the game itself ships. Cost scales with the count — 314,599 elements
// held about 2.3 GB — so the ceiling below stays finite.
const MAX_LIBRARY_ELEMENTS = 1_000_000
const MAX_DIAGNOSTICS = 1_000
const encoder = new TextEncoder()
const printer = new Printer()
const DEFAULT_LIMITS = Object.freeze({ maxInputBytes: MAX_PRIMARY_BYTES, maxDependencyBytes: MAX_DEPENDENCY_BYTES, maxLibraryElements: MAX_LIBRARY_ELEMENTS, maxTotalElements: 4_000_000 })
const HARD_LIMITS = Object.freeze({ maxInputBytes: 1024 * 1024 * 1024, maxDependencyBytes: 1024 * 1024 * 1024, maxLibraryElements: 4_000_000, maxTotalElements: 16_000_000 })
// One entry per dependency document of the largest real document plus room to spare:
// a 17-library mod evicted every sibling on every pass at 16 (1226 misses, 32 hits, 26 min).
// The source-byte budget below is what actually bounds retention.
const DEFAULT_DEPENDENCY_CACHE_ENTRIES = 64
const DEFAULT_DEPENDENCY_CACHE_SOURCE_BYTES = 64 * 1024 * 1024
const conversionContextStates = new WeakMap()

/** A conversion service may reuse immutable parsed dependencies without
 * leaking them into unrelated callers. Source bytes provide a deterministic
 * source-based retention budget; callers can disable it with
 * maxDependencyCacheEntries: 0. Parsed heap size remains engine-dependent. */
export function createTriggerConversionContext(options = {}) {
  record(options, 'conversion context options')
  const maxEntries = options.maxDependencyCacheEntries ?? DEFAULT_DEPENDENCY_CACHE_ENTRIES
  const maxSourceBytes = options.maxDependencyCacheSourceBytes ?? DEFAULT_DEPENDENCY_CACHE_SOURCE_BYTES
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 0 || maxEntries > MAX_DEPENDENCY_DOCUMENTS) {
    throw new RangeError(`maxDependencyCacheEntries must be between 0 and ${MAX_DEPENDENCY_DOCUMENTS}`)
  }
  if (!Number.isSafeInteger(maxSourceBytes) || maxSourceBytes < 0 || maxSourceBytes > HARD_MAX_OUTPUT_BYTES) {
    throw new RangeError(`maxDependencyCacheSourceBytes must be between 0 and ${HARD_MAX_OUTPUT_BYTES}`)
  }
  const state = {
    entries: new Map(), sourceBytes: 0, maxEntries, maxSourceBytes,
    hits: 0, misses: 0, stores: 0, evictions: 0,
  }
  const context = Object.freeze({
    clear() {
      state.entries.clear()
      state.sourceBytes = 0
    },
    stats() {
      return Object.freeze({
        entries: state.entries.size, sourceBytes: state.sourceBytes,
        hits: state.hits, misses: state.misses, stores: state.stores, evictions: state.evictions,
      })
    },
  })
  conversionContextStates.set(context, state)
  return context
}

function conversionContextState(input) {
  if (input.conversionContext === undefined) return undefined
  const state = conversionContextStates.get(input.conversionContext)
  if (!state) throw new TypeError('conversionContext must be created by createTriggerConversionContext')
  return state
}
function conversionLimits(input) {
  const requested = input.limits === undefined ? {} : record(input.limits, 'limits')
  const limits = { ...DEFAULT_LIMITS }
  for (const [key, value] of Object.entries(requested)) {
    if (!Object.hasOwn(HARD_LIMITS, key) || !Number.isSafeInteger(value) || value < 1 || value > HARD_LIMITS[key]) throw new RangeError(`Invalid conversion limit ${key}`)
    limits[key] = value
  }
  return limits
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
])
const EDITOR_ONLY_TYPES = new Set(['Category', 'Label', 'Comment'])

function throwIfAborted(signal) {
  if (!signal?.aborted) return
  throw new DOMException('operation cancelled', 'AbortError')
}

async function checkpoint(signal) {
  throwIfAborted(signal)
  await new Promise(resolve => setTimeout(resolve, 0))
  throwIfAborted(signal)
}

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} requires an object input`)
  }
  return value
}

function progressReporter(input, operation) {
  if (input.onProgress !== undefined && typeof input.onProgress !== 'function') {
    throw new TypeError('onProgress must be a function')
  }
  const callback = input.onProgress
  let sequence = 0
  return event => {
    if (!callback) return
    const completed = Number.isFinite(event.completed) ? event.completed : 0
    const total = Number.isFinite(event.total) ? event.total : 0
    const progress = Object.freeze({
      operation,
      sequence: sequence++,
      phase: event.phase,
      ...(event.stage ? { stage: event.stage } : {}),
      completed,
      total,
      ratio: total > 0 ? Math.max(0, Math.min(1, completed / total)) : undefined,
      ...(Number.isFinite(event.elements) ? { elements: event.elements } : {}),
    })
    // Telemetry must not alter conversion semantics. AbortSignal remains the
    // explicit cancellation channel.
    try { callback(progress) } catch {}
  }
}

function boundedString(value, label, maximum, required = false) {
  if (value === undefined && !required) return undefined
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string`)
  if (encoder.encode(value).byteLength > maximum) {
    throw new RangeError(`${label} exceeds ${maximum} UTF-8 bytes`)
  }
  return value
}

// SC2 ships twelve text locales; room for a document that adds its own.
const MAX_LOCALES = 32

/** The strings of every locale of a document, `localizedStrings: [{ locale, triggerStrings?, gameStrings? }]`.
 *  `triggerStrings`/`gameStrings` of the input are those of its primary locale (`locale`, else enUS, else
 *  the first given); the entry of `localizedStrings` for that locale stands in for them when they are absent. */
function localizedStringSets(input) {
  const raw = input.localizedStrings
  if (raw === undefined) return { primaryLocale: typeof input.locale === 'string' ? input.locale : 'enUS', locales: [] }
  if (!Array.isArray(raw) || raw.length > MAX_LOCALES) throw new TypeError('localizedStrings must be a bounded array')
  const seen = new Set()
  const locales = raw.map((item, index) => {
    record(item, `localizedStrings[${index}]`)
    if (typeof item.locale !== 'string' || !/^[a-z]{2}[A-Z]{2}$/u.test(item.locale) || seen.has(item.locale)) {
      throw new TypeError(`localizedStrings[${index}].locale must be a distinct locale such as enUS`)
    }
    seen.add(item.locale)
    return {
      locale: item.locale,
      triggerStrings: boundedString(item.triggerStrings, `localizedStrings[${index}].triggerStrings`, MAX_DEPENDENCY_BYTES),
      gameStrings: boundedString(item.gameStrings, `localizedStrings[${index}].gameStrings`, MAX_DEPENDENCY_BYTES),
    }
  })
  const primaryLocale = typeof input.locale === 'string' ? input.locale
    : locales.some(item => item.locale === 'enUS') ? 'enUS' : locales[0]?.locale ?? 'enUS'
  return { primaryLocale, locales }
}

function outputBound(input) {
  if (input.maxOutputBytes === undefined) return DEFAULT_MAX_OUTPUT_BYTES
  if (
    !Number.isSafeInteger(input.maxOutputBytes) ||
    input.maxOutputBytes < 1 ||
    input.maxOutputBytes > HARD_MAX_OUTPUT_BYTES
  ) {
    throw new RangeError(`maxOutputBytes must be between 1 and ${HARD_MAX_OUTPUT_BYTES}`)
  }
  return input.maxOutputBytes
}

function generationOptions(input) {
  if (input.initialization !== undefined && !['library', 'preserve'].includes(input.initialization)) throw new TypeError('initialization must be library or preserve')
  if (input.entryPoint !== undefined && (typeof input.entryPoint !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/u.test(input.entryPoint))) throw new TypeError('entryPoint must be a Galaxy identifier')
  if (input.entryPoint !== undefined && input.initialization === 'library') throw new TypeError('entryPoint conflicts with generated library initialization')
  return { ...(input.initialization ? { initialization: input.initialization } : {}), ...(input.entryPoint ? { entryPoint: input.entryPoint } : {}) }
}

function reverseVerification(input) {
  const verification = input.verification ?? 'full'
  if (!['full', 'semantic'].includes(verification)) throw new TypeError('verification must be full or semantic')
  return verification
}

function galaxyDeclarations(input) {
  if (input.strictSymbols !== undefined && typeof input.strictSymbols !== 'boolean') throw new TypeError('strictSymbols must be a boolean')
  const files = input.galaxyDeclarations ?? []
  if (!Array.isArray(files) || files.length > MAX_DEPENDENCY_DOCUMENTS) throw new TypeError('galaxyDeclarations must be a bounded array')
  let bytes = 0
  return files.map((item, i) => {
    record(item, `galaxyDeclarations[${i}]`)
    const fileName = boundedString(item.fileName, 'declaration fileName', 1024, true)
    const text = boundedString(item.text, 'declaration text', MAX_DEPENDENCY_BYTES, true)
    bytes += encoder.encode(text).byteLength
    if (bytes > MAX_DEPENDENCY_BYTES) throw new RangeError('Galaxy declarations exceed the dependency byte bound')
    return { fileName, text }
  })
}

function validateGalaxyOutput(output, libraryId, declarations, strictSymbols, prefix = 'Lib') {
  try { return validateGalaxyPair([
    { fileName: `${prefix}${libraryId}_h.galaxy`, text: output.header },
    { fileName: `${prefix}${libraryId}.galaxy`, text: output.script },
  ], declarations, strictSymbols) } catch (error) {
    return { declaredSymbols: [], diagnostics: [diagnostic('sc2-triggers/galaxy-validation-failed', 'error', `Galaxy validation did not finish: ${String(error)}`)],
      verification: { status: 'failed', errors: 1, unresolvedSymbols: [], uncheckedTypes: 0, diagnosticsOmitted: 0, declarationFiles: declarations.map(file => file.fileName), validationCompleted: false } }
  }
}

function modelDeclarations(libraries, primaryId, supplied = []) {
  const signatures = new Map()
  const explicit = new Set(supplied.flatMap(file => [...parseGalaxySource(file.text).statements].filter(node => node.kind === SyntaxKind.FunctionDeclaration).map(node => node.name.name)))
  const primitives = new Set(Object.values(SyntaxKind).filter(kind => typeof kind === 'number' && isKeywordTypeKind(kind)).map(kind => tokenToString(kind)))
  for (const library of libraries.values()) {
    if (library.id === primaryId) continue
    const context = { libId: library.id, library, allLibraries: libraries, functionNameGroups: new Map() }
    for (const definition of Object.values(library.elements)) {
      if (definition.type !== 'FunctionDef' || definition.disabled || !definition.name || isInlineTemplate(definition) || definition.flags?.includes('CustomScript')) continue
      const formals = (definition.parameters ?? []).map(ref => {
        const owner = libraries.get(ref.library ?? library.id)
        return owner?.elementsByType?.ParamDef?.[ref.id]
      })
      // A GUI action can discard a native return value; absence is not proof of void.
      const result = definition.returnType ?? (definition.flags?.includes('Native') ? undefined : { type: definition.isFuncCall ? 'any' : 'void' })
      if (formals.some(formal => !formal) || [result, ...formals.map(formal => formal.paramType)].some(type => !type || /^(any|sameas)/u.test(type.type))) continue
      const name = toGalaxyFunctionName(definition, context)
      if (explicit.has(name)) continue
      const type = item => mapParameterTypeToGalaxy(item, library, undefined, libraries)
      if (![result, ...formals.map(formal => formal.paramType)].every(item => primitives.has(type(item)))) continue
      const parameters = [...(definition.flags?.includes('Event') ? ['trigger eventTarget'] : []), ...formals.map((formal, index) => `${type(formal.paramType)} arg${index}`)]
      signatures.set(name, `${type(result)} ${name}(${parameters.join(', ')});`)
    }
  }
  return signatures.size ? [{ fileName: 'trigger-model-declarations.galaxy', text: [...signatures.values()].join('\n') }] : []
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter(key => value[key] !== undefined)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

const CANONICAL_STRING_CHUNK_UNITS = 64 * 1024

function * canonicalJsonStringChunks(value) {
  yield '"'
  for (let offset = 0; offset < value.length;) {
    let end = Math.min(value.length, offset + CANONICAL_STRING_CHUNK_UNITS)
    // JSON.stringify emits a surrogate pair as one Unicode scalar. Splitting
    // between its UTF-16 units would instead encode two lone surrogates and
    // change the digest, so move that boundary by one code unit.
    if (end < value.length) {
      const previous = value.charCodeAt(end - 1)
      const next = value.charCodeAt(end)
      if (previous >= 0xD800 && previous <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF) end++
    }
    const encoded = JSON.stringify(value.slice(offset, end))
    yield encoded.slice(1, -1)
    offset = end
  }
  yield '"'
}

function * canonicalJsonChunks(value) {
  if (Array.isArray(value)) {
    yield '['
    for (let index = 0; index < value.length; index++) {
      if (index > 0) yield ','
      yield * canonicalJsonChunks(value[index])
    }
    yield ']'
    return
  }
  if (value !== null && typeof value === 'object') {
    yield '{'
    const keys = Object.keys(value).filter(key => value[key] !== undefined).sort()
    for (let index = 0; index < keys.length; index++) {
      if (index > 0) yield ','
      const key = keys[index]
      yield * canonicalJsonStringChunks(key)
      yield ':'
      yield * canonicalJsonChunks(value[key])
    }
    yield '}'
    return
  }
  if (typeof value === 'string') {
    yield * canonicalJsonStringChunks(value)
    return
  }
  yield JSON.stringify(value)
}

async function digest(value, maximum) {
  // Node's incremental hash avoids retaining one canonical JSON string and a
  // second complete UTF-8 buffer. Count the very same stream so enforcing the
  // output bound does not require another complete traversal.
  if (globalThis.process?.versions?.node) {
    const [{ createHash }, { Buffer }] = await Promise.all([import('node:crypto'), import('node:buffer')])
    const hash = createHash('sha256')
    let bytes = 0
    for (const chunk of canonicalJsonChunks(value)) {
      bytes += Buffer.byteLength(chunk, 'utf8')
      if (maximum !== undefined && bytes > maximum) throw new RangeError(`conversion output exceeds ${maximum} UTF-8 bytes`)
      hash.update(chunk, 'utf8')
    }
    return { algorithm: 'sha-256', value: hash.digest('hex') }
  }
  if (maximum !== undefined) ensureOutputBound(value, maximum)
  const bytes = encoder.encode(canonicalJson(value))
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return {
    algorithm: 'sha-256',
    value: [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join(''),
  }
}

function diagnostic(code, severity, message, details = undefined) {
  return {
    code,
    severity,
    message,
    ...(details === undefined ? {} : { details }),
  }
}

function limitedDiagnostics(items) {
  if (items.length <= MAX_DIAGNOSTICS) return items
  return [
    ...items.slice(0, MAX_DIAGNOSTICS - 1),
    diagnostic(
      'sc2-triggers/diagnostics-truncated',
      'warning',
      `${items.length - MAX_DIAGNOSTICS + 1} additional diagnostics were omitted`,
    ),
  ]
}

function disposition(items) {
  return { count: items.reduce((total, item) => total + item.count, 0), items }
}

function groupedElements(library, predicate, reason) {
  const counts = new Map()
  for (const element of Object.values(library.elements ?? {})) {
    const type = String(element?.type ?? 'Unknown')
    if (!predicate(type)) continue
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => ({ kind: 'element-type', type, count, reason }))
}

function authoredElementTypeCounts(xml) {
  const counts = new Map()
  for (const match of xml.matchAll(/<Element\b([^>]*)>/gu)) {
    const type = /\bType="([^"]+)"/u.exec(match[1])?.[1] ?? 'Unknown'
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  return counts
}

// A map keeps its trigger content directly under <TriggerData>, with no
// <Library> declaration and no Library attribute on references into itself; a
// mod declares one. The reader wants a library either way, so a map document
// gets a synthesized one -- and every library so synthesized is marked
// `implicit`, because the serializer has to reproduce the document it read.
function parsePrimaryDocument(xml, libraryId = 'Map', documentKind) {
  if (typeof libraryId !== 'string' || !/^[A-Za-z0-9_]+$/u.test(libraryId)) throw new TypeError('libraryId must be an ASCII identifier')
  const parsed = parseTriggerXmlSync(xml)
  if (parsed.size > 0 && (documentKind !== 'map' || parsed.has(libraryId))) return parsed
  // A map may also define libraries of its own (<Library Id="1">): they belong to this document,
  // and the editor compiles them into the map's script. The map's content is the rest.
  const own = parsed.size > 0 ? xml.replace(/<Library\s[^>]*>[\s\S]*?<\/Library>/gu, '') : xml
  const root = /<TriggerData(?:\s[^>]*)?>/u.exec(own)
  if (root === null) return parsed
  const offset = root.index + root[0].length
  const synthesized = parseTriggerXmlSync(`${own.slice(0, offset)}<Standard Id="${libraryId}"/>${own.slice(offset)}`)
  for (const library of synthesized.values()) library.implicit = true
  for (const library of parsed.values()) library.embedded = true
  return new Map([...synthesized, ...parsed])
}

// The document kind is a property of the container the scripts came from, not
// of their text: a map carries MapScript.galaxy at its root, a mod carries
// Base.SC2Data/Lib<Id>.galaxy. Callers that know the container say so; callers
// that do not get the library shape, which is what mods use.
function documentIsImplicit(input) {
  const kind = input.documentKind
  if (kind === undefined) return false
  if (kind !== 'map' && kind !== 'library') throw new TypeError("documentKind must be 'map' or 'library'")
  return kind === 'map'
}

function validateLibraries(libraries, limits = DEFAULT_LIMITS) {
  if (libraries.size === 0) throw new TypeError('TriggerData contains no semantic libraries')
  let elements = 0
  for (const [libraryId, result] of libraries) {
    const count = Object.keys(result.library.elements ?? {}).length
    elements += count
    if (count > limits.maxLibraryElements) throw new RangeError(`Trigger library ${libraryId} exceeds maxLibraryElements (${count} > ${limits.maxLibraryElements})`)
    if (elements > limits.maxTotalElements) throw new RangeError(`Trigger semantic model exceeds maxTotalElements (${elements} > ${limits.maxTotalElements})`)
    if (libraryId !== result.library.id) throw new TypeError('Trigger library identity mismatch')
  }
}

function dependencyDocuments(input) {
  const limits = conversionLimits(input)
  const dependencies = input.dependencyLibraries ?? []
  if (!Array.isArray(dependencies) || dependencies.length > MAX_DEPENDENCY_DOCUMENTS) {
    throw new RangeError(`dependencyLibraries is limited to ${MAX_DEPENDENCY_DOCUMENTS} items`)
  }
  let bytes = 0
  return dependencies.map((item, index) => {
    const dependency = record(item, `dependencyLibraries[${index}]`)
    const xml = boundedString(
      dependency.triggerData,
      `dependencyLibraries[${index}].triggerData`,
      limits.maxDependencyBytes,
      true,
    )
    const triggerStrings = boundedString(
      dependency.triggerStrings,
      `dependencyLibraries[${index}].triggerStrings`,
      limits.maxDependencyBytes,
    )
    const gameStrings = boundedString(
      dependency.gameStrings,
      `dependencyLibraries[${index}].gameStrings`,
      limits.maxDependencyBytes,
    )
    const sourceBytes = encoder.encode(xml).byteLength + encoder.encode(triggerStrings ?? '').byteLength + encoder.encode(gameStrings ?? '').byteLength
    bytes += sourceBytes
    if (bytes > limits.maxDependencyBytes) {
      throw new RangeError('dependencyLibraries exceeds the aggregate byte bound')
    }
    const sourcePath = typeof dependency.sourcePath === 'string' ? dependency.sourcePath : undefined
    // A library of the document being converted (another library of the same mod, or one the map
    // defines itself) is not included by a path of its own.
    const external = dependency.sameDocument !== true
    return { xml, triggerStrings: [triggerStrings, gameStrings].filter(value => value !== undefined).join('\n') || undefined, sourceBytes, external, sameDocument: !external, sourcePath }
  })
}

/** A shipped library is included by its file: `Base.SC2Data/TriggerLibs/SwarmCampaignLib.SC2Lib`
 * compiles to `TriggerLibs/SwarmCampaignLib`. A mod's own `Triggers` compiles to `Lib<Id>`. */
function dependencyIncludePath(sourcePath, libraryId) {
  const shipped = /^Base\.SC2Data\/(.+)\.(?:SC2Lib|TriggerLib)$/iu.exec(sourcePath?.replaceAll('\\', '/') ?? '')
  return shipped ? shipped[1] : `Lib${libraryId}`
}

/** Dependency libraries carry the include a dependent script uses; the loaded objects are
 * shared through the document cache, so they are copied rather than marked. */
function withIncludePaths(libraries, includes) {
  return new Map([...libraries].map(([id, library]) =>
    [id, includes.has(id) ? { ...library, includePath: includes.get(id) } : library]))
}

const LIBRARY_LAYER_POLICIES = new Set(['strict', 'first-document-wins'])

/** How two documents that declare the same library id are combined.
 * `strict` refuses; `first-document-wins` keeps the earlier document's library
 * whole. Element-wise merging is deliberately absent — see the note on
 * `layerDifference`. */
function libraryLayerPolicy(input) {
  const policy = input?.libraryLayers ?? 'strict'
  if (!LIBRARY_LAYER_POLICIES.has(policy)) {
    throw new TypeError(`libraryLayers must be one of ${[...LIBRARY_LAYER_POLICIES].join(', ')}`)
  }
  return policy
}

/** Editor output shows a library belonging to exactly one document: each
 * document emits its own Lib<Id>.galaxy, and the higher-priority document's
 * file replaces the other wholesale — dependent documents were observed
 * lacking functions their dependency declares. So a layer is never merged
 * element by element, and an element the winner omits is not a deletion of a
 * shared element; it is simply not part of that library. This summary exists to
 * report what the loser held, not to combine the two. */
function layerDifference(previous, next) {
  const typed = library => new Map(Object.values(library.elementsByType).flatMap(group => Object.values(group)).map(element => [`${element.type}:${element.id}`, element]))
  const left = typed(previous.library), right = typed(next.library)
  const changed = [...right].filter(([key, value]) => left.has(key) && canonicalJson(left.get(key)) !== canonicalJson(value)).map(([key]) => key)
  const roots = library => canonicalJson(library.rootRefs ?? library.items.map(item => ({ type: item.type, id: item.id })))
  return {
    changedElements: changed.length,
    addedElements: [...right.keys()].filter(key => !left.has(key)).length,
    omittedElements: [...left.keys()].filter(key => !right.has(key)).length,
    changedSample: changed.slice(0, 16),
    rootsChanged: roots(previous.library) !== roots(next.library),
  }
}

/** Identical shared libraries are harmless; conflicting layers need explicit resolution.
 * Compare localized semantic models, never document whitespace or bare element IDs.
 */
async function dependencyDocumentCacheKey(document) {
  return (await digest(['sc2-trigger-dependency-v1', document.xml, document.triggerStrings ?? ''])).value
}

// Presentation is bounded, verification is not.  An error after the display
// cap must still prevent a fidelity claim even if its individual diagnostic is
// no longer present in the UI slice.
function hasError(items) {
  return items.some(item => item.severity === 'error')
}

function validationFailed(verification) {
  return verification?.status === 'failed' || (verification?.errors ?? 0) > 0
}

function retainDependencyDocument(state, key, loaded, sourceBytes) {
  if (state.maxEntries === 0 || sourceBytes > state.maxSourceBytes) return
  while (state.entries.size >= state.maxEntries || state.sourceBytes + sourceBytes > state.maxSourceBytes) {
    const oldest = state.entries.keys().next().value
    if (oldest === undefined) break
    const removed = state.entries.get(oldest)
    state.entries.delete(oldest)
    state.sourceBytes -= removed.sourceBytes
    state.evictions++
  }
  if (sourceBytes > state.maxSourceBytes) return
  state.entries.set(key, { loaded, sourceBytes })
  state.sourceBytes += sourceBytes
  state.stores++
}

async function loadSemanticDocument(document, signal, contextState) {
  if (document.parsed !== undefined) {
    const strings = new Map(document.triggerStrings === undefined ? [] : [...document.parsed.keys()].map(id => [id, document.triggerStrings]))
    return readTriggerLibrariesFast([document.parsed], strings)
  }
  if (!contextState || contextState.maxEntries === 0 || contextState.maxSourceBytes === 0) {
    const parsed = parseTriggerXmlSync(document.xml)
    const strings = new Map(document.triggerStrings === undefined ? [] : [...parsed.keys()].map(id => [id, document.triggerStrings]))
    return readTriggerLibrariesFast([parsed], strings)
  }
  await checkpoint(signal)
  const key = await dependencyDocumentCacheKey(document)
  const cached = contextState.entries.get(key)
  if (cached) {
    contextState.entries.delete(key)
    contextState.entries.set(key, cached)
    contextState.hits++
    return cached.loaded
  }
  contextState.misses++
  const parsed = parseTriggerXmlSync(document.xml)
  const strings = new Map(document.triggerStrings === undefined ? [] : [...parsed.keys()].map(id => [id, document.triggerStrings]))
  const loaded = await readTriggerLibrariesFast([parsed], strings)
  const sourceBytes = document.sourceBytes ?? encoder.encode(document.xml).byteLength + encoder.encode(document.triggerStrings ?? '').byteLength
  retainDependencyDocument(contextState, key, loaded, sourceBytes)
  return loaded
}

/** `excluded` names the libraries of the document being converted. A dependency marked as the same
 *  document (the whole Triggers of the mod a library belongs to) never supplies them, or a conversion
 *  would resolve references against the very library it has to reconstruct; it supplies the others.
 *  Another document that declares one of them is still a layer conflict. */
async function loadSemanticDocuments(documents, signal, limits, policy = 'strict', contextState, excluded = new Set()) {
  const results = new Map()
  const origins = new Map()
  const includes = new Map()
  const layers = []
  for (const [index, document] of documents.entries()) {
    await checkpoint(signal)
    const loaded = await loadSemanticDocument(document, signal, contextState)
    if (loaded.size === 0) throw new TypeError(`Trigger document ${index} has no library`)
    for (const [id, result] of loaded) {
      if (document.sameDocument && excluded.has(id)) continue
      const previous = results.get(id)
      if (previous) {
        if (canonicalJson(normalizeTriggerLibrary(previous.library)) === canonicalJson(normalizeTriggerLibrary(result.library))) continue
        const difference = layerDifference(previous, result)
        if (policy === 'first-document-wins') {
          layers.push({ libraryId: id, keptDocument: origins.get(id), supersededDocument: index, ...difference })
          continue
        }
        const error = new TypeError(`Conflicting Trigger library layers ${id} in documents ${origins.get(id)} and ${index}; supply one resolved library`)
        error.context = { conversionCode: 'LIBRARY_LAYER_CONFLICT', libraryId: id, documents: [origins.get(id), index], ...difference }
        throw error
      }
      results.set(id, result)
      origins.set(id, index)
      if (document.external) includes.set(id, dependencyIncludePath(document.sourcePath, id))
    }
    validateLibraries(results, limits)
  }
  return { libraries: results, layers, includes }
}

async function semanticLibraries(primaryParsed, input, signal) {
  return loadSemanticDocuments([
    { parsed: primaryParsed, triggerStrings: [input.triggerStrings, input.gameStrings].filter(value => value !== undefined).join('\n') || undefined },
    ...dependencyDocuments(input),
  ], signal, conversionLimits(input), libraryLayerPolicy(input), conversionContextState(input), new Set(primaryParsed.keys()))
}

async function semanticDependencyLibraries(dependencies, signal, limits, policy, contextState, excluded) {
  const { libraries, layers, includes } = await loadSemanticDocuments(dependencies, signal, limits, policy, contextState, excluded)
  return { libraries: withIncludePaths(new Map([...libraries].map(([id, result]) => [id, normalizeTriggerLibrary(result.library)])), includes), layers }
}

/** One diagnostic per library whose losing layer was dropped, so a resolved
 * conversion still says which document supplied the library and what the other
 * one held. */
function layerDiagnostics(layers) {
  return layers.map(layer => diagnostic(
    'sc2-triggers/library-layer-superseded',
    'warning',
    `Library ${layer.libraryId} was taken whole from document ${layer.keptDocument}; document ${layer.supersededDocument} declared a different body`,
    layer,
  ))
}

/** The map's Galaxy with the libraries it defines itself, as the editor compiles them: each one's
 *  declarations ahead of the map's, and its code, under a banner naming it, ahead of the map's code. */
function inlineEmbeddedLibraries(output, libraries) {
  const withoutIncludes = text => text.split('\n').filter(line => !/^\s*include\s+"[^"]*"\s*;?\s*$/u.test(line)).join('\n')
  const rule = `//${'-'.repeat(98)}`
  const code = libraries.map(({ id, name, output: compiled }) => `${rule}\n// Library: ${name ?? id}\n${rule}\n${withoutIncludes(compiled.script)}`)
  const header = libraries.map(({ output: compiled }) => withoutIncludes(compiled.header))
  return { ...output, header: afterIncludes(output.header, header.join('\n')), script: afterIncludes(output.script, code.join('\n')) }
}

/** Text inserted after the includes that open a Galaxy file (and the comments among them). */
function afterIncludes(text, insert) {
  const lines = text.split('\n')
  let last = -1
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim()
    if (/^include\s+"/u.test(line)) last = index
    else if (line !== '' && !line.startsWith('//')) break
  }
  lines.splice(last + 1, 0, insert)
  return lines.join('\n')
}

function primaryLibraryId(parsed, requested) {
  if (requested !== undefined) {
    if (typeof requested !== 'string' || !/^[A-Za-z0-9_]+$/u.test(requested)) {
      throw new TypeError('libraryId must be an ASCII identifier')
    }
    if (!parsed.has(requested))
      throw new TypeError(`source TriggerData has no library ${requested}`)
    return requested
  }
  const first = parsed.keys().next().value
  if (parsed.size > 1) throw new TypeError(`TriggerData contains multiple libraries; supply libraryId explicitly: ${[...parsed.keys()].join(', ')}`)
  if (first === undefined) throw new TypeError('source TriggerData has no semantic library')
  return first
}

function ensureOutputBound(output, maximum) {
  let bytes = 0
  for (const chunk of canonicalJsonChunks(output)) {
    bytes += encoder.encode(chunk).byteLength
    if (bytes > maximum) throw new RangeError(`conversion output exceeds ${maximum} UTF-8 bytes`)
  }
}

function provenance(direction) {
  return {
    direction,
    sourceCommit: triggerConverterProvenance.commit,
    sourceEntrypoints: triggerConverterProvenance.entrypoints,
    adaptation: 'modkit-blizzard/structured-trigger-galaxy@3',
    galaxyParser: 'modkit-blizzard/galaxy-language/language-core',
  }
}

export async function convertTriggersToGalaxy(primaryText, rawInput, signal) {
  throwIfAborted(signal)
  const input = record(rawInput ?? {}, 'trigger-to-galaxy')
  const generation = generationOptions(input)
  let declarations = galaxyDeclarations(input)
  const maximum = outputBound(input)
  const primary = boundedString(primaryText, 'triggerData', conversionLimits(input).maxInputBytes, true)
  boundedString(input.triggerStrings, 'triggerStrings', MAX_DEPENDENCY_BYTES)
  boundedString(input.gameStrings, 'gameStrings', MAX_DEPENDENCY_BYTES)
  const primaryParsed = parsePrimaryDocument(primary, input.libraryId ?? 'Map', input.documentKind)
  const libraryId = primaryLibraryId(primaryParsed, input.libraryId)
  const implicitDocument = primaryParsed.get(libraryId)?.implicit === true
  const { libraries, layers, includes } = await semanticLibraries(primaryParsed, input, signal)
  const library = libraries.get(libraryId)?.library
  if (library === undefined) throw new TypeError(`semantic library ${libraryId} is unavailable`)
  library.completeLocalizedValues = input.triggerStrings !== undefined && input.gameStrings !== undefined
  const allLibraries = withIncludePaths(new Map([...libraries].map(([id, result]) => [id, result.library])), includes)
  const nativeLibrary = allLibraries.get('Ntve')
  const suppliedDeclarations = declarations
  declarations = [...modelDeclarations(allLibraries, libraryId, declarations), ...declarations]
  await checkpoint(signal)
  // The libraries a map defines itself are compiled first, each as a library of this document, and
  // their code goes into the map's script (internal/embedded-libraries).
  const embeddedIds = implicitDocument ? [...primaryParsed.values()].filter(parsed => parsed.embedded).map(parsed => parsed.id) : []
  const embeddedOutputs = embeddedIds.map(id => {
    const embedded = allLibraries.get(id)
    embedded.completeLocalizedValues = library.completeLocalizedValues
    return { id, name: embedded.name, output: convertTriggerLibraryToGalaxyFull(embedded, nativeLibrary, allLibraries,
      { galaxyDeclarations: [...modelDeclarations(allLibraries, id, suppliedDeclarations), ...suppliedDeclarations] }) }
  })
  const compiled = convertTriggerLibraryToGalaxyFull(library, nativeLibrary, allLibraries,
    { ...generation, galaxyDeclarations: declarations, ...(embeddedIds.length ? { embeddedLibraries: embeddedIds } : {}) })
  const linked = embeddedOutputs.length ? inlineEmbeddedLibraries(compiled, embeddedOutputs) : compiled
  // The editor generates the Custom AI code from the CustomAI document: ai<Id>.galaxy and the map's part.
  const customAi = emitCustomAi(linked.script, input.customAi, library, libraryId, implicitDocument)
  const output = customAi ? { ...linked, script: customAi.script } : linked
  const customAiDeclarations = (customAi?.files ?? []).map(file => ({ fileName: file.fileName, text: file.text }))
  throwIfAborted(signal)

  // Libraries compiled into the script declare their own symbols; their model prototypes would declare them twice.
  const validationDeclarations = embeddedIds.length
    ? [...modelDeclarations(new Map([...allLibraries].filter(([id]) => !embeddedIds.includes(id))), libraryId, suppliedDeclarations), ...suppliedDeclarations]
    : declarations
  const validation = validateGalaxyOutput(output, libraryId, [...validationDeclarations, ...customAiDeclarations], input.strictSymbols)
  const diagnostics = [...layerDiagnostics(layers), ...validation.diagnostics]
  for (const id of customAi?.missing ?? []) {
    diagnostics.push(diagnostic('sc2-triggers/custom-ai-trigger-missing', 'warning', `CustomAI refers to trigger ${id}, which the document does not have`, { trigger: id }))
  }
  const rewritten = disposition(
    groupedElements(
      library,
      type => KNOWN_ELEMENT_TYPES.has(type) && !EDITOR_ONLY_TYPES.has(type),
      'lowered-to-galaxy',
    ),
  )
  const preserved = disposition(
    groupedElements(
      library,
      type => EDITOR_ONLY_TYPES.has(type),
      'editor-layout-preserved-in-galaxy-comments',
    ),
  )
  const dropped = disposition([])
  const unsupportedItems = groupedElements(
    library,
    type => !KNOWN_ELEMENT_TYPES.has(type),
    'unknown-trigger-element-type',
  )
  const authoredTypes = authoredElementTypeCounts(primary)
  const semanticTypes = new Map()
  for (const parsedLibrary of primaryParsed.values()) {
    for (const element of Object.values(parsedLibrary.elements ?? {})) {
      const type = String(element?.type ?? 'Unknown')
      semanticTypes.set(type, (semanticTypes.get(type) ?? 0) + 1)
    }
  }
  for (const [type, authoredCount] of [...authoredTypes].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const gap = authoredCount - (semanticTypes.get(type) ?? 0)
    if (gap <= 0) continue
    unsupportedItems.push({
      kind: 'semantic-reader-element-type',
      type,
      count: gap,
      reason: 'element-type-outside-pinned-library-model',
    })
  }
  const valueGameTypeCount = (primary.match(/<ValueGameType\b/gu) ?? []).length
  if (valueGameTypeCount > 0) {
    unsupportedItems.push({
      kind: 'trigger-xml-field',
      field: 'ValueGameType',
      count: valueGameTypeCount,
      reason: 'field-not-retained-by-pinned-semantic-reader',
    })
  }
  const labelReferenceCount = (primary.match(/<Label\b/gu) ?? []).length
  if (labelReferenceCount > 0) {
    unsupportedItems.push({
      kind: 'trigger-xml-field',
      field: 'Label',
      count: labelReferenceCount,
      reason: 'editor-label-reference-not-lowered',
    })
  }
  const unsupported = disposition(unsupportedItems)
  if (dropped.count > 0) {
    diagnostics.push(
      diagnostic(
        'sc2-triggers/editor-hierarchy-dropped',
        'warning',
        `${dropped.count} Category/Label elements do not have Galaxy runtime syntax`,
      ),
    )
  }
  const readerRemainder = unsupportedItems
    .filter(
      item => item.kind === 'semantic-reader-element-type' || item.kind === 'trigger-xml-field',
    )
    .reduce((total, item) => total + item.count, 0)
  if (readerRemainder > 0) {
    diagnostics.push(
      diagnostic(
        'sc2-triggers/semantic-reader-remainder',
        'warning',
        `${readerRemainder} TriggerData elements or fields are outside the pinned semantic model`,
      ),
    )
  }
  const boundedDiagnostics = limitedDiagnostics(diagnostics)
  const fidelity = {
    direction: 'trigger-to-galaxy',
    sourceFormat: 'sc2-triggers',
    targetFormat: 'galaxy',
    preserved,
    rewritten,
    dropped,
    unsupported,
    completeness:
      dropped.count === 0 &&
      unsupported.count === 0 &&
      !hasError(diagnostics) &&
      !validationFailed(validation.verification)
        ? 'complete'
        : 'partial',
    diagnostics: boundedDiagnostics,
    verification: { galaxyValidation: validation.verification },
    provenance: provenance('trigger-to-galaxy'),
  }
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
      ...(customAi?.files.length ? { customAiScripts: customAi.files } : {}),
    },
    fidelity,
  }
  const result = { ...base, digest: await digest(base, maximum) }
  throwIfAborted(signal)
  return result
}

function statementName(statement) {
  return statement.name?.name ?? statement.name ?? ''
}

/** The document's other Galaxy files to convert with the script; opt-in through convertAdditionalScripts. */
function convertedAdditionalScripts(input) {
  if (input.convertAdditionalScripts !== true) return []
  if (!Array.isArray(input.additionalScripts)) throw new TypeError('additionalScripts must be an array of { fileName, text }')
  return input.additionalScripts.map((file, index) => {
    if (typeof file?.fileName !== 'string' || !file.fileName) throw new TypeError(`additionalScripts[${index}].fileName must be a non-empty string`)
    return { fileName: file.fileName, text: boundedString(file.text, `additionalScripts[${index}].text`, MAX_DEPENDENCY_BYTES, true) }
  })
}

/**
 * The script with the first include of each offered file replaced by the file's text, followed through
 * the files' own includes; a repeated include is dropped, as Galaxy includes a file once. `included`
 * lists the files reached this way.
 */
function inlineIncludes(script, files) {
  const key = name => name.replaceAll('\\', '/').replace(/\.galaxy$/iu, '').toLowerCase()
  const byKey = new Map(files.map(file => [key(file.fileName), file]))
  const reached = new Set()
  const expand = text => text.split(/(\r?\n)/u).map(line => {
    const target = /^\s*include\s+"([^"]+)"\s*;?\s*$/u.exec(line)?.[1]
    const file = target === undefined ? undefined : byKey.get(key(target))
    if (!file) return line
    if (reached.has(file)) return ''
    reached.add(file)
    return expand(file.text)
  }).join('')
  const expanded = expand(script)
  return { script: expanded, included: files.filter(file => reached.has(file)) }
}

/** Names a Galaxy file defines at top level: functions with a body, globals and structures. */
function topLevelNames(sourceFile) {
  return sourceFile.statements.flatMap(node => {
    if (node.kind === SyntaxKind.FunctionDeclaration) return node.body ? [node.name.name] : []
    if (node.kind === SyntaxKind.VariableDeclaration || node.kind === SyntaxKind.StructDeclaration) return node.name?.name ? [node.name.name] : []
    return []
  })
}

/** Library ids of the InitLib calls in a map's InitLibs, in call order. */
function initLibraryIds(sourceFile) {
  const initLibs = sourceFile.statements.find(node => node.kind === SyntaxKind.FunctionDeclaration && node.name.name === 'InitLibs')
  return (initLibs?.body?.statements ?? []).flatMap(statement => {
    const expression = statement.kind === SyntaxKind.ExpressionStatement ? statement.expression : undefined
    const name = expression?.kind === SyntaxKind.CallExpression ? expression.expression?.name : undefined
    const id = typeof name === 'string' ? /^lib([A-Za-z0-9_]+)_InitLib$/u.exec(name)?.[1] : undefined
    return id === undefined ? [] : [id]
  })
}

function reverseStatementDisposition(sourceFile, libraryId) {
  const rewritten = new Map()
  const unsupported = new Map()
  const add = (target, reason, kind) => {
    const key = `${reason}:${kind}`
    const item = target.get(key) ?? { kind: 'galaxy-statement', syntaxKind: kind, count: 0, reason }
    item.count += 1
    target.set(key, item)
  }
  for (const statement of sourceFile.statements ?? []) {
    const kind = getKindName(statement.kind)
    const supportedKind =
      statement.kind === SyntaxKind.IncludeStatement ||
      statement.kind === SyntaxKind.FunctionDeclaration ||
      statement.kind === SyntaxKind.VariableDeclaration ||
      statement.kind === SyntaxKind.StructDeclaration
    if (supportedKind) {
      add(rewritten, 'reconstructed-as-trigger-semantics', kind)
    } else {
      add(unsupported, 'unsupported-galaxy-syntax', kind)
    }
  }
  return {
    rewritten: [...rewritten.values()].sort((left, right) =>
      `${left.reason}:${left.syntaxKind}`.localeCompare(`${right.reason}:${right.syntaxKind}`),
    ),
    unsupported: [...unsupported.values()].sort((left, right) =>
      `${left.reason}:${left.syntaxKind}`.localeCompare(`${right.reason}:${right.syntaxKind}`),
    ),
  }
}

function canonicalGalaxy(sourceFile) {
  return printer.printFile(sourceFile).replaceAll('\r\n', '\n').trim()
}

function exactTypeCounts(left, right) {
  return (
    canonicalJson(triggerLibraryTypeCounts(left)) === canonicalJson(triggerLibraryTypeCounts(right))
  )
}

function cleanSemanticValue(value, implicitLibrary) {
  if (value === undefined || value === false) return undefined
  if (Array.isArray(value)) return value.length ? value.map(child => cleanSemanticValue(child, implicitLibrary)) : undefined
  if (!value || typeof value !== 'object') return value
  const copy = { ...value }
  if (implicitLibrary !== undefined && (copy.library === implicitLibrary || copy.library === '')) delete copy.library
  if (copy.name && copy.identifier === undefined && copy.displayName === undefined) copy.identifier = copy.name
  if (copy.grammar !== undefined && copy.grammarSource === undefined) copy.grammarSource = 'xml'
  delete copy.catalogRefs
  if (copy.type === 'Param' && copy.array && !Array.isArray(copy.array)) copy.array = [copy.array]
  if (copy.type === 'FunctionDef') {
    copy.flags = functionFlags(copy).sort()
    delete copy.isFuncAction
    delete copy.isFuncCall
    delete copy.isSubFunction
  }
  return Object.fromEntries(Object.entries(copy)
    .map(([key, child]) => [key, cleanSemanticValue(child, implicitLibrary)])
    .filter(([, child]) => child !== undefined))
}

function semanticModelsEqual(left, right) {
  // In a map document a reference into the document itself is written without
  // a Library attribute, so naming the owning library and omitting it are the
  // same reference and must compare equal.
  const implicit = library => library.implicit === true ? String(library.id ?? '') : undefined
  const refs = (library, implicitLibrary) => library.items.map(item => ({
    type: item.type, ...(implicitLibrary === undefined ? { library: item.library ?? library.id } : {}), id: item.id,
  }))
  const leftImplicit = implicit(left), rightImplicit = implicit(right)
  if (canonicalJson(refs(left, leftImplicit)) !== canonicalJson(refs(right, rightImplicit))) return false
  const order = library => Object.values(library.elements).sort((a, b) =>
    `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`))
  const leftElements = order(left), rightElements = order(right)
  if (leftElements.length !== rightElements.length) return false
  // Compare one normalized element at a time. The previous whole-library
  // snapshot retained two cloned models and two giant JSON strings at once.
  for (let index = 0; index < leftElements.length; index++) {
    if (canonicalJson(cleanSemanticValue(leftElements[index], leftImplicit)) !==
        canonicalJson(cleanSemanticValue(rightElements[index], rightImplicit))) return false
  }
  return true
}

function semanticModelDifference(left, right) {
  const implicit = library => library.implicit === true ? String(library.id ?? '') : undefined
  const refs = (library, implicitLibrary) => library.items.map(item => ({
    type: item.type, ...(implicitLibrary === undefined ? { library: item.library ?? library.id } : {}), id: item.id,
  }))
  const leftImplicit = implicit(left), rightImplicit = implicit(right)
  const leftRefs = canonicalJson(refs(left, leftImplicit))
  const rightRefs = canonicalJson(refs(right, rightImplicit))
  if (leftRefs !== rightRefs) return { kind: 'root-items', left: leftRefs.slice(0, 2048), right: rightRefs.slice(0, 2048) }
  const order = library => Object.values(library.elements).sort((a, b) =>
    `${a.type}:${a.id}`.localeCompare(`${b.type}:${b.id}`))
  const leftElements = order(left), rightElements = order(right)
  if (leftElements.length !== rightElements.length) {
    return { kind: 'element-count', left: leftElements.length, right: rightElements.length }
  }
  for (let index = 0; index < leftElements.length; index++) {
    const leftValue = canonicalJson(cleanSemanticValue(leftElements[index], leftImplicit))
    const rightValue = canonicalJson(cleanSemanticValue(rightElements[index], rightImplicit))
    if (leftValue !== rightValue) {
      return {
        kind: 'element',
        index,
        leftKey: `${leftElements[index].type}:${leftElements[index].id}`,
        rightKey: `${rightElements[index].type}:${rightElements[index].id}`,
        left: leftValue.slice(0, 4096),
        right: rightValue.slice(0, 4096),
      }
    }
  }
  return undefined
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
}

function nameShapes(type, name) {
  const shaped = NAME_SHAPES[type]?.(name)
  const plain = sanitizeIdentifier(name)
  return shaped === undefined || shaped === plain ? [plain] : [plain, shaped]
}

// A Galaxy identifier may carry a scope prefix and, where two names sanitized
// alike, a disambiguating element id. Both are added by the generator, so both
// are stripped before the name underneath is looked up.
function galaxyNameShapes(identifier) {
  const shapes = new Set([identifier])
  for (const shape of [...shapes]) {
    const scoped = /^(?:lv|gv|gf|gt|ge)_(.+)$/u.exec(shape)
    if (scoped !== null) shapes.add(scoped[1])
  }
  for (const shape of [...shapes]) {
    const suffixed = /^(.+)_[0-9A-Fa-f]{8}$/u.exec(shape)
    if (suffixed !== null) shapes.add(suffixed[1])
  }
  return shapes
}

function mapEditorLabel(identifier) {
  // The map owns its namespace. `lib..._` and the generated role prefixes
  // belong to Galaxy linking, while the Trigger Editor wants the human-facing
  // part of the same symbol. Keep this deliberately structural: no library id
  // or user-defined identifier is recognized specially.
  const unscoped = identifier.replace(/^(?:lib[A-Za-z0-9_]+_)?g[vefts]_/u, '')
  return unscoped.replaceAll('_', ' ')
}

/** Takes back the authored names of reconstructed elements from the TriggerStrings of the document's
 *  locales, `[{ locale, strings }]` with the primary locale first. The editor spells an element's
 *  identifier from its name in the locale it was written in, so a name is looked up in every locale;
 *  `localizedNames` receives the element's name in each locale that has one. The model itself keeps
 *  one name: the document's reparse check compares it with what the editor reads. */
function recoverElementNames(library, localeStrings, implicitDocument = false, localizedNames = new Map()) {
  const recovered = []
  // A shape two different entries share identifies neither, so it is dropped
  // rather than guessed at.
  const byShape = new Map()
  for (const { strings } of localeStrings) {
    for (const [key, name] of strings) {
      const separator = key.indexOf(':')
      if (separator <= 0 || key.startsWith('Grammar:') || key.startsWith('Library:') || key.startsWith('ParamValue:')) continue
      const type = key.slice(0, separator)
      for (const shape of nameShapes(type, name)) {
        const shapeKey = `${type}\u0000${shape}`
        const found = byShape.get(shapeKey)
        if (found === undefined) byShape.set(shapeKey, { key, name })
        else if (found !== null && found.key !== key) byShape.set(shapeKey, null)
      }
    }
  }
  const primary = localeStrings[0]
  for (const element of Object.values(library.elements ?? {})) {
    // The reconstructed model carries the Galaxy spelling as `name`, which the
    // serializer prints as an <Identifier> the editor never wrote.
    const identifier = element.identifier ?? element.name
    if (typeof identifier !== 'string' || identifier.length === 0) continue
    let name
    let spelling
    // The Galaxy name of an element without a script prefix is its identifier whole:
    // Cold expedition's trigger handle `gt_Easy`, a variable, took the name of its
    // variable "Easy" (`gv_easy`) and was written as `Easy`.
    const unprefixed = element.flags?.includes('NoScriptPrefix') === true
    let key
    for (const candidate of unprefixed ? [identifier] : galaxyNameShapes(identifier)) {
      const found = byShape.get(`${element.type}\u0000${candidate}`)
      if (found && nameShapes(element.type, found.name).includes(candidate)) {
        name = found.name
        key = found.key
        spelling = candidate
        break
      }
    }
    if (name === undefined) continue
    // Explicit formal metadata already fixes the inline #PARAM contract.
    // A guessed caption with equivalent spelling cannot replace that identity.
    if (element.type === 'ParamDef' && element.identifier !== undefined &&
        element.displayName === element.identifier) continue

    localizedNames.set(element, new Map(localeStrings
      .filter(item => item.strings.has(key)).map(item => [item.locale, item.strings.get(key)])))
    // The primary locale names the element; the locale its identifier was spelled from
    // stands in when the primary one has no entry for it.
    const displayName = primary?.strings.get(key) ?? name
    element.displayName = displayName
    // A variable's name comes back with a lower-case initial. Spelled as written
    // in Galaxy instead (gv_AITargetPlayer for "AITargetPlayer"), the variable had
    // an explicit script identifier, which the editor writes as authored; like a
    // parsed <Identifier>, it is also the element's code name. So is the spelling of
    // an element whose name in the primary locale spells another identifier.
    if ((element.type === 'Variable' && spelling !== NAME_SHAPES.Variable(name)) ||
        !nameShapes(element.type, displayName).includes(spelling)) {
      element.identifier = spelling
      element.name = spelling
    } else {
      element.name = displayName
      delete element.identifier
    }
    recovered.push({ type: element.type, id: element.id, name: displayName })
  }
  // Hand-written Galaxy has no companion TriggerStrings document to recover a
  // display label from. Its identifier is still authored information, though:
  // keep it as the script identifier and also emit it as a usable editor name.
  // Do not manufacture labels for internal calls/parameters whose identifiers
  // are not editor-facing elements.
  for (const element of Object.values(library.elements ?? {})) {
    if (!['FunctionDef', 'Trigger', 'Variable', 'ParamDef', 'Structure'].includes(element.type)) continue
    if (typeof element.displayName === 'string' && element.displayName.length > 0) continue
    const identifier = element.identifier ?? element.name
    if (typeof identifier !== 'string' || identifier.length === 0) continue
    // `name` is the model's code spelling for reconstructed elements.  The
    // serializer intentionally omits it when a display label exists, so retain
    // an explicit Identifier as well: Galaxy round-tripping still needs the
    // executable symbol while TriggerStrings gives the editor its label.
    element.identifier ??= identifier
    // TriggerStrings parsing deliberately trims editor-facing element names.
    // Apply the same normalization before the exact serialize/reparse gate so
    // an encoded identifier that decodes to boundary whitespace cannot make
    // the in-memory model disagree with the document the editor will read.
    const decodedDisplayName = implicitDocument ? mapEditorLabel(identifier) : identifier
    const displayName = decodedDisplayName.trim() || identifier
    element.displayName = displayName
    recovered.push({ type: element.type, id: element.id, name: displayName, source: 'galaxy-identifier' })
  }
  return recovered
}

// The companion document the editor reads names from. A map keys entries by the
// bare element id; a mod qualifies them with its library.
// With a locale, the names of that locale (see recoverElementNames); an element named only from
// its identifier has a name in the primary locale alone.
function serializeTriggerStrings(library, implicit, libraryName, nameOf = element => element.displayName) {
  const lines = []
  // A library document names itself in its strings (Library/Name/<Id>); a map has no name of its own.
  if (!implicit && libraryName) lines.push(`Library/Name/${library.id}=${libraryName}`)
  for (const element of Object.values(library.elements ?? {})) {
    const name = nameOf(element)
    const id = String(element.id ?? '')
    const type = String(element.type ?? '')
    if (typeof name !== 'string' || name.length === 0 || !id || !type) continue
    lines.push(`${type}/Name/${implicit ? id : `lib_${library.id}_${id}`}=${name}`)
  }
  if (lines.length === 0) return ''
  return `\ufeff${lines.sort().join('\n')}\n`
}

/** The name of a library document: its authored TriggerStrings entry, else the banner the editor
 * writes over the library's code ("// Library: <name>"), else the line Modkit writes ("// LibraryName: <name>"). */
function sourceLibraryName(libraryId, triggerStrings, script) {
  const authored = triggerStrings ? parseTriggerStrings(triggerStrings).get(`Library:${libraryId}`) : undefined
  return authored || /^\/\/ Library: (.+?)\s*$/mu.exec(script)?.[1] || /^\/\/ LibraryName: (.+?)\s*$/mu.exec(script)?.[1]
}

// A text keeps its parameter's id in every locale, so a key the document changes (a library
// written as map code drops its lib_<id>_) changes alike in all of them.
function serializeGameStrings(library, implicit, textOf = element => element.localizedValue) {
  const lines = []
  for (const element of Object.values(library.elements ?? {})) {
    const text = textOf(element)
    if (element.type !== 'Param' || text === undefined) continue
    const id = String(element.id ?? '')
    if (!id) continue
    const value = String(text).replace(/[\r\n]/gu, ' ')
    lines.push(`Param/Value/${implicit ? id : `lib_${library.id}_${id}`}=${value}`)
  }
  return lines.length ? `\ufeff${lines.sort().join('\n')}\n` : ''
}

export async function convertGalaxyToTriggers(rawInput, signal) {
  throwIfAborted(signal)
  const input = record(rawInput, 'galaxy-to-triggers')
  const split = embeddedLibrarySplit(input)
  return split ? convertMapWithEmbeddedLibraries(input, split, signal) : convertGalaxyDocumentToTriggers(input, signal)
}

/** A map script that defines trigger libraries of its own, cut into their code and the map's
 *  (internal/embedded-libraries). Only a script that defines a library startup can carry one. */
function embeddedLibrarySplit(input) {
  if (!documentIsImplicit(input) || typeof input.script !== 'string') return undefined
  // An explicit startup request (preserve, an entry point) keeps the script's startup graph as written.
  if (input.initialization !== undefined || input.entryPoint !== undefined) return undefined
  if (!/^[ \t]*void[ \t]+lib[A-Za-z0-9_]+_InitLib[ \t]*\(/mu.test(input.script)) return undefined
  const script = boundedString(input.script, 'script', MAX_DEPENDENCY_BYTES, true)
  const source = parseGalaxySource(script, 'MapScript.galaxy')
  const split = splitEmbeddedLibraries(script, source)
  return split && { ...split, startedBefore: librariesStartedBefore(source, split.libraries.map(library => library.id)) }
}

/** The libraries the map starts before each library it defines: the lib<X>_InitLib calls ahead of
 *  lib<Id>_InitLib in the one function that calls it (InitLibs; SkyFall's own `run`). */
function librariesStartedBefore(source, ids) {
  const calls = node => Array.from(node.body?.statements ?? []).map(statement =>
    statement.kind === SyntaxKind.ExpressionStatement && statement.expression?.kind === SyntaxKind.CallExpression &&
    statement.expression.arguments?.length === 0 && statement.expression.expression?.kind === SyntaxKind.Identifier
      ? statement.expression.expression.name : undefined)
  const functions = Array.from(source.statements).filter(node => node.kind === SyntaxKind.FunctionDeclaration && node.body)
  const started = new Map()
  for (const id of ids) {
    const callers = functions.filter(node => calls(node).includes(`lib${id}_InitLib`))
    if (callers.length !== 1) continue
    const body = calls(callers[0])
    started.set(id, body.slice(0, body.indexOf(`lib${id}_InitLib`))
      .map(name => /^lib([A-Za-z0-9]+)_InitLib$/u.exec(name ?? '')?.[1]).filter(other => other !== undefined))
  }
  return started
}

/** Each library the map defines is converted as the library it is, with the map's dependencies and
 *  the libraries before it; then the map's rest, with all of them. The result is one map document:
 *  the map's content, then a <Library> block per library, one TriggerStrings for all. */
async function convertMapWithEmbeddedLibraries(input, split, signal) {
  const dependencies = input.dependencyLibraries ?? []
  const declarations = input.galaxyDeclarations ?? []
  const libraries = []
  const context = () => ({
    dependencyLibraries: [...dependencies, ...libraries.map(library => ({
      triggerData: library.result.output.triggerData,
      ...(library.result.output.triggerStrings ? { triggerStrings: library.result.output.triggerStrings } : {}),
      ...(library.result.output.gameStrings ? { gameStrings: library.result.output.gameStrings } : {}),
      sameDocument: true,
    }))],
    galaxyDeclarations: [...declarations, ...libraries.map(library => ({ fileName: `Lib${library.id}.galaxy`, text: library.script }))],
  })
  for (const part of split.libraries) {
    const result = await convertGalaxyDocumentToTriggers({
      ...input, ...context(),
      libraryId: part.id, documentKind: 'library', script: part.script, header: '',
      initialization: undefined, entryPoint: undefined, convertAdditionalScripts: undefined, additionalScripts: undefined,
      ...(split.startedBefore?.has(part.id) ? { initializedDependencies: split.startedBefore.get(part.id) } : {}),
    }, signal)
    // A startup the library keeps as written (an InitCustomScript stage, say) needs
    // generation options of its own, and the map's Triggers carry one set for the
    // whole document: compiled together, the editor would add a second InitLib.
    // The map is then converted whole, its libraries' code in the map as before.
    if (result.output.generationOptions) return convertGalaxyDocumentToTriggers({ ...input, keptEmbeddedLibrary: part.id }, signal)
    libraries.push({ id: part.id, script: part.script, result })
  }
  const map = await convertGalaxyDocumentToTriggers({
    ...input, ...context(), script: split.map, embeddedLibraries: libraries.map(library => library.id),
  }, signal)
  return mergeEmbeddedLibraryResults(map, libraries, outputBound(input))
}

/** One map document from the map's result and the results of the libraries it defines. */
async function mergeEmbeddedLibraryResults(map, libraries, maximum) {
  const results = [map, ...libraries.map(library => library.result)]
  const outputs = results.map(result => result.output)
  const blocks = libraries.map(library => {
    const block = /[ \t]*<Library\b[\s\S]*<\/Library>/u.exec(library.result.output.triggerData)?.[0]
    if (!block) throw new TypeError(`converted library ${library.id} has no <Library> block`)
    return block
  })
  const close = map.output.triggerData.lastIndexOf('</TriggerData>')
  const triggerData = `${map.output.triggerData.slice(0, close).replace(/\s*$/u, '\n')}${blocks.join('\n')}\n${map.output.triggerData.slice(close)}`
  const triggerStrings = mergedStrings(outputs.map(output => output.triggerStrings))
  const gameStrings = mergedStrings(outputs.map(output => output.gameStrings))
  // Each locale's files from the same locale of every part.
  const localizedStrings = (map.output.localizedStrings ?? []).map(({ locale }) => {
    const parts = outputs.map(output => output.localizedStrings?.find(item => item.locale === locale))
    const names = mergedStrings(parts.map(part => part?.triggerStrings)), texts = mergedStrings(parts.map(part => part?.gameStrings))
    return { locale, ...(names ? { triggerStrings: names } : {}), ...(texts ? { gameStrings: texts } : {}) }
  })
  const typeCounts = {}
  for (const output of outputs) for (const [type, count] of Object.entries(output.typeCounts ?? {})) typeCounts[type] = (typeCounts[type] ?? 0) + count
  const fidelities = results.map(result => result.fidelity)
  const verifications = fidelities.map(fidelity => fidelity.verification)
  const all = key => verifications.every(verification => verification[key] === true)
  const exact = key => verifications.some(verification => verification[key] === null || verification[key] === undefined) ? null : all(key)
  const worst = key => verifications.find(verification => validationFailed(verification[key]))?.[key] ?? verifications[0][key]
  const fidelity = {
    ...map.fidelity,
    rewritten: disposition(fidelities.flatMap(item => item.rewritten.items)),
    unsupported: disposition(fidelities.flatMap(item => item.unsupported.items)),
    completeness: fidelities.every(item => item.completeness === 'complete') ? 'complete' : 'partial',
    diagnostics: limitedDiagnostics([
      ...libraries.map(library => diagnostic('sc2-triggers/embedded-library', 'info',
        `Library ${library.id}, defined by the map itself, was converted as its own library in the map's Triggers`, { libraryId: library.id })),
      ...fidelities.flatMap(item => item.diagnostics),
    ]),
    verification: {
      ...verifications[0],
      generatedTriggerDataReparsed: all('generatedTriggerDataReparsed'),
      elementCountExact: all('elementCountExact'),
      typeCountsExact: all('typeCountsExact'),
      semanticModelExact: all('semanticModelExact'),
      galaxyScriptCanonicalExact: exact('galaxyScriptCanonicalExact'),
      galaxyHeaderCanonicalExact: exact('galaxyHeaderCanonicalExact'),
      galaxyValidation: worst('galaxyValidation'),
      sourceGalaxyValidation: worst('sourceGalaxyValidation'),
    },
  }
  const base = {
    schemaVersion: 1,
    operation: 'galaxy-to-triggers',
    output: {
      ...map.output,
      triggerData,
      ...(triggerStrings ? { triggerStrings, triggerStringsFileName: 'TriggerStrings.txt' } : {}),
      ...(gameStrings ? { gameStrings, gameStringsFileName: 'GameStrings.txt' } : {}),
      ...(localizedStrings.length ? { localizedStrings } : {}),
      elements: outputs.reduce((total, output) => total + (output.elements ?? 0), 0),
      typeCounts,
    },
    fidelity,
  }
  return { ...base, digest: await digest(base, maximum) }
}

/** One strings file from several: each line once, sorted as the serializers write them. */
function mergedStrings(texts) {
  const lines = [...new Set(texts.filter(text => typeof text === 'string')
    .flatMap(text => text.replace(/^﻿/u, '').split(/\r?\n/u)).filter(line => line !== ''))]
  return lines.length ? `﻿${lines.sort().join('\n')}\n` : ''
}

async function convertGalaxyDocumentToTriggers(input, signal) {
  throwIfAborted(signal)
  const reportProgress = progressReporter(input, 'galaxy-to-triggers')
  reportProgress({ phase: 'input', completed: 0, total: 1 })
  const generation = generationOptions(input)
  const verification = reverseVerification(input)
  let declarations = galaxyDeclarations(input)
  const maximum = outputBound(input)
  // Set by convertMapWithEmbeddedLibraries for the map's rest: the libraries the map defines.
  const embeddedLibraries = input.embeddedLibraries ?? []
  const offeredScripts = convertedAdditionalScripts(input)
  // convertAdditionalScripts turns the document's other Galaxy files into triggers as well, each in its
  // own folder. Only the files the script includes: their text takes the place of the include, as the
  // compiler reads it. A file the script does not include stays a file.
  const sourceScript = boundedString(input.script, 'script', MAX_DEPENDENCY_BYTES, true)
  // The code the editor generated from the Custom AI document goes back into that document, not into
  // triggers: the map's ai<Id>.galaxy files, the section "Custom AI Functions" and InitCustomAI.
  const customAi = recoverCustomAi(sourceScript, customAiScriptFiles(input.customAiScripts, MAX_DEPENDENCY_BYTES))
  const authoredScript = customAi.state === 'recovered' ? customAi.value.script : sourceScript
  const { script, included: additionalScripts } = offeredScripts.length
    ? inlineIncludes(authoredScript, offeredScripts)
    : { script: authoredScript, included: [] }
  const skippedScripts = offeredScripts.filter(file => !additionalScripts.includes(file))
  const header = boundedString(input.header, 'header', MAX_DEPENDENCY_BYTES, true)
  const libraryId = input.libraryId
  if (typeof libraryId !== 'string' || !/^[A-Za-z0-9_]+$/u.test(libraryId)) {
    throw new TypeError('libraryId must be an ASCII identifier')
  }
  const implicitDocument = documentIsImplicit(input)
  reportProgress({ phase: 'input', completed: 1, total: 1 })
  const { primaryLocale, locales } = localizedStringSets(input)
  const primaryStrings = locales.find(item => item.locale === primaryLocale)
  const sourceTriggerStrings = boundedString(input.triggerStrings, 'triggerStrings', MAX_DEPENDENCY_BYTES) ?? primaryStrings?.triggerStrings
  const sourceGameStrings = boundedString(input.gameStrings, 'gameStrings', MAX_DEPENDENCY_BYTES) ?? primaryStrings?.gameStrings
  // The primary locale first, then the others the caller gave.
  const sourceLocales = [
    { locale: primaryLocale, triggerStrings: sourceTriggerStrings, gameStrings: sourceGameStrings },
    ...locales.filter(item => item.locale !== primaryLocale),
  ]
  const dependencyInput = { ...input, dependencyLibraries: input.dependencyLibraries ?? [] }
  const dependencies = dependencyDocuments(dependencyInput)
  reportProgress({ phase: 'dependencies', completed: 0, total: dependencies.length })
  const { libraries: allLibraries, layers } = await semanticDependencyLibraries(dependencies, signal, conversionLimits(input),
    libraryLayerPolicy(input), conversionContextState(input), new Set([libraryId]))
  reportProgress({ phase: 'dependencies', completed: dependencies.length, total: dependencies.length })
  declarations = [...modelDeclarations(allLibraries, libraryId, declarations), ...declarations]
  const nativeLibrary = allLibraries.get('Ntve')
  await checkpoint(signal)
  reportProgress({ phase: 'parse', completed: 0, total: 1 })
  const scriptSource = parseGalaxySource(script, `Lib${libraryId}.galaxy`)
  const headerSource = parseGalaxySource(header, `Lib${libraryId}_h.galaxy`)
  reportProgress({ phase: 'parse', completed: 1, total: 1 })
  // Recognizing the startup functions means knowing what they are called, and a
  // map calls them InitMap/InitLibs/InitGlobals rather than lib<Id>_Init*.
  const sourceRoot = withImplicitLibrary(implicitDocument ? libraryId : undefined, () =>
    preservedInitializationRoot([...headerSource.statements, ...scriptSource.statements], libraryId, generation.entryPoint))
  const standardStartupName = withImplicitLibrary(implicitDocument ? libraryId : undefined, () => startupFunctionName(libraryId, 'InitLib'))
  const standardStartupDefined = [...headerSource.statements, ...scriptSource.statements]
    .some(node => node.kind === SyntaxKind.FunctionDeclaration && node.body && node.name.name === standardStartupName)
  // A structurally complete editor-generated map startup graph is folded into
  // TriggerData and must be generated again on the forward path. Marking it as
  // `preserve` after the fold suppresses the regenerated InitMap/InitLibs graph
  // even though the original functions are no longer present in the XML.
  const generatedMapStartup = implicitDocument && generation.initialization === undefined && generation.entryPoint === undefined &&
    sourceRoot === withImplicitLibrary(libraryId, () => startupFunctionName(libraryId, 'InitLib'))
  // The editor writes a map's InitLibs itself: one InitLib call per library the
  // elements reference, in the document's library order. The generated startup
  // graph is folded even when InitLibs calls libraries of other packages;
  // keeping it turned every trigger initializer into a CustomScript FunctionDef
  // that the editor defines a second time. The source calls are compared with
  // the regenerated list once the elements exist.
  const sourceInitLibraries = generatedMapStartup ? initLibraryIds(scriptSource) : undefined
  // An arbitrary source file does not imply an editor library startup protocol.
  if (!sourceRoot && generation.initialization === undefined) generation.initialization = 'preserve'
  const customAiDeclarations = customAi.state === 'recovered' ? customAi.value.declarations : []
  const sourceValidation = validateGalaxyOutput({ script, header }, libraryId, [...declarations, ...customAiDeclarations], input.strictSymbols)
  const diagnostics = [...layerDiagnostics(layers), ...sourceValidation.diagnostics]
  if (customAi.state === 'kept') {
    diagnostics.push(diagnostic('sc2-triggers/custom-ai-kept', 'warning',
      `The Custom AI code stays Galaxy: ${customAi.reason}; the editor would not generate it as written`, { reason: customAi.reason, ...customAi.details }))
  }
  throwIfAborted(signal)
  resetGalaxyToTriggerIdCounter()
  // The source's strings name its elements by id, and they are applied to the reconstruction by id.
  // A fresh id equal to one of them would take that element's name: EditorTest.SC2Map, converted by
  // Modkit before, has A00008FC too, and a string variable came back named "auto2812FAE7 n". Fresh
  // ids avoid every id the source strings use; an id the conversion recovers from them is kept.
  for (const text of [sourceTriggerStrings, sourceGameStrings]) {
    for (const [, id] of (text ?? '').matchAll(/^[^\r\n=]*\/(?:lib_[A-Za-z0-9_]+_)?([0-9A-Fa-f]{8})=/gmu)) reserveGalaxyToTriggerId(id)
  }
  const constantFolds = []
  const droppedStartupCalls = []
  let reconstructed = normalizeTriggerLibrary(
    convertGalaxyToTriggerLibrary(scriptSource, headerSource, {
      libraryId,
      implicitLibrary: implicitDocument,
      allowTransparentConditionFunctions: input.allowTransparentConditionFunctions === true,
      ...(typeof input.libraryName === 'string' ? { libraryName: input.libraryName } : {}),
      nativeLibrary,
      dependencyLibraries: allLibraries,
      galaxyDeclarations: declarations,
      primaryGalaxyIncludeFiles: input.primaryGalaxyIncludeFiles,
      constantFolds,
      droppedStartupCalls,
      ...(Array.isArray(input.initializedDependencies) ? { initializedDependencies: input.initializedDependencies } : {}),
      preserveInitialization: generation.initialization === 'preserve' || !!generation.entryPoint,
      ...(additionalScripts.length ? { additionalScriptFolders: additionalScripts.map(file => ({
        fileName: file.fileName, names: topLevelNames(parseGalaxySource(file.text, file.fileName)),
      })) } : {}),
      onProgress: event => reportProgress({ ...event, phase: 'reconstruct', stage: event.phase }),
    }),
  )
  // The source AST is only needed to reconstruct the model and to establish
  // the later canonical/disposition comparisons. Retain those compact results,
  // not every source node, while serializing, reparsing, and regenerating the
  // library. This is especially material for large hand-written map scripts.
  const sourceScriptCanonical = verification === 'full' ? canonicalGalaxy(scriptSource) : undefined
  const sourceHeaderCanonical = verification === 'full' ? canonicalGalaxy(headerSource) : undefined
  // The document's own lobby attributes, as far as its scripts show them: the caller writes them when
  // the document has no Attributes of its own.
  const attributes = recoverAttributes([scriptSource, headerSource], sourceGameStrings)
  const scriptDisposition = reverseStatementDisposition(scriptSource, libraryId)
  const headerDisposition = reverseStatementDisposition(headerSource, libraryId)
  scriptSource.statements = []
  headerSource.statements = []
  finalPruneLocals(reconstructed.elements,reconstructed.id);
  const retirementOutcome=finalizeLocalRetirements(reconstructed.elements,reconstructed.id);
  finalPruneLocals(reconstructed.elements,reconstructed.id);
  const reconstructedElementCount = Object.keys(reconstructed.elements).length
  const reconstructedTypeCounts = triggerLibraryTypeCounts(reconstructed)
  reportProgress({ phase: 'reconstruct', stage: 'complete', completed: 1, total: 1, elements: reconstructedElementCount })
  for (const fold of constantFolds) diagnostics.push(diagnostic('sc2-triggers/constant-fold', 'info', 'Array length was evaluated from loaded Galaxy constants', fold))
  if (droppedStartupCalls.length) {
    diagnostics.push(diagnostic('sc2-triggers/startup-dependency-calls-dropped', 'info',
      `The library's InitLibraries also called the InitVariables of ${droppedStartupCalls.join(', ')}; the map starts those libraries first, so only the ones its elements reference are written again`,
      { libraryId, libraries: droppedStartupCalls }))
  }
  for (const file of skippedScripts) {
    diagnostics.push(diagnostic('sc2-triggers/additional-script-not-included', 'warning',
      `${file.fileName} stays a file: the script does not include it. A dependency may: a map file overrides the dependency file of the same path, and the dependency's code, compiled before the map's triggers, includes and calls it`,
      { fileName: file.fileName }))
  }
  if (sourceInitLibraries) {
    // The same list the Triggers -> Galaxy direction writes into InitLibs.
    const regenerated = [nativeLibrary?.id ?? 'Ntve', ...documentDependencies(reconstructed, allLibraries, embeddedLibraries)]
    if (regenerated.join(' ') !== sourceInitLibraries.join(' ')) {
      diagnostics.push(diagnostic('sc2-triggers/startup-libraries-differ', 'warning',
        `InitLibs is regenerated from element references as ${regenerated.join(', ')}; the source called ${sourceInitLibraries.join(', ')}`,
        { source: sourceInitLibraries, regenerated }))
    }
  }
  if (input.keptEmbeddedLibrary !== undefined) {
    diagnostics.push(diagnostic('sc2-triggers/embedded-library-kept', 'info',
      `Library ${input.keptEmbeddedLibrary}, defined by the map itself, keeps its startup as written, so the map is converted whole with that library's code in it`,
      { libraryId: input.keptEmbeddedLibrary }))
  }
  if (reconstructedElementCount > conversionLimits(input).maxLibraryElements) {
    throw new RangeError('reconstructed Trigger library exceeds the element bound')
  }
  await checkpoint(signal)
  reportProgress({ phase: 'reference-validation', completed: 0, total: 1, elements: reconstructedElementCount })
  try {assertConversionReferences(reconstructed, allLibraries)} catch(error) {error.context={...(error.context??{}),retirementOutcome,referenceOwnerElement:(()=>{try{const [l,t,id]=JSON.parse(error.context.owner);const e=reconstructed.elements[id];return e?.type===t&&(e.library??reconstructed.id)===l?e:null;}catch{return null;}})(),referenceOwnerTrace:describeReferenceFailure(reconstructed,error.context)};throw error;}
  reportProgress({ phase: 'reference-validation', completed: 1, total: 1, elements: reconstructedElementCount })
  if (implicitDocument) reconstructed.implicit = true
  const localeStrings = sourceLocales.map(item => ({ locale: item.locale,
    strings: parseTriggerStrings([item.triggerStrings, item.gameStrings].filter(value => value !== undefined).join('\n')) }))
  const localizedNames = new Map()
  const recoveredNames = recoverElementNames(reconstructed,
    localeStrings.filter((item, index) => index === 0 || sourceLocales[index].triggerStrings !== undefined), implicitDocument, localizedNames)
  if (sourceTriggerStrings || sourceGameStrings) {
    applyTriggerStringsByType(libraryId, reconstructed.elementsByType, localeStrings[0].strings)
  }
  // The texts of every locale, read by the same keys as the primary one.
  const localizedValues = new Map()
  if (locales.length > 0) {
    const params = Object.keys(reconstructed.elementsByType.Param ?? {})
    for (const { locale, strings } of localeStrings) {
      const values = { Param: Object.fromEntries(params.map(id => [id, {}])) }
      applyTriggerStringsByType(libraryId, values, strings)
      for (const id of params) {
        const text = values.Param[id].localizedValue
        if (text === undefined) continue
        const element = reconstructed.elementsByType.Param[id]
        if (!localizedValues.has(element)) localizedValues.set(element, new Map())
        localizedValues.get(element).set(locale, text)
      }
    }
  }
  for (const item of recoveredNames) {
    diagnostics.push(diagnostic('sc2-triggers/recovered-name', 'info', `Restored the authored name of ${item.type} ${item.id} from TriggerStrings`, item))
  }
  const triggerData = serializeTriggerLibrary(reconstructed)
  const triggerStrings = serializeTriggerStrings(reconstructed, implicitDocument,
    implicitDocument ? undefined : sourceLibraryName(libraryId, sourceTriggerStrings, script))
  const gameStrings = serializeGameStrings(reconstructed, implicitDocument)
  // Every locale the caller gave comes back, each in its own pair of files.
  const localizedOutput = locales.length === 0 ? [] : sourceLocales.map(item => {
    // An element named from its identifier alone has a name in the primary locale only.
    const names = serializeTriggerStrings(reconstructed, implicitDocument,
      implicitDocument ? undefined : sourceLibraryName(libraryId, item.triggerStrings, item.locale === primaryLocale ? script : undefined),
      element => localizedNames.has(element) ? localizedNames.get(element).get(item.locale)
        : item.locale === primaryLocale ? element.displayName : undefined)
    const texts = serializeGameStrings(reconstructed, implicitDocument, element => localizedValues.get(element)?.get(item.locale))
    return { locale: item.locale, ...(names.length > 0 ? { triggerStrings: names } : {}), ...(texts.length > 0 ? { gameStrings: texts } : {}) }
  })
  reportProgress({ phase: 'serialization', completed: 1, total: 1, elements: reconstructedElementCount })
  const reparsedMap = parsePrimaryDocument(triggerData, libraryId)
  const reparsed = reparsedMap.get(libraryId)
  // The pair is what the editor reads, so the pair is what has to reparse.
  if (reparsed !== undefined && (triggerStrings.length > 0 || gameStrings.length > 0)) {
    applyTriggerStringsByType(libraryId, reparsed.elementsByType, parseTriggerStrings(`${triggerStrings}\n${gameStrings}`))
  }
  const reparsedElementCount = reparsed === undefined ? undefined : Object.keys(reparsed.elements).length
  const elementCountExact = reparsedElementCount === reconstructedElementCount
  const typeCountsExact = reparsed !== undefined && exactTypeCounts(reparsed, reconstructed)
  const semanticDifference = reparsed === undefined ? { kind: 'missing-library', libraryId } : semanticModelDifference(reparsed, reconstructed)
  if (reparsed === undefined || !elementCountExact || !typeCountsExact || semanticDifference !== undefined) {
    throw new TypeError(`generated TriggerData failed exact semantic reparse checks: ${JSON.stringify({
      libraryId,
      reconstructedElementCount,
      reparsedElementCount,
      elementCountExact,
      typeCountsExact,
      semanticDifference,
    })}`)
  }
  let customAiOutput
  if (customAi.state === 'recovered') {
    const { conversion, missing } = recoveredCustomAiOutput(customAi.value, reparsed, libraryId, implicitDocument)
    customAiOutput = conversion
    diagnostics.push(diagnostic('sc2-triggers/custom-ai-recovered', 'info',
      `Custom AI ${customAi.value.document.definitions.map(item => `ai${item.id}`).join(', ')} read back into the CustomAI document`,
      { definitions: customAi.value.document.definitions.length, files: customAi.value.files.map(file => file.fileName) }))
    for (const name of missing) {
      diagnostics.push(diagnostic('sc2-triggers/custom-ai-trigger-missing', 'warning', `Custom AI runs ${name}, which is not a trigger of the document; the reference is dropped`, { function: name }))
    }
  }
  const startupPreserved = Object.values(reparsed.elementsByType.FunctionDef ?? {})
    .some(definition => definition.name === standardStartupName)
  reconstructed = undefined
  reportProgress({ phase: 'semantic-reparse', completed: 1, total: 1, elements: reconstructedElementCount })
  const unsupportedItems = [...scriptDisposition.unsupported, ...headerDisposition.unsupported]
  let roundTrip
  let outputVerification
  let scriptExact = null
  let headerExact = null
  if (verification === 'full') {
    reportProgress({ phase: 'galaxy-roundtrip', completed: 0, total: 1, elements: reconstructedElementCount })
    roundTrip = convertTriggerLibraryToGalaxyFull(reparsed, nativeLibrary, allLibraries, {
      ...generation,
      galaxyDeclarations: [...declarations, ...customAiDeclarations],
      ...(embeddedLibraries.length ? { embeddedLibraries } : {}),
      onProgress: event => reportProgress({ ...event, phase: 'galaxy-roundtrip', stage: event.phase }),
    })
    const roundTripScript = parseGalaxySource(roundTrip.script, `RoundTrip${libraryId}.galaxy`)
    const roundTripHeader = parseGalaxySource(roundTrip.header, `RoundTrip${libraryId}_h.galaxy`)
    const outputValidation = validateGalaxyOutput(roundTrip, libraryId, [...declarations, ...customAiDeclarations], input.strictSymbols, 'RoundTrip')
    reportProgress({ phase: 'galaxy-roundtrip', completed: 1, total: 1, elements: reconstructedElementCount })
    const sourceBindings = new Set(sourceValidation.declaredSymbols)
    const sourceUnresolved = new Set(sourceValidation.verification.unresolvedSymbols)
    const lostBindings = outputValidation.verification.unresolvedSymbols.filter(name => sourceBindings.has(name) && !sourceUnresolved.has(name))
    if (lostBindings.length) {
      outputValidation.verification.status = 'failed'
      outputValidation.verification.errors += lostBindings.length
      for (const name of lostBindings) outputValidation.diagnostics.push(diagnostic('sc2-triggers/galaxy-lost-binding', 'error', `Source declaration '${name}' is no longer bound in the generated Galaxy`, { symbol: name }))
    }
    outputValidation.verification.lostSourceBindings = lostBindings
    diagnostics.push(...outputValidation.diagnostics)
    outputVerification = outputValidation.verification
    scriptExact = sourceScriptCanonical === canonicalGalaxy(roundTripScript)
    headerExact = sourceHeaderCanonical === canonicalGalaxy(roundTripHeader)
    roundTripScript.statements = []
    roundTripHeader.statements = []
    if (!scriptExact) {
      unsupportedItems.push({
        kind: 'canonical-roundtrip',
        file: 'script',
        count: 1,
        reason: 're-emitted-galaxy-differs-after-reparse',
      })
    }
    if (!headerExact) {
      unsupportedItems.push({
        kind: 'canonical-roundtrip',
        file: 'header',
        count: 1,
        reason: 're-emitted-galaxy-differs-after-reparse',
      })
    }
    if (!scriptExact || !headerExact) {
      diagnostics.push(
        diagnostic(
          'sc2-triggers/reverse-roundtrip-difference',
          'warning',
          'Galaxy was reconstructed, reparsed, and compared canonically; at least one file differs',
          { scriptExact, headerExact },
        ),
      )
    }
  } else {
    reportProgress({ phase: 'galaxy-roundtrip', stage: 'deferred', completed: 0, total: 0, elements: reconstructedElementCount })
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
    }
    unsupportedItems.push({
      kind: 'verification',
      count: 1,
      reason: 'galaxy-roundtrip-deferred',
    })
    diagnostics.push(diagnostic(
      'sc2-triggers/reverse-roundtrip-deferred',
      'warning',
      'Galaxy roundtrip validation was deferred; TriggerData completed exact semantic reparse checks',
      { verification },
    ))
  }
  const rewritten = disposition([
    ...scriptDisposition.rewritten,
    ...headerDisposition.rewritten,
    {
      kind: 'trigger-element',
      count: reconstructedElementCount,
      reason: 'created-by-conservative-reconstruction',
    },
  ])
  const unsupported = disposition(unsupportedItems)
  const boundedDiagnostics = limitedDiagnostics(diagnostics)
  const fidelity = {
    direction: 'galaxy-to-triggers',
    sourceFormat: 'galaxy',
    targetFormat: 'sc2-triggers',
    preserved: disposition([]),
    rewritten,
    dropped: disposition([]),
    unsupported,
    completeness:
      unsupported.count === 0 &&
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
  }
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
      ...(localizedOutput.length > 0 ? { locale: primaryLocale, localizedStrings: localizedOutput } : {}),
      // The document the map's generated AI code came from; its ai<Id>.galaxy files are generated from it.
      ...(customAiOutput ? { customAi: customAiOutput, replacedScripts: customAi.value.files.map(file => file.fileName) } : {}),
      ...(attributes ? {
        recoveredAttributes: {
          document: writeAttributes(attributes.document),
          inferred: attributes.inferred,
          validation: attributes.validation,
          evidence: attributes.evidence,
          diagnostics: attributes.diagnostics,
        },
      } : {}),
      elements: reconstructedElementCount,
      typeCounts: reconstructedTypeCounts,
      // Their content now lives in TriggerData: a caller writing the document removes these files.
      ...(additionalScripts.length ? { convertedScripts: additionalScripts.map(file => file.fileName) } : {}),
      ...(roundTrip?.initialization
        ? { generationOptions: { initialization: 'preserve', ...(roundTrip.initialization.entryPoint ? { entryPoint: roundTrip.initialization.entryPoint } : {}) } }
        : verification === 'semantic' && (sourceRoot || generation.initialization === 'preserve' || generation.entryPoint) &&
          (!standardStartupDefined || startupPreserved)
          ? { generationOptions: { initialization: 'preserve', ...(generation.entryPoint ? { entryPoint: generation.entryPoint } : {}) } }
          : {}),
    },
    fidelity,
  }
  reportProgress({ phase: 'output-bound', completed: 0, total: 1, elements: reconstructedElementCount })
  reportProgress({ phase: 'digest', completed: 0, total: 1, elements: reconstructedElementCount })
  const result = { ...base, digest: await digest(base, maximum) }
  reportProgress({ phase: 'output-bound', completed: 1, total: 1, elements: reconstructedElementCount })
  reportProgress({ phase: 'digest', completed: 1, total: 1, elements: reconstructedElementCount })
  throwIfAborted(signal)
  reportProgress({ phase: 'complete', completed: 1, total: 1, elements: reconstructedElementCount })
  return result
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
})


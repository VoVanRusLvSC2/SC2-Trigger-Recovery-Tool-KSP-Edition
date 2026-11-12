import { HASH_TYPE, mpqDecrypt, mpqEncrypt, mpqHash } from '@modkit/codec-kit/crypto'
import {
  nativePreservingFidelity,
  snapshotNativePreservingMpq,
  validateNativePreservingChange,
} from './native-preserving.js'

const PROVIDER_ID = 'blizzard/mpq-fresh-writer'
const OFFER_ID = 'mpq-fresh-archive-v1'
const NATIVE_OFFER_ID = 'mpq-native-preserving-v1'

const HEADER_BYTES = 32
const HASH_ENTRY_BYTES = 16
const BLOCK_ENTRY_BYTES = 16
const FILE_EXISTS = 0x80000000
const FILE_SINGLE_UNIT = 0x01000000
const EMPTY_BLOCK = 0xffffffff
const DELETED_BLOCK = 0xfffffffe
const MAX_UINT32 = 0xffffffff

export const MPQ_NATIVE_REPACK_UNSUPPORTED =
  'blizzard/mpq-native-preserving-repack-unsupported'
export const MPQ_SOURCE_SNAPSHOT_UNSTABLE = 'blizzard/mpq-source-snapshot-unstable'
export const MPQ_FRESH_PACK_UNSUPPORTED = 'blizzard/mpq-fresh-pack-unsupported'

const error = (code, message) => Object.freeze({ severity: 'error', code, message })

const codedTypeError = (code, message) => {
  const result = new TypeError(message)
  Object.defineProperty(result, 'code', { value: code, enumerable: true })
  return result
}

const abort = signal => {
  if (signal?.aborted) throw new DOMException('operation cancelled', 'AbortError')
}

function record(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined
}

function portablePath(path, label = 'MPQ entry') {
  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    path.includes('\0') ||
    path.includes('\\') ||
    path.startsWith('/') ||
    /^[A-Za-z]:/u.test(path) ||
    /[<>:"|?*]/u.test(path) ||
    path.length > 1_024 ||
    !/^[\x20-\x7e]+$/u.test(path)
  ) {
    throw new TypeError(`${label} path «${String(path)}» is not a portable ASCII relative path`)
  }
  const parts = path.split('/')
  if (parts.some(part => part === '' || part === '.' || part === '..')) {
    throw new TypeError(`${label} path «${path}» contains an empty or traversal segment`)
  }
  return parts.join('/')
}

function archiveNameOf(value) {
  const path = portablePath(value, 'MPQ Save As')
  if (path.includes('/')) throw new TypeError('MPQ Save As name must be one file inside the target')
  return path
}

const mpqPathHash = (input, type) => mpqHash(input.replaceAll('/', '\\'), type)

const ENCODE_COPY_CHUNK_BYTES = 1_048_576
const ENCODE_YIELD_BYTES = 4_194_304
const ENCODE_YIELD_OPERATIONS = 2_048

async function cooperativeCheckpoint(signal) {
  abort(signal)
  await new Promise(resolve => setTimeout(resolve, 0))
  abort(signal)
}
function decryptTable(input, key) {
  if (input.byteLength % 4 !== 0) throw new TypeError('MPQ table is not word aligned')
  return mpqDecrypt(input, key >>> 0)
}

function strictFreshMpqBlockIndex(name, hashData, hashEntries) {
  const view = new DataView(hashData.buffer, hashData.byteOffset, hashData.byteLength)
  const expectedA = mpqPathHash(name, HASH_TYPE.HASH_A)
  const expectedB = mpqPathHash(name, HASH_TYPE.HASH_B)
  const start = mpqPathHash(name, HASH_TYPE.TABLE_OFFSET) % hashEntries
  for (let probe = 0; probe < hashEntries; probe += 1) {
    const slot = (start + probe) % hashEntries
    const offset = slot * HASH_ENTRY_BYTES
    const blockIndex = view.getUint32(offset + 12, true)
    if (blockIndex === EMPTY_BLOCK) return undefined
    if (
      blockIndex !== DELETED_BLOCK &&
      view.getUint32(offset, true) === expectedA &&
      view.getUint32(offset + 4, true) === expectedB &&
      view.getUint16(offset + 8, true) === 0 &&
      view.getUint16(offset + 10, true) === 0
    ) {
      return blockIndex
    }
  }
  return undefined
}

/** Strictly validates the one canonical fresh-archive layout this provider is allowed to plan. */
function validateFreshMpqEnvelope(bytes, sourceEntryCount) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < HEADER_BYTES) {
    throw new TypeError('fresh MPQ payload is truncated')
  }
  if (bytes[0] !== 0x4d || bytes[1] !== 0x50 || bytes[2] !== 0x51 || bytes[3] !== 0x1a) {
    throw new TypeError('fresh MPQ payload has no version-0 archive header')
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const headerSize = view.getUint32(4, true)
  const archiveSize = view.getUint32(8, true)
  const version = view.getUint16(12, true)
  const sectorShift = view.getUint16(14, true)
  const hashOffset = view.getUint32(16, true)
  const blockOffset = view.getUint32(20, true)
  const hashEntries = view.getUint32(24, true)
  const blockEntries = view.getUint32(28, true)
  if (
    headerSize !== HEADER_BYTES ||
    archiveSize !== bytes.byteLength ||
    version !== 0 ||
    sectorShift !== 3 ||
    blockEntries !== sourceEntryCount + 1 ||
    hashEntries < blockEntries * 2 ||
    hashEntries < 4 ||
    (hashEntries & (hashEntries - 1)) !== 0
  ) {
    throw new TypeError('fresh MPQ header does not match its declared canonical encoding')
  }
  const hashBytes = hashEntries * HASH_ENTRY_BYTES
  const blockBytes = blockEntries * BLOCK_ENTRY_BYTES
  if (
    !Number.isSafeInteger(hashBytes) ||
    !Number.isSafeInteger(blockBytes) ||
    hashOffset < HEADER_BYTES ||
    blockOffset !== hashOffset + hashBytes ||
    bytes.byteLength !== blockOffset + blockBytes
  ) {
    throw new RangeError('fresh MPQ table bounds do not match the archive')
  }
  const hashData = decryptTable(
    bytes.slice(hashOffset, blockOffset),
    mpqHash('(hash table)', HASH_TYPE.TABLE),
  )
  const blockData = decryptTable(bytes.slice(blockOffset), mpqHash('(block table)', HASH_TYPE.TABLE))
  const hashView = new DataView(hashData.buffer, hashData.byteOffset, hashData.byteLength)
  const usedBlocks = new Set()
  for (let index = 0; index < hashEntries; index += 1) {
    const offset = index * HASH_ENTRY_BYTES
    const blockIndex = hashView.getUint32(offset + 12, true)
    if (blockIndex === EMPTY_BLOCK) {
      if (
        hashView.getUint32(offset, true) !== 0 ||
        hashView.getUint32(offset + 4, true) !== 0 ||
        hashView.getUint16(offset + 8, true) !== 0 ||
        hashView.getUint16(offset + 10, true) !== 0
      ) {
        throw new TypeError('fresh MPQ empty hash slots are not canonical')
      }
      continue
    }
    if (blockIndex === DELETED_BLOCK) {
      throw new TypeError('fresh MPQ canonical hash table contains no deleted slots')
    }
    if (blockIndex >= blockEntries || usedBlocks.has(blockIndex)) {
      throw new TypeError('fresh MPQ hash table does not name each canonical block exactly once')
    }
    usedBlocks.add(blockIndex)
  }
  if (usedBlocks.size !== blockEntries) {
    throw new TypeError('fresh MPQ hash table omits a canonical block')
  }
  const blockView = new DataView(blockData.buffer, blockData.byteOffset, blockData.byteLength)
  const blocks = []
  let payloadOffset = HEADER_BYTES
  for (let index = 0; index < blockEntries; index += 1) {
    const offset = index * BLOCK_ENTRY_BYTES
    const at = blockView.getUint32(offset, true)
    const archivedSize = blockView.getUint32(offset + 4, true)
    const size = blockView.getUint32(offset + 8, true)
    const flags = blockView.getUint32(offset + 12, true)
    if (
      at !== payloadOffset ||
      archivedSize !== size ||
      flags !== (FILE_EXISTS | FILE_SINGLE_UNIT) >>> 0 ||
      size > hashOffset - at
    ) {
      throw new TypeError('fresh MPQ block table violates stored single-unit encoding')
    }
    blocks.push(Object.freeze({ at, size }))
    payloadOffset += size
  }
  if (payloadOffset !== hashOffset) {
    throw new TypeError('fresh MPQ payload region is not canonical and contiguous')
  }
  const listfileIndex = strictFreshMpqBlockIndex('(listfile)', hashData, hashEntries)
  const listfileBlock =
    listfileIndex === undefined || listfileIndex >= blocks.length
      ? undefined
      : blocks[listfileIndex]
  if (listfileBlock === undefined) throw new TypeError('fresh MPQ has no canonical listfile block')
  const listfile = new TextDecoder('utf-8', { fatal: true }).decode(
    bytes.subarray(listfileBlock.at, listfileBlock.at + listfileBlock.size),
  )
  if (!listfile.endsWith('\r\n')) throw new TypeError('fresh MPQ listfile is not CRLF terminated')
  const listedPaths = listfile.slice(0, -2)
  const paths = listedPaths === '' ? [] : listedPaths.split('\r\n')
  if (paths.length !== sourceEntryCount) {
    throw new TypeError('fresh MPQ listfile count does not match semanticIntent.entryCount')
  }
  const namedBlocks = new Set([listfileIndex])
  const folded = new Set()
  for (const listedPath of paths) {
    const path = portablePath(listedPath.replaceAll('\\', '/'))
    const key = path.toLowerCase()
    if (key === '(listfile)' || folded.has(key)) {
      throw new TypeError('fresh MPQ listfile contains a reserved or duplicate path')
    }
    folded.add(key)
    const blockIndex = strictFreshMpqBlockIndex(path, hashData, hashEntries)
    if (blockIndex === undefined || blockIndex >= blockEntries || namedBlocks.has(blockIndex)) {
      throw new TypeError(`fresh MPQ listfile path «${path}» does not own one canonical block`)
    }
    namedBlocks.add(blockIndex)
  }
  if (namedBlocks.size !== blockEntries) {
    throw new TypeError('fresh MPQ listfile does not cover the complete block table')
  }
}

function hashTableSize(entryCount) {
  let size = 4
  while (size < entryCount * 2) size *= 2
  if (!Number.isSafeInteger(size) || size > MAX_UINT32) {
    throw new RangeError('MPQ hash table size overflows')
  }
  return size
}

function checkedTotal(parts, maximum) {
  let total = 0
  for (const part of parts) {
    total += part
    if (!Number.isSafeInteger(total) || total > MAX_UINT32 || total > maximum) {
      throw new RangeError('fresh MPQ exceeds the output budget')
    }
  }
  return total
}

/**
 * One canonical fresh-MPQ encoder expressed as bounded work steps. The synchronous public helper
 * drains the same machine immediately; the public write routes drain it with macrotask yields.
 */
function* encodeFreshMpqSteps(sourceEntries, maximumBytes, options) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new TypeError('fresh MPQ maximumBytes must be a positive safe integer')
  }
  if (!Array.isArray(sourceEntries)) {
    throw new TypeError('fresh MPQ source entries must be an array')
  }
  if (record(options) === undefined || Object.keys(options).some(key => key !== 'signal')) {
    throw codedTypeError(
      MPQ_FRESH_PACK_UNSUPPORTED,
      'fresh MPQ encoder supports only the cancellation signal option',
    )
  }
  const { signal } = options
  abort(signal)
  let bytesSinceYield = 0
  let operationsSinceYield = 0
  function* worked(bytes = 0, operations = 1) {
    abort(signal)
    bytesSinceYield += bytes
    operationsSinceYield += operations
    if (
      bytesSinceYield >= ENCODE_YIELD_BYTES ||
      operationsSinceYield >= ENCODE_YIELD_OPERATIONS
    ) {
      bytesSinceYield = 0
      operationsSinceYield = 0
      yield undefined
      abort(signal)
    }
  }
  function* copy(target, targetOffset, source) {
    for (let offset = 0; offset < source.byteLength; offset += ENCODE_COPY_CHUNK_BYTES) {
      abort(signal)
      const end = Math.min(offset + ENCODE_COPY_CHUNK_BYTES, source.byteLength)
      target.set(source.subarray(offset, end), targetOffset + offset)
      yield* worked(end - offset)
    }
  }
  function* encrypt(input, key) {
    if (input.byteLength % 4 !== 0) throw new TypeError('MPQ table is not word aligned')
    // The cipher's state runs through the whole table, so it is one call; tables stay small.
    const output = mpqEncrypt(input, key >>> 0)
    yield* worked(output.byteLength, Math.ceil(output.byteLength / 4))
    return output
  }

  const entries = []
  const folded = new Set()
  let sourcePayloadBytes = 0
  for (const sourceEntry of sourceEntries) {
    abort(signal)
    const item = record(sourceEntry)
    const path = portablePath(item?.path)
    if (path.toLowerCase() === '(listfile)') {
      throw new TypeError('fresh MPQ reserves the internal (listfile) path')
    }
    const key = path.toLowerCase()
    if (folded.has(key)) throw new TypeError(`duplicate case-insensitive MPQ path «${path}»`)
    folded.add(key)
    if (!(item?.bytes instanceof Uint8Array)) {
      throw new TypeError(`fresh MPQ entry «${path}» has no byte payload`)
    }
    sourcePayloadBytes += item.bytes.byteLength
    if (
      item.bytes.byteLength > maximumBytes ||
      !Number.isSafeInteger(sourcePayloadBytes) ||
      sourcePayloadBytes > maximumBytes
    ) {
      throw new RangeError('fresh MPQ source payloads exceed the output budget')
    }
    const owned = new Uint8Array(item.bytes.byteLength)
    yield* copy(owned, 0, item.bytes)
    yield* worked(0)
    entries.push(Object.freeze({ path, bytes: owned }))
  }
  entries.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0))
  yield* worked(0, Math.max(1, entries.length))

  let listfileBytes = entries.length === 0 ? 2 : 0
  for (const entry of entries) {
    listfileBytes += entry.path.length + 2
    if (!Number.isSafeInteger(listfileBytes) || listfileBytes > maximumBytes) {
      throw new RangeError('fresh MPQ exceeds the output budget')
    }
  }
  const listfile = new Uint8Array(listfileBytes)
  let listfileOffset = 0
  for (const entry of entries) {
    for (const character of entry.path) {
      listfile[listfileOffset] = character === '/' ? 0x5c : character.charCodeAt(0)
      listfileOffset += 1
    }
    listfile[listfileOffset] = 0x0d
    listfile[listfileOffset + 1] = 0x0a
    listfileOffset += 2
    yield* worked(entry.path.length + 2)
  }
  if (entries.length === 0) {
    listfile[0] = 0x0d
    listfile[1] = 0x0a
  }

  const archivedEntries = [...entries, Object.freeze({ path: '(listfile)', bytes: listfile })]
  const hashEntries = hashTableSize(archivedEntries.length)
  const payloadBytes = archivedEntries.reduce((sum, item) => sum + item.bytes.byteLength, 0)
  const hashBytes = hashEntries * HASH_ENTRY_BYTES
  const blockBytes = archivedEntries.length * BLOCK_ENTRY_BYTES
  const total = checkedTotal([HEADER_BYTES, payloadBytes, hashBytes, blockBytes], maximumBytes)
  const hashOffset = HEADER_BYTES + payloadBytes
  const blockOffset = hashOffset + hashBytes
  const archive = new Uint8Array(total)
  const archiveView = new DataView(archive.buffer)
  archive.set(new TextEncoder().encode('MPQ\u001a'), 0)
  archiveView.setUint32(4, HEADER_BYTES, true)
  archiveView.setUint32(8, total, true)
  archiveView.setUint16(12, 0, true)
  archiveView.setUint16(14, 3, true)
  archiveView.setUint32(16, hashOffset, true)
  archiveView.setUint32(20, blockOffset, true)
  archiveView.setUint32(24, hashEntries, true)
  archiveView.setUint32(28, archivedEntries.length, true)

  const hashPlain = new Uint8Array(hashBytes)
  const hashView = new DataView(hashPlain.buffer)
  for (let firstSlot = 0; firstSlot < hashEntries; firstSlot += 4_096) {
    const endSlot = Math.min(firstSlot + 4_096, hashEntries)
    for (let slot = firstSlot; slot < endSlot; slot += 1) {
      hashView.setUint32(slot * HASH_ENTRY_BYTES + 12, EMPTY_BLOCK, true)
    }
    yield* worked((endSlot - firstSlot) * HASH_ENTRY_BYTES, endSlot - firstSlot)
  }
  const blockPlain = new Uint8Array(blockBytes)
  const blockView = new DataView(blockPlain.buffer)
  let payloadOffset = HEADER_BYTES
  for (const [index, entry] of archivedEntries.entries()) {
    yield* copy(archive, payloadOffset, entry.bytes)
    const blockBase = index * BLOCK_ENTRY_BYTES
    blockView.setUint32(blockBase, payloadOffset, true)
    blockView.setUint32(blockBase + 4, entry.bytes.byteLength, true)
    blockView.setUint32(blockBase + 8, entry.bytes.byteLength, true)
    blockView.setUint32(blockBase + 12, (FILE_EXISTS | FILE_SINGLE_UNIT) >>> 0, true)
    payloadOffset += entry.bytes.byteLength

    let slot = mpqPathHash(entry.path, HASH_TYPE.TABLE_OFFSET) % hashEntries
    let probes = 0
    while (hashView.getUint32(slot * HASH_ENTRY_BYTES + 12, true) !== EMPTY_BLOCK) {
      slot = (slot + 1) % hashEntries
      probes += 1
      if (probes >= hashEntries) throw new RangeError('fresh MPQ hash table is full')
    }
    const hashBase = slot * HASH_ENTRY_BYTES
    hashView.setUint32(hashBase, mpqPathHash(entry.path, HASH_TYPE.HASH_A), true)
    hashView.setUint32(hashBase + 4, mpqPathHash(entry.path, HASH_TYPE.HASH_B), true)
    hashView.setUint16(hashBase + 8, 0, true)
    hashView.setUint16(hashBase + 10, 0, true)
    hashView.setUint32(hashBase + 12, index, true)
    yield* worked(entry.path.length * 3, 1 + probes)
  }
  archive.set(
    yield* encrypt(hashPlain, mpqHash('(hash table)', HASH_TYPE.TABLE)),
    hashOffset,
  )
  archive.set(
    yield* encrypt(blockPlain, mpqHash('(block table)', HASH_TYPE.TABLE)),
    blockOffset,
  )
  abort(signal)
  return archive
}

/** Build a deterministic MPQ v0 with uncompressed, unencrypted, single-unit file payloads. */
export function encodeFreshMpq(sourceEntries, maximumBytes = 67_108_864, options = {}) {
  const steps = encodeFreshMpqSteps(sourceEntries, maximumBytes, options)
  for (;;) {
    const next = steps.next()
    if (next.done) return next.value
  }
}

/** Cooperative encoder for worker/application write paths; byte output is identical to sync. */
export async function encodeFreshMpqCooperative(
  sourceEntries,
  maximumBytes = 67_108_864,
  options = {},
) {
  const steps = encodeFreshMpqSteps(sourceEntries, maximumBytes, options)
  for (;;) {
    const next = steps.next()
    if (next.done) return next.value
    await cooperativeCheckpoint(options.signal)
  }
}

function nativeFeatureRefusal(intent) {
  if (intent.sourceMode === 'native-mpq') {
    return 'native MPQ preserving repack is not implemented; this writer creates a new archive from a loose namespace'
  }
  if (intent.preserveNativeLayout === true) return 'native MPQ layout preservation is not supported'
  if (intent.preserveNativeCompression === true)
    return 'native MPQ compression preservation is not supported'
  if (intent.preserveNativeEncryption === true)
    return 'native MPQ encryption preservation is not supported'
  if (intent.signForGame === true) return 'native game signing is not supported'
  if (Array.isArray(intent.unknownNativeFeatures) && intent.unknownNativeFeatures.length > 0) {
    return `unknown native MPQ features cannot be preserved: ${intent.unknownNativeFeatures.join(', ')}`
  }
  return undefined
}

function validationOf(change, context, signal) {
  abort(context.signal)
  abort(signal)
  const diagnostics = []
  const intent = record(change.semanticIntent)
  const refusal = intent === undefined ? undefined : nativeFeatureRefusal(intent)
  if (refusal !== undefined) {
    diagnostics.push(error(MPQ_NATIVE_REPACK_UNSUPPORTED, refusal))
    return Object.freeze({ valid: false, diagnostics: Object.freeze(diagnostics) })
  }
  if (
    intent?.kind !== 'mpq-fresh-archive-export-v1' ||
    intent.sourceMode !== 'loose-namespace' ||
    intent.completeSnapshot !== true ||
    intent.unknownDataPolicy !== 'preserve-entry-payloads-byte-for-byte' ||
    intent.archiveEncoding !== 'mpq-v0-stored-single-unit' ||
    intent.nativeRoundTrip !== false ||
    intent.nativeSigning !== false ||
    !Number.isSafeInteger(intent.entryCount) ||
    intent.entryCount < 0
  ) {
    diagnostics.push(
      error(
        'blizzard/mpq-fresh-export-intent-invalid',
        'fresh MPQ export requires one complete loose snapshot and explicit non-native encoding semantics',
      ),
    )
  }
  if (
    change.targets.length !== 1 ||
    change.targets[0].expectedRevision.namespaceRevision === undefined
  ) {
    diagnostics.push(
      error(
        'blizzard/mpq-fresh-export-target-not-namespace',
        'fresh MPQ Save As requires one revision-pinned destination namespace',
      ),
    )
  }
  const target = change.targets[0]
  const edit = change.edits[0]
  try {
    const archiveName = archiveNameOf(intent?.archiveName)
    if (
      change.edits.length !== 1 ||
      edit?.operation !== 'create' ||
      target === undefined ||
      edit.targetId !== target.targetId ||
      edit.source.id !== target.ownerSource.id ||
      edit.newPath !== archiveName ||
      edit.payload.kind !== 'inline'
    ) {
      throw new TypeError('fresh MPQ Save As accepts exactly one inline destination create')
    }
    if (
      edit.payload.bytes.byteLength > context.budgets.maxScalarBytes ||
      BigInt(edit.payload.bytes.byteLength) > context.budgets.maxInputBytes
    ) {
      throw new RangeError('fresh MPQ payload exceeds the provider resource budget')
    }
    validateFreshMpqEnvelope(edit.payload.bytes, intent.entryCount)
  } catch (cause) {
    diagnostics.push(
      error(
        'blizzard/mpq-fresh-export-edit-invalid',
        cause instanceof Error ? cause.message : String(cause),
      ),
    )
  }
  return Object.freeze({ valid: diagnostics.length === 0, diagnostics: Object.freeze(diagnostics) })
}

const fidelity = Object.freeze({
  roundTrip: 'semantic',
  preservesUnknownData: true,
  notes: Object.freeze([
    'every enumerated loose-namespace entry payload is stored byte-for-byte in a new MPQ v0 archive',
    'the archive layout is deterministic and deliberately does not preserve a prior MPQ layout or compression',
    'native encryption, patch entries, high-offset tables, signing, launch and playback are not claimed',
  ]),
})

export const abiVersion = 1
export const provides = Object.freeze(['common.edit/writer'])

function identityOf(context, representationId) {
  const providerIdentity = context?.providerIdentity
  if (
    providerIdentity === undefined ||
    providerIdentity.providerId !== PROVIDER_ID ||
    typeof providerIdentity.providerVersion !== 'string' ||
    providerIdentity.providerVersion.length === 0 ||
    typeof providerIdentity.artifactDigest !== 'string' ||
    providerIdentity.artifactDigest.length === 0
  ) {
    throw new TypeError('MPQ writer requires its exact host-attested provider identity')
  }
  return Object.freeze({
    ...providerIdentity,
    formatId: 'mpq',
    representationId,
  })
}

export function createProvider(selection, context) {
  if (
    selection.contract !== 'common.edit/writer' ||
    selection.major !== 1 ||
    ![OFFER_ID, NATIVE_OFFER_ID].includes(selection.offerId)
  ) {
    throw new TypeError(`unknown MPQ writer offer ${selection.offerId}`)
  }
  const nativePreserving = selection.offerId === NATIVE_OFFER_ID
  const selectedFidelity = nativePreserving ? nativePreservingFidelity : fidelity
  const identity = identityOf(context, nativePreserving ? 'native-source' : 'source')
  const writer = Object.freeze({
    identity,
    offer: Object.freeze({
      providerId: PROVIDER_ID,
      fidelityEvidenceId: nativePreserving
        ? 'mpq-native-preserving-writer-v1'
        : 'mpq-fresh-archive-writer-v1',
      formatId: 'mpq',
      representationId: nativePreserving ? 'native-source' : 'source',
      mutationMode: 'export-only',
      minimumRoundTrip: 'semantic',
    }),
    async validate(change, signal) {
      return nativePreserving
        ? validateNativePreservingChange(change, context, signal)
        : validationOf(change, context, signal)
    },
    async plan(change, signal) {
      const validation = nativePreserving
        ? await validateNativePreservingChange(change, context, signal)
        : validationOf(change, context, signal)
      if (!validation.valid) {
        throw new TypeError(validation.diagnostics.map(item => item.message).join('; '))
      }
      return Object.freeze({
        planId: `${PROVIDER_ID}:${selection.offerId}:${change.targets[0].targetId}`,
        targets: change.targets,
        edits: change.edits,
        semantics: Object.freeze({
          mutationMode: 'export-only',
          minimumGuarantee: nativePreserving ? 'atomic' : 'recoverable',
        }),
        fidelity: selectedFidelity,
        diagnostics: Object.freeze([]),
      })
    },
    ...(nativePreserving ? { snapshotNativePreservingMpq } : {}),
  })
  return Object.freeze({ value: writer, release: async () => undefined })
}

export { snapshotNativePreservingMpq }

/**
 * Snapshot a bounded loose namespace and produce the standard one-file Save As ChangeSet.
 * The source is read-only and the destination must be a separate revision-pinned directory.
 */
export async function snapshotFreshMpq(options) {
  const {
    source,
    sourcePrefix,
    sourceMode,
    target,
    archiveName: requestedArchiveName,
    signal,
    maxEntries = 4_096,
    maxEntryBytes = 16_777_216,
    maxTotalBytes = 67_108_864,
    maxOutputBytes = 67_108_864,
    pageLimit = 256,
  } = options
  abort(signal)
  if (sourceMode !== 'loose-namespace') {
    throw codedTypeError(
      MPQ_NATIVE_REPACK_UNSUPPORTED,
      'fresh MPQ export accepts only a loose namespace; native-preserving repack is unavailable',
    )
  }
  if (target.expectedRevision.namespaceRevision === undefined) {
    throw new TypeError('fresh MPQ Save As target is not a revision-pinned namespace')
  }
  for (const [name, value] of Object.entries({
    maxEntries,
    maxEntryBytes,
    maxTotalBytes,
    maxOutputBytes,
    pageLimit,
  })) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError(`${name} must be a positive safe integer`)
    }
  }
  const prefix = portablePath(sourcePrefix, 'fresh MPQ sourcePrefix')
  const archiveName = archiveNameOf(requestedArchiveName)
  if (
    typeof source?.list !== 'function' ||
    typeof source.read !== 'function' ||
    typeof source.currentRevision !== 'function'
  ) {
    throw codedTypeError(
      MPQ_SOURCE_SNAPSHOT_UNSTABLE,
      'fresh MPQ source must expose list/read/currentRevision for a stable complete snapshot',
    )
  }
  const sourceRevision = String(source.revision ?? '')
  if (sourceRevision === '') {
    throw codedTypeError(MPQ_SOURCE_SNAPSHOT_UNSTABLE, 'fresh MPQ source has no pinned revision')
  }
  const assertSourceRevision = async stage => {
    abort(signal)
    const current = String(await source.currentRevision(signal))
    abort(signal)
    if (current !== sourceRevision) {
      throw codedTypeError(
        MPQ_SOURCE_SNAPSHOT_UNSTABLE,
        `fresh MPQ source revision changed ${stage}`,
      )
    }
  }
  await assertSourceRevision('before listing')
  const paths = new Map()
  const folded = new Set()
  const cursors = new Set()
  let cursor
  do {
    abort(signal)
    const page = await source.list(
      `${prefix}/`,
      cursor === undefined ? { limit: pageLimit } : { cursor, limit: pageLimit },
      signal,
    )
    await assertSourceRevision('while listing')
    if (!Array.isArray(page.items) || page.items.length > pageLimit) {
      throw new TypeError('fresh MPQ source returned an invalid or overproduced page')
    }
    for (const item of page.items) {
      abort(signal)
      if (item.kind !== 'file') continue
      if (!item.path.startsWith(`${prefix}/`)) {
        throw new TypeError(`fresh MPQ source escaped prefix: ${item.path}`)
      }
      const path = portablePath(item.path.slice(prefix.length + 1))
      if (path.toLowerCase() === '(listfile)') {
        throw new TypeError('fresh MPQ source contains reserved internal path (listfile)')
      }
      const foldedPath = path.toLowerCase()
      if (folded.has(foldedPath)) {
        throw new TypeError(`duplicate case-insensitive MPQ path «${path}»`)
      }
      if (paths.size >= maxEntries) throw new RangeError('fresh MPQ source exceeds maxEntries')
      if (item.size !== undefined && item.size > BigInt(maxEntryBytes)) {
        throw new RangeError(`fresh MPQ entry ${path} exceeds maxEntryBytes`)
      }
      folded.add(foldedPath)
      paths.set(path, item.path)
    }
    if (page.nextCursor !== undefined) {
      if (page.nextCursor === cursor || cursors.has(page.nextCursor)) {
        throw new TypeError('fresh MPQ source repeated a page cursor')
      }
      cursors.add(page.nextCursor)
    }
    cursor = page.nextCursor
  } while (cursor !== undefined)
  await assertSourceRevision('after listing')

  let total = 0
  const entries = []
  for (const [path, sourcePath] of [...paths].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  )) {
    abort(signal)
    const bytes = await source.read(sourcePath, signal)
    abort(signal)
    await assertSourceRevision(`after reading ${path}`)
    if (!(bytes instanceof Uint8Array)) {
      throw new TypeError(`fresh MPQ read ${sourcePath} returned no bytes`)
    }
    if (bytes.byteLength > maxEntryBytes) {
      throw new RangeError(`fresh MPQ entry ${path} exceeds maxEntryBytes`)
    }
    total += bytes.byteLength
    if (total > maxTotalBytes) throw new RangeError('fresh MPQ source exceeds maxTotalBytes')
    entries.push(Object.freeze({ path, bytes: bytes.slice() }))
  }
  await assertSourceRevision('after reading entries')
  const archive = await encodeFreshMpqCooperative(entries, maxOutputBytes, { signal })
  validateFreshMpqEnvelope(archive, entries.length)
  return Object.freeze({
    targets: Object.freeze([target]),
    edits: Object.freeze([
      Object.freeze({
        operation: 'create',
        targetId: target.targetId,
        source: target.ownerSource,
        newPath: archiveName,
        payload: Object.freeze({ kind: 'inline', bytes: archive }),
      }),
    ]),
    semanticIntent: Object.freeze({
      kind: 'mpq-fresh-archive-export-v1',
      sourceMode: 'loose-namespace',
      completeSnapshot: true,
      unknownDataPolicy: 'preserve-entry-payloads-byte-for-byte',
      archiveEncoding: 'mpq-v0-stored-single-unit',
      nativeRoundTrip: false,
      nativeSigning: false,
      entryCount: entries.length,
      sourceRevision,
      archiveName,
    }),
    provenance: Object.freeze({ actor: 'user', note: 'bounded fresh MPQ Save As' }),
  })
}

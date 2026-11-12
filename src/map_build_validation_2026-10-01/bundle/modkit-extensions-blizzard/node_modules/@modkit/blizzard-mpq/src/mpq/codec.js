import {
  createInspectionCodec,
  createTreeDataSource,
  editPlanFromInput,
  replaceBytes,
} from '@modkit/codec-kit'
import { bzip2Decompress, decompressBounded } from '@modkit/codec-kit/compression'
import { containerEntryRevision, revisionId } from '@modkit/sdk'
import { HASH_TYPE, mpqDecrypt, mpqHash } from '@modkit/codec-kit/crypto'
import {
  encodeFreshMpq,
  encodeFreshMpqCooperative,
  MPQ_FRESH_PACK_UNSUPPORTED,
} from './fresh-writer.js'
import {
  encodeNativePreservingMpq,
  mpqProbeSlots,
  mpqTableEntries,
  nativePreservingFidelity,
  readNativeMpqSnapshot,
} from './native-preserving.js'
import { MPQ_RECOVERED_WRITE_UNSUPPORTED, recoverArchive } from './recovery.js'
import { decompressStormHuffman } from '../../dist/mpq/storm/huffman.js'
import { expandStormAdpcm } from '../../dist/mpq/storm/adpcm.js'

const ID = 'blizzard/mpq'
const FILE_IMPLODE = 0x00000100
const FILE_COMPRESS = 0x00000200
const FILE_ENCRYPTED = 0x00010000
const FILE_FIX_KEY = 0x00020000
const FILE_PATCH = 0x00100000
const FILE_SINGLE_UNIT = 0x01000000
const FILE_SECTOR_CRC = 0x04000000
const FILE_EXISTS = 0x80000000
const MPQ_HEADER_ALIGNMENT = 0x200
// Storm's per-sector compression mask.
const STORM_HUFFMAN = 0x01
const STORM_ZLIB = 0x02
const STORM_IMPLODE = 0x08
const STORM_BZIP2 = 0x10
const STORM_ADPCM_MONO = 0x40
const STORM_ADPCM_STEREO = 0x80
const STORM_MASKS = STORM_HUFFMAN | STORM_ZLIB | STORM_IMPLODE | STORM_BZIP2 | STORM_ADPCM_MONO | STORM_ADPCM_STEREO
const FILE_ANY_COMPRESSION = FILE_COMPRESS | FILE_IMPLODE
const MPQ_TABLE_RECOVERABLE = 'blizzard/mpq-table-recoverable'
const MAX_ARCHIVE_BYTES = 1_073_741_824

const freshPackFidelity = Object.freeze({
  roundTrip: 'semantic',
  preservesUnknownData: false,
  notes: Object.freeze([
    'every explicitly supplied named payload is stored byte-for-byte',
    'the prior archive is replaced by a deterministic MPQ v0 stored single-unit archive',
    'native layout, compression, encryption, unnamed blocks and signing are outside this mode',
  ]),
})

// MPQ hash tables do not retain filenames. These stable Blizzard container markers remain
// discoverable even when an archive omits its listfile or uses an unsupported listfile encoding.
const KNOWN_ENTRY_PATHS = Object.freeze([
  'DocumentHeader',
  'DocumentInfo',
  'ComponentList.SC2Components',
  'CampaignData',
  'MapInfo',
  'Objects',
  'MapObjects',
  'Regions',
  'MapRegions',
  't3HeightMap',
  'MapHeightMap',
  't3Terrain.xml',
  'Terrain',
  'Preload',
  't3SyncPathingInfo',
  'MapPathingInfo',
  'replay.details',
  'replay.initData',
  'replay.attributes.events',
  'replay.game.events',
  'replay.message.events',
  'replay.tracker.events',
])

function viewOf(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

function u16(bytes, offset) {
  return viewOf(bytes).getUint16(offset, true)
}

function u32(bytes, offset) {
  return viewOf(bytes).getUint32(offset, true)
}

function magic(bytes, offset = 0) {
  if (offset < 0 || offset + 4 > bytes.byteLength) return ''
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
}

function checkedSlice(bytes, offset, length, label) {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset > bytes.byteLength ||
    length > bytes.byteLength - offset
  ) {
    throw new RangeError(`MPQ ${label} is outside the archive`)
  }
  return bytes.slice(offset, offset + length)
}

/**
 * The archive's bytes by range: an archive held in memory, or a byte range source (`@modkit/sdk`
 * `ByteRangeSource`: `size()`, `read(offset, length, signal)`) over one that is not, so a
 * multi-gigabyte archive is read table by table and entry by entry. Offsets are archive-absolute.
 */
async function archiveSource(input, signal) {
  if (input instanceof Uint8Array) {
    return Object.freeze({
      size: input.byteLength,
      held: input,
      async read(offset, length, label) {
        return checkedSlice(input, offset, length, label)
      },
    })
  }
  if (typeof input?.size !== 'function' || typeof input?.read !== 'function') {
    throw new TypeError('MPQ reader input must be bytes or a byte range source')
  }
  const size = Number(await input.size())
  if (!Number.isSafeInteger(size) || size < 0) throw new RangeError('MPQ source size is invalid')
  return Object.freeze({
    size,
    held: undefined,
    async read(offset, length, label, readSignal) {
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 ||
        offset > size || length > size - offset) {
        throw new RangeError(`MPQ ${label} is outside the archive`)
      }
      if (length === 0) return new Uint8Array()
      const bytes = await input.read(BigInt(offset), length, readSignal ?? signal)
      if (!(bytes instanceof Uint8Array) || bytes.byteLength !== length) {
        throw new RangeError(`MPQ ${label} is truncated`)
      }
      return bytes
    },
  })
}

/** Whether `length` bytes at `offset` lie inside an archive of `size` bytes. */
function insideArchive(size, offset, length) {
  return Number.isSafeInteger(offset) && Number.isSafeInteger(length) && offset >= 0 && length >= 0 &&
    offset <= size && length <= size - offset
}

function record(value, label) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return value
}

function recoverableTableError(message, cause) {
  const result = new RangeError(message, cause === undefined ? undefined : { cause })
  Object.defineProperty(result, 'code', { value: MPQ_TABLE_RECOVERABLE, enumerable: true })
  return result
}

function codedTypeError(code, message) {
  const result = new TypeError(message)
  Object.defineProperty(result, 'code', { value: code, enumerable: true })
  return result
}

function recoveredWriteError() {
  const result = new TypeError(
    'recovered MPQ archives are read-only because their native table ownership is unavailable',
  )
  Object.defineProperty(result, 'code', {
    value: MPQ_RECOVERED_WRITE_UNSUPPORTED,
    enumerable: true,
  })
  return result
}

function recoveredEntryBytes(entry, signal) {
  signal?.throwIfAborted()
  return entry.recoveredBytes.slice()
}

function decodeBase64(value, label, maximumBytes = Number.MAX_SAFE_INTEGER) {
  if (typeof value === 'string' && value.length % 4 === 0) {
    const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0
    const decodedBytes = (value.length / 4) * 3 - padding
    if (decodedBytes > maximumBytes) {
      throw new RangeError(`${label} exceeds its ${maximumBytes}-byte bound`)
    }
  }
  if (
    typeof value !== 'string' ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)
  ) {
    throw new TypeError(`${label} must be canonical standard base64`)
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const canonicalPadding = value.endsWith('==')
    ? (alphabet.indexOf(value.at(-3) ?? '') & 0x0f) === 0
    : value.endsWith('=')
      ? (alphabet.indexOf(value.at(-2) ?? '') & 0x03) === 0
      : true
  if (!canonicalPadding) {
    throw new TypeError(`${label} must be canonical standard base64`)
  }
  const binary = atob(value)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

function assertOnlyKeys(value, allowed, label) {
  const unsupported = Object.keys(value).filter(key => !allowed.has(key))
  if (unsupported.length > 0) {
    throw codedTypeError(
      MPQ_FRESH_PACK_UNSUPPORTED,
      `${label} has unsupported field(s): ${unsupported.join(', ')}`,
    )
  }
}

function freshHashTableEntries(fileCount) {
  let entries = 4
  while (entries < (fileCount + 1) * 2) entries *= 2
  return entries
}

async function packCancellationCheckpoint(signal) {
  signal?.throwIfAborted()
  await new Promise(resolve => setTimeout(resolve, 0))
  signal?.throwIfAborted()
}

/**
 * Where an archive behind a header of its own starts: a Warcraft III map (`HM3W`) keeps a 512-byte
 * header before it, and Storm looks for the MPQ magic at every 512-byte boundary, as here.
 */
async function embeddedHeaderOffset(source, signal) {
  // A window is a whole number of 512-byte steps, so every boundary is checked in one of them.
  const window = MPQ_HEADER_ALIGNMENT * 2048
  for (let start = MPQ_HEADER_ALIGNMENT; start + 32 <= source.size; start += window) {
    signal?.throwIfAborted()
    const bytes = source.held === undefined
      ? await source.read(start, Math.min(window, source.size - start), 'header search')
      : source.held.subarray(start, Math.min(start + window, source.size))
    for (let at = 0; start + at + 32 <= source.size && at < bytes.byteLength; at += MPQ_HEADER_ALIGNMENT) {
      if (magic(bytes, at) === 'MPQ\u001a') return start + at
    }
  }
  return 0
}

function tableEntries(bytes, at) {
  return mpqTableEntries(u32(bytes, at))
}

async function parseHeader(source, signal) {
  if (source.size < 32) throw new TypeError('MPQ header is truncated')
  const start = await source.read(0, 32, 'header')
  let offset = 0
  let userDataBytes = 0
  if (magic(start) === 'MPQ\u001b') {
    userDataBytes = u32(start, 4)
    offset = u32(start, 8)
  }
  if (userDataBytes === 0 && magic(start) !== 'MPQ\u001a') offset = await embeddedHeaderOffset(source, signal)
  // The base header and, when the version says so, the 12 bytes that extend it.
  const bytes = insideArchive(source.size, offset, 4)
    ? await source.read(offset, Math.min(44, source.size - offset), 'header')
    : new Uint8Array()
  if (magic(bytes) !== 'MPQ\u001a') throw new TypeError('MPQ magic is missing')
  if (bytes.byteLength < 32) throw new RangeError('MPQ base header is outside the archive')
  const declaredVersion = u16(bytes, 12)
  const declaredSize = u32(bytes, 4)
  // A protected StarCraft II map carries junk in the declared size and version while its table
  // offsets stay intact, because the game reads only those. Read such an archive with the base
  // layout and report the repair instead of refusing a file the game itself loads. A header that
  // contradicts itself is the signal: a declared size which does not fit the file, with both tables
  // inside it. Anything else keeps its own diagnostic, and the tables must still decrypt and agree.
  const declaredSizeFits =
    declaredSize >= (declaredVersion === 0 ? 32 : 44) && offset + declaredSize <= source.size
  const tablesFit =
    offset + u32(bytes, 16) + tableEntries(bytes, 24) * 16 <= source.size &&
    offset + u32(bytes, 20) + tableEntries(bytes, 28) * 16 <= source.size
  const repaired = !declaredSizeFits && tablesFit
  if (!repaired) {
    if (declaredVersion > 3) throw new TypeError(`MPQ version ${declaredVersion} is not supported`)
    if (!declaredSizeFits) throw new TypeError('MPQ header size is invalid')
  }
  const version = repaired ? 0 : declaredVersion
  const headerSize = repaired ? 32 : declaredSize
  if (version > 0) {
    const extended = checkedSlice(bytes, 32, 12, 'extended header')
    const view = viewOf(extended)
    if (
      view.getBigUint64(0, true) !== 0n ||
      view.getUint16(8, true) !== 0 ||
      view.getUint16(10, true) !== 0
    ) {
      throw new TypeError('MPQ high-offset tables are not supported')
    }
  }
  return Object.freeze({
    offset,
    userDataBytes,
    headerSize,
    archivedSize: repaired ? source.size - offset : u32(bytes, 8),
    repaired,
    version,
    sectorShift: u16(bytes, 14),
    hashOffset: u32(bytes, 16),
    blockOffset: u32(bytes, 20),
    hashEntries: tableEntries(bytes, 24),
    blockEntries: tableEntries(bytes, 28),
  })
}

async function parseTables(source, header, maxNodes, signal) {
  if (header.hashEntries > maxNodes || header.blockEntries > maxNodes) {
    throw new RangeError(
      `MPQ tables exceed the node budget (${header.hashEntries} hash and ${header.blockEntries} block entries, budget ${maxNodes})`,
    )
  }
  const hashBytes = header.hashEntries * 16
  const blockBytes = header.blockEntries * 16
  if (!Number.isSafeInteger(hashBytes) || !Number.isSafeInteger(blockBytes)) {
    throw new RangeError('MPQ table size overflows')
  }
  const hashAt = header.offset + header.hashOffset
  const blockAt = header.offset + header.blockOffset
  if (!insideArchive(source.size, hashAt, hashBytes) || !insideArchive(source.size, blockAt, blockBytes)) {
    throw recoverableTableError('MPQ hash or block table is truncated or outside the archive')
  }
  const hashCipher = await source.read(hashAt, hashBytes, 'hash table', signal)
  const blockCipher = await source.read(blockAt, blockBytes, 'block table', signal)
  const hashData = mpqDecrypt(hashCipher, mpqHash('(hash table)', HASH_TYPE.TABLE))
  const blockData = mpqDecrypt(blockCipher, mpqHash('(block table)', HASH_TYPE.TABLE))
  const hashTable = []
  for (let index = 0; index < header.hashEntries; index += 1) {
    const offset = index * 16
    hashTable.push({
      hashA: u32(hashData, offset),
      hashB: u32(hashData, offset + 4),
      locale: u16(hashData, offset + 8),
      platform: u16(hashData, offset + 10),
      blockIndex: u32(hashData, offset + 12),
    })
  }
  const blockTable = []
  for (let index = 0; index < header.blockEntries; index += 1) {
    const offset = index * 16
    blockTable.push({
      index,
      offset: u32(blockData, offset),
      archivedSize: u32(blockData, offset + 4),
      size: u32(blockData, offset + 8),
      flags: u32(blockData, offset + 12),
    })
  }
  return Object.freeze({
    hashTable: Object.freeze(hashTable),
    blockTable: Object.freeze(blockTable),
  })
}

function validateTables(size, header, tables) {
  for (const entry of tables.hashTable) {
    if (
      entry.blockIndex !== 0xffffffff &&
      entry.blockIndex !== 0xfffffffe &&
      entry.blockIndex >= tables.blockTable.length
    ) {
      throw recoverableTableError('MPQ hash table references a missing block')
    }
  }
  for (const block of tables.blockTable) {
    if ((block.flags & FILE_EXISTS) === 0) continue
    const offset = header.offset + block.offset
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset > size ||
      block.archivedSize > size - offset
    ) {
      throw recoverableTableError(`MPQ block ${block.index} is outside the archive`)
    }
  }
}

function lookupCandidates(path) {
  const normalized = path.replaceAll('/', '\\')
  try {
    const decoded = decodeURIComponent(normalized)
    return decoded === normalized ? [normalized] : [normalized, decoded]
  } catch {
    return [normalized]
  }
}

function findBlock(path, tables) {
  if (tables.hashTable.length === 0) return undefined
  for (const candidate of lookupCandidates(path)) {
    const hashA = mpqHash(candidate, HASH_TYPE.HASH_A)
    const hashB = mpqHash(candidate, HASH_TYPE.HASH_B)
    for (const slot of mpqProbeSlots(mpqHash(candidate, HASH_TYPE.TABLE_OFFSET), tables.hashTable.length)) {
      const entry = tables.hashTable[slot]
      if (entry.blockIndex === 0xffffffff) break
      if (entry.blockIndex === 0xfffffffe) continue
      const block = tables.blockTable[entry.blockIndex]
      if (
        entry.hashA === hashA &&
        entry.hashB === hashB &&
        block !== undefined &&
        (block.flags & FILE_EXISTS) !== 0
      ) {
        return block
      }
    }
  }
  return undefined
}

async function decompressDeflate(payload, maxOutputBytes, signal) {
  if (typeof DecompressionStream !== 'function') {
    throw new TypeError('MPQ deflate decompression requires DecompressionStream')
  }
  const options = {
    maxOutputBytes,
    ...(signal === undefined ? {} : { signal }),
    outputLimitError: maximum =>
      new RangeError(`MPQ deflate output exceeds its ${maximum}-byte bound`),
  }
  try {
    return await decompressBounded(payload, 'deflate', options)
  } catch (error) {
    signal?.throwIfAborted()
    if (error instanceof RangeError) throw error
    try {
      // Pinned MK2 writers emitted raw DEFLATE under the standard MPQ 0x02 method byte.
      return await decompressBounded(payload, 'deflate-raw', options)
    } catch (rawError) {
      signal?.throwIfAborted()
      throw rawError
    }
  }
}

/**
 * PKWARE DCL, loaded only when an entry is imploded: the other entries never pay for it, and a
 * codec-kit without the decoder fails those entries alone rather than the whole archive.
 */
const PKWARE_DCL_MODULE = '@modkit/codec-kit/compression/pkware-dcl'

async function explode(payload, maxOutputBytes) {
  // Resolved when first called, not when the codec loads (the worker's module map has it too).
  const { explodePkwareDcl } = await import(/* @vite-ignore */ PKWARE_DCL_MODULE)
  return explodePkwareDcl(payload, { maxOutputBytes })
}

/**
 * One compressed sector. Its first byte is Storm's mask of the stages the writer applied;
 * they come off in the reverse of the order they went on — bzip2, implode, zlib, Huffman, ADPCM.
 */
async function decompressSector(data, label, maxOutputBytes, signal) {
  if (data.byteLength === 0) throw new TypeError(`MPQ compressed ${label} is empty`)
  const mask = data[0]
  if ((mask & ~STORM_MASKS) !== 0) {
    throw new TypeError(`MPQ compression 0x${mask.toString(16)} is not supported for ${label}`)
  }
  let payload = data.subarray(1)
  if ((mask & STORM_BZIP2) !== 0) {
    payload = bzip2Decompress(payload, { maxOutputBytes, ...(signal === undefined ? {} : { signal }) })
  }
  if ((mask & STORM_IMPLODE) !== 0) payload = await explode(payload, maxOutputBytes)
  if ((mask & STORM_ZLIB) !== 0) payload = await decompressDeflate(payload, maxOutputBytes, signal)
  if ((mask & STORM_HUFFMAN) !== 0) payload = decompressStormHuffman(payload, maxOutputBytes)
  if ((mask & STORM_ADPCM_STEREO) !== 0) payload = expandStormAdpcm(payload, maxOutputBytes, 2)
  if ((mask & STORM_ADPCM_MONO) !== 0) payload = expandStormAdpcm(payload, maxOutputBytes, 1)
  return mask === 0 ? data.slice(1) : payload
}

function assertReadable(block, label) {
  if ((block.flags & FILE_PATCH) !== 0) throw new TypeError(`MPQ patch entry: ${label}`)
}

/** A compressed unit of an entry: Storm's masked stages, or PKWARE alone under FILE_IMPLODE. */
function decompressUnit(block, data, label, maxOutputBytes, signal) {
  return (block.flags & FILE_IMPLODE) !== 0
    ? explode(data, maxOutputBytes)
    : decompressSector(data, label, maxOutputBytes, signal)
}

/**
 * The key an encrypted entry was written with: its file name hashed, and with FIX_KEY also
 * mixed with where the entry sits and how large it is. An entry the archive does not name has
 * no key to derive — `block/NNNN` stays unreadable rather than guessed at.
 */
function entryKey(block, label) {
  if ((block.flags & FILE_ENCRYPTED) === 0) return undefined
  if (/^block\/\d+$/u.test(label)) throw new TypeError(`MPQ encrypted entry has no name: ${label}`)
  const name = label.split(/[\\/]/u).at(-1) ?? label
  const key = mpqHash(name, HASH_TYPE.TABLE)
  return ((block.flags & FILE_FIX_KEY) !== 0 ? (key + block.offset) ^ block.size : key) >>> 0
}

/** One encrypted unit — a whole single-unit entry, a sector table or sector `index` — made plain. */
function plain(data, key, offset = 0) {
  return key === undefined ? data : mpqDecrypt(data, (key + offset) >>> 0)
}

/** Storm stores a unit uncompressed when compression would not shrink it, so this covers the tables. */
const ARCHIVED_OVERHEAD_BYTES = 1_048_576

async function readEntry(source, header, block, label, maxOutputBytes, signal) {
  signal?.throwIfAborted()
  assertReadable(block, label)
  const key = entryKey(block, label)
  if (block.size > maxOutputBytes) {
    throw new RangeError(`MPQ entry exceeds the ${maxOutputBytes}-byte decode budget: ${label}`)
  }
  if (block.archivedSize === 0) return new Uint8Array()
  if (block.archivedSize > maxOutputBytes + ARCHIVED_OVERHEAD_BYTES) {
    throw new RangeError(`MPQ entry's stored bytes exceed the ${maxOutputBytes}-byte decode budget: ${label}`)
  }
  // The entry's stored bytes, read once; everything below is relative to them.
  const bytes = await source.read(header.offset + block.offset, block.archivedSize, label, signal)
  if ((block.flags & FILE_SINGLE_UNIT) !== 0) {
    let data = plain(bytes, key)
    if ((block.flags & FILE_ANY_COMPRESSION) !== 0 && block.size > block.archivedSize) {
      data = await decompressUnit(block, data, label, block.size, signal)
    }
    if (data.byteLength !== block.size) throw new TypeError(`MPQ entry size mismatch: ${label}`)
    return data
  }
  if (header.sectorShift > 20) throw new TypeError('MPQ sector size is not supported')
  const sectorSize = 512 * 2 ** header.sectorShift
  if ((block.flags & FILE_ANY_COMPRESSION) === 0) {
    const data = bytes
    if (data.byteLength !== block.size) throw new TypeError(`MPQ entry size mismatch: ${label}`)
    if (key === undefined) return data
    // Stored sectors are encrypted one by one, each with its own index added to the key.
    const output = new Uint8Array(block.size)
    for (let start = 0, index = 0; start < block.size; start += sectorSize, index += 1) {
      output.set(plain(data.subarray(start, Math.min(start + sectorSize, block.size)), key, index), start)
    }
    return output
  }
  const sectorCount = Math.ceil(block.size / sectorSize)
  const positionCount = sectorCount + 1 + ((block.flags & FILE_SECTOR_CRC) !== 0 ? 1 : 0)
  // The sector table is encrypted with the key one below the first sector's.
  const table = plain(checkedSlice(bytes, 0, positionCount * 4, `${label} sector table`), key, -1)
  const positions = Array.from({ length: positionCount }, (_, index) => u32(table, index * 4))
  if (positions[0] < positionCount * 4) throw new TypeError(`MPQ invalid sector table: ${label}`)
  const output = new Uint8Array(block.size)
  let target = 0
  for (let index = 0; index < sectorCount; index += 1) {
    const start = positions[index]
    const end = positions[index + 1]
    if (end < start || end > block.archivedSize) throw new TypeError(`MPQ invalid sector: ${label}`)
    const expected = Math.min(sectorSize, block.size - target)
    let sector = plain(checkedSlice(bytes, start, end - start, `${label} sector ${index}`), key, index)
    if (sector.byteLength < expected) {
      sector = await decompressUnit(block, sector, `${label}#${index}`, expected, signal)
    }
    if (sector.byteLength !== expected) throw new TypeError(`MPQ sector size mismatch: ${label}`)
    output.set(sector, target)
    target += sector.byteLength
  }
  return output
}

async function parseArchive(source, maxNodes, maxEntryBytes, maxInputBytes, signal) {
  const header = await parseHeader(source, signal)
  let tables
  try {
    tables = await parseTables(source, header, maxNodes, signal)
    validateTables(source.size, header, tables)
  } catch (cause) {
    signal?.throwIfAborted()
    if (cause?.code !== MPQ_TABLE_RECOVERABLE) throw cause
    // Recovery scans the whole archive for blocks, so it needs the archive in memory.
    if (source.held === undefined && source.size > maxInputBytes) throw cause
    const bytes = source.held ?? await source.read(0, source.size, 'archive', signal)
    const recovery = await recoverArchive(bytes, header, {
      maxScanBytes: Math.min(maxInputBytes, 1_073_741_824),
      maxCandidates: Math.min(Math.max(maxNodes * 8, 1), 1_000_000),
      maxBlocks: Math.min(Math.max(maxNodes, 1), 1_000_000),
      maxDecodeAttempts: Math.min(Math.max(maxNodes * 64, 1), 1_000_000),
      maxDecodedEntryBytes: Math.min(maxEntryBytes, 1_073_741_824),
      maxTotalDecodedBytes: Math.min(maxInputBytes, 1_073_741_824),
      signal,
    })
    const blockTable = recovery.entries.map(entry =>
      Object.freeze({
        index: entry.index,
        offset: entry.offset - header.offset,
        archivedSize: entry.archivedSize,
        size: entry.size,
        flags: FILE_EXISTS | FILE_SINGLE_UNIT | FILE_COMPRESS,
      }),
    )
    const recoveredEntries = recovery.entries.map((entry, index) =>
      Object.freeze({
        id: entry.id,
        path: entry.id,
        name: entry.id.split('/').at(-1) ?? entry.id,
        block: blockTable[index],
        recoveredBytes: entry.bytes,
        recoveryMethod: entry.method,
      }),
    )
    return Object.freeze({
      header,
      tables: Object.freeze({
        hashTable: Object.freeze([]),
        blockTable: Object.freeze(blockTable),
      }),
      entries: Object.freeze(recoveredEntries),
      recovery,
      originalTableError: cause,
    })
  }
  const named = []
  const listBlock = findBlock('(listfile)', tables)
  if (listBlock !== undefined) {
    try {
      const listBytes = await readEntry(
        source,
        header,
        listBlock,
        '(listfile)',
        maxEntryBytes,
        signal,
      )
      named.push(
        ...new TextDecoder()
          .decode(listBytes)
          .split(/\r?\n/u)
          .map(path => path.trim().replaceAll('\\', '/'))
          .filter(path => path.length > 0),
      )
    } catch {
      signal?.throwIfAborted()
      // A stale or unsupported listfile must not hide the readable table entries.
    }
  }
  for (const known of [...KNOWN_ENTRY_PATHS, '(listfile)', '(attributes)']) {
    if (findBlock(known, tables) !== undefined) named.push(known)
  }
  const entries = []
  const used = new Set()
  for (const path of [...new Set(named)]) {
    const block = findBlock(path, tables)
    if (block === undefined || used.has(block.index)) continue
    used.add(block.index)
    entries.push({ id: path, path, name: path.split('/').at(-1) ?? path, block })
  }
  for (const block of tables.blockTable) {
    if ((block.flags & FILE_EXISTS) === 0 || used.has(block.index)) continue
    const id = `block/${String(block.index).padStart(4, '0')}`
    entries.push({ id, path: id, name: id, block })
  }
  entries.sort((left, right) => (left.path < right.path ? -1 : 1))
  return Object.freeze({ header, tables, entries: Object.freeze(entries) })
}

/** The user-data payload before the MPQ header (a replay's header lives there), if any. */
function userDataPreamble(bytes, header) {
  return header.userDataBytes === 0
    ? undefined
    : checkedSlice(bytes, 16, Math.min(header.userDataBytes, header.offset - 16), 'user-data payload')
}

function replayHeaderFacts(bytes, header) {
  const signature = new TextEncoder().encode('StarCraft II replay')
  const end = Math.min(bytes.byteLength, Math.max(16, header.offset), 16 + header.userDataBytes)
  for (let offset = 16; offset + signature.byteLength <= end; offset += 1) {
    if (signature.every((value, index) => bytes[offset + index] === value)) {
      return Object.freeze({ signature: 'StarCraft II replay', signatureOffset: offset })
    }
  }
  return Object.freeze({})
}

/**
 * The archive's own bookkeeping — `(listfile)`, `(attributes)`, `(signature)` and the like are
 * named in parentheses at the root — hidden from a viewer unless it asks for hidden entries.
 */
function internalMpqPath(path) {
  return /^\([^/]*\)$/u.test(path)
}

/**
 * An entry by id: a listed one, or — where the archive keeps no name for it, as War3Patch.mpq with
 * no (listfile) — the entry its hash table holds at that path, answered under the path asked for.
 */
function entryAt(archive, byId, id) {
  const listed = byId.get(id)
  if (listed !== undefined || id === '' || /^block\/\d+$/u.test(id)) return listed
  const block = findBlock(id, archive.tables)
  if (block === undefined) return undefined
  return { id, path: id, name: id.split(/[\\/]/u).at(-1) ?? id, block }
}

async function createFreshPackPlan(request, sourceBytes, context, signal) {
  assertOnlyKeys(
    request,
    new Set(['schemaVersion', 'mode', 'expectedContainerRevision', 'files']),
    'container.pack create input',
  )
  if (!Array.isArray(request.files)) {
    throw new TypeError('container.pack create files must be a bounded array')
  }
  const hashEntries = freshHashTableEntries(request.files.length)
  if (request.files.length > context.budget.maxNodes || hashEntries > context.budget.maxNodes) {
    throw new RangeError('container.pack create files exceed the codec node budget')
  }
  const maxArchiveBytes = Math.min(Number(context.budget.maxInputBytes), MAX_ARCHIVE_BYTES)
  const entries = []
  let sourcePayloadBytes = 0
  await packCancellationCheckpoint(signal)
  for (const [index, candidate] of request.files.entries()) {
    if (index % 32 === 0) await packCancellationCheckpoint(signal)
    const file = record(candidate, `container.pack create files[${index}]`)
    assertOnlyKeys(file, new Set(['name', 'bytesBase64']), `container.pack create files[${index}]`)
    const remainingBytes = maxArchiveBytes - sourcePayloadBytes
    if (remainingBytes < 0) {
      throw new RangeError('container.pack create payloads exceed the codec byte budget')
    }
    const value = decodeBase64(
      file.bytesBase64,
      `container.pack create files[${index}].bytesBase64`,
      Math.min(context.budget.maxScalarBytes, remainingBytes),
    )
    sourcePayloadBytes += value.byteLength
    if (!Number.isSafeInteger(sourcePayloadBytes) || sourcePayloadBytes > maxArchiveBytes) {
      throw new RangeError('container.pack create payloads exceed the codec byte budget')
    }
    entries.push({ path: file.name, bytes: value })
  }
  await packCancellationCheckpoint(signal)
  const outputBytes = await encodeFreshMpqCooperative(entries, maxArchiveBytes, { signal })
  await packCancellationCheckpoint(signal)
  const receipt = Object.freeze({
    kind: 'mpq-fresh-pack-receipt-v1',
    strategy: 'explicit-named-files-mpq-v0-stored-single-unit',
    files: entries.length,
    sourcePayloadBytes,
    archiveBytes: outputBytes.byteLength,
    listfile: 'generated',
  })
  return Object.freeze({
    kind: 'edit-plan',
    plan: editPlanFromInput(context.input, {
      planId: 'mpq-pack:fresh-create:explicit-named-files',
      edits: [
        replaceBytes(0, sourceBytes.byteLength, outputBytes, 'materialize fresh deterministic MPQ'),
      ],
      fidelity: freshPackFidelity,
      diagnostics: [
        Object.freeze({
          severity: 'information',
          code: 'blizzard/mpq-fresh-pack-receipt',
          message: JSON.stringify(receipt),
        }),
      ],
    }),
  })
}

const definition = Object.freeze({
  id: ID,
  version: '1.0.0',
  format: Object.freeze({ id: 'mpq', label: 'Blizzard MPQ archive' }),
  // An archive of any size opens by range; the entry table goes to the host (S3), which lists,
  // looks up and extracts through it.
  access: 'ranges',
  operations: Object.freeze([
    // The whole archive, where it fits the open's read budget (a map or a mod); larger is refused.
    Object.freeze({
      id: 'export.raw',
      handlerId: 'export-raw',
      mutatesSource: false,
      requiredPermissions: Object.freeze(['read-source']),
      outputKinds: Object.freeze(['bytes']),
    }),
    Object.freeze({
      id: 'container.extract',
      handlerId: 'extract-entry',
      mutatesSource: false,
      requiredPermissions: Object.freeze(['read-source']),
      outputKinds: Object.freeze(['bytes']),
    }),
    Object.freeze({
      id: 'container.pack',
      handlerId: 'pack-container',
      mutatesSource: true,
      requiredPermissions: Object.freeze(['read-source', 'write-source']),
      outputKinds: Object.freeze(['edit-plan']),
    }),
  ]),
  async detect(prefix, uri) {
    const matches = magic(prefix) === 'MPQ\u001a' || magic(prefix) === 'MPQ\u001b'
    const warcraftMap = magic(prefix) === 'HM3W' && magic(prefix, MPQ_HEADER_ALIGNMENT) === 'MPQ\u001a'
    let creationTarget = false
    if (prefix.byteLength === 0) {
      try {
        creationTarget = decodeURIComponent(new URL(uri).pathname).toLowerCase().endsWith('.mpq')
      } catch {
        creationTarget = /^[^?#]*\.mpq$/iu.test(String(uri))
      }
    }
    return matches
      ? { confidence: 0.99, kind: 'magic', note: 'MPQ header' }
      : warcraftMap
        ? { confidence: 0.99, kind: 'magic', note: 'Warcraft III map header before its MPQ' }
      : creationTarget
        ? { confidence: 0.9, kind: 'extension', note: 'empty .mpq creation target' }
        : { confidence: 0, kind: 'magic', note: 'signature-mismatch' }
  },
  async inspect(context) {
    const source = await archiveSource(context.byteSource, context.signal)
    const creationTarget = source.size === 0
    const archive = creationTarget
      ? Object.freeze({
          header: Object.freeze({ version: 0, headerSize: 0, userDataBytes: 0 }),
          entries: Object.freeze([]),
          tables: Object.freeze({ hashTable: Object.freeze([]), blockTable: Object.freeze([]) }),
        })
      : await parseArchive(
          source,
          context.budget.maxNodes,
          context.budget.maxScalarBytes,
          Math.min(Number(context.budget.maxInputBytes), 1_073_741_824),
          context.signal,
        )
    // Before the MPQ header: a replay's user-data block, read only as far as the payload it declares.
    const head = creationTarget || archive.header.userDataBytes === 0
      ? new Uint8Array()
      : await source.read(
          0,
          Math.min(source.size, Math.max(16, Math.min(archive.header.offset, 16 + archive.header.userDataBytes))),
          'user-data payload',
          context.signal,
        )
    const replay = creationTarget ? {} : replayHeaderFacts(head, archive.header)
    const preamble = creationTarget ? undefined : userDataPreamble(head, archive.header)
    /** The archive whole, for export.raw and the writers: within the open's read budget, refused past it. */
    const wholeArchive = signal => {
      if (BigInt(source.size) > context.budget.maxInputBytes) {
        throw new RangeError(
          `MPQ archive of ${source.size} bytes exceeds the ${context.budget.maxInputBytes}-byte budget of a whole-archive operation`,
        )
      }
      return source.read(0, source.size, 'archive', signal)
    }
    // An entry Storm compressed or encrypted is decoded here, within one scalar output as before.
    const decodeBudget = context.budget.maxScalarBytes
    /** One entry for the host's table: a plain range where it is stored as is, else decoded here. */
    const containerEntry = entry => {
      const { block } = entry
      const inPlace =
        entry.recoveredBytes === undefined &&
        (block.flags & (FILE_ANY_COMPRESSION | FILE_ENCRYPTED | FILE_PATCH)) === 0 &&
        block.archivedSize === block.size
      return Object.freeze({
        path: entry.path,
        size: BigInt(block.size),
        storage: inPlace
          ? Object.freeze({
              kind: 'stored',
              offset: BigInt(archive.header.offset + block.offset),
              length: BigInt(block.size),
            })
          : Object.freeze({
              kind: 'custom',
              async open(signal) {
                const bytes = entry.recoveredBytes === undefined
                  ? await readEntry(source, archive.header, block, entry.path, decodeBudget, signal)
                  : recoveredEntryBytes(entry, signal)
                return (async function* () {
                  yield bytes
                })()
              },
            }),
        ...(internalMpqPath(entry.path) ? { hidden: true } : {}),
      })
    }
    const tree = createTreeDataSource({
      kind: 'archive',
      label: 'MPQ',
      preview: `${archive.entries.length} entries, version ${archive.header.version}`,
      children: archive.entries.map(entry => ({
        kind: 'file',
        label: entry.path,
        preview:
          entry.recoveredBytes === undefined
            ? `${entry.block.size} bytes, flags 0x${entry.block.flags.toString(16)}`
            : `${entry.block.size} recovered bytes, ${entry.recoveryMethod}`,
      })),
    })
    const byId = new Map(archive.entries.map(entry => [entry.id, entry]))
    return {
      summary: {
        format: 'mpq',
        version: archive.header.version,
        mpqVersion: archive.header.version,
        mpqEntries: archive.entries.length,
        userDataBytes: archive.header.userDataBytes,
        ...replay,
        entries: archive.entries.length,
        hashSlots: archive.tables.hashTable.length,
        blocks: archive.tables.blockTable.length,
        ...(archive.recovery === undefined
          ? {}
          : {
              recovery: true,
              complete: false,
              recoveredBlocks: archive.recovery.recoveredBlocks,
              unverifiedListfileHints: archive.recovery.unverifiedListfileHints,
            }),
      },
      metadata: [
        {
          id: 'mpq-archive',
          label: 'MPQ archive',
          entries: [
            { key: 'version', value: archive.header.version },
            { key: 'headerBytes', value: archive.header.headerSize },
            ...(archive.header.repaired === true ? [{ key: 'headerRepaired', value: true }] : []),
            { key: 'userDataBytes', value: archive.header.userDataBytes },
            { key: 'entries', value: archive.entries.length },
            { key: 'blocks', value: archive.tables.blockTable.length },
            ...(archive.recovery === undefined
              ? []
              : [
                  { key: 'recovery', value: true },
                  { key: 'complete', value: false },
                  {
                    key: 'unverifiedListfileHints',
                    value: JSON.stringify(archive.recovery.unverifiedListfileHints),
                  },
                ]),
          ],
        },
      ],
      traits: [
        { id: 'container.entries', parameters: { count: archive.entries.length } },
        { id: 'container.compression', parameters: { methods: ['stored', 'zlib', 'bzip2'] } },
        { id: 'content.binary', parameters: { bytes: String(source.size) } },
      ],
      dataSources: {
        'common.view/tree-data-source': tree,
      },
      containerEntries: Object.freeze({
        entries: Object.freeze(archive.entries.map(containerEntry)),
        caseSensitivity: 'insensitive',
        // Without a listfile some blocks have no name, and a recovered archive is a best effort.
        complete: archive.recovery === undefined && archive.entries.every(entry => !/^block\/\d+$/u.test(entry.path)),
        // An entry the listfile does not name, found by its path in the hash table.
        async find(path, signal) {
          signal?.throwIfAborted()
          const entry = entryAt(archive, byId, path)
          return entry === undefined ? undefined : containerEntry(entry)
        },
        ...(preamble === undefined
          ? {}
          : {
              async preamble(maxBytes, signal) {
                signal?.throwIfAborted()
                if (preamble.byteLength > maxBytes) {
                  throw new RangeError(`MPQ user-data payload exceeds the ${maxBytes}-byte bound`)
                }
                return preamble.slice()
              },
            }),
      }),
      ...(creationTarget
        ? {
            operationStates: [
              {
                id: 'view.inspect',
                state: 'disabled',
                reason: 'an empty .mpq creation target has no archive to inspect',
              },
              {
                id: 'asset.validate',
                state: 'disabled',
                reason: 'an empty .mpq creation target has no archive to validate',
              },
              {
                id: 'export.raw',
                state: 'disabled',
                reason: 'an empty .mpq creation target has no archive bytes to export',
              },
              {
                id: 'container.extract',
                state: 'disabled',
                reason: 'an empty .mpq creation target has no entries to extract',
              },
            ],
          }
        : {}),
      handlers: {
        'export-raw': async (input, options) => ({
          kind: 'bytes',
          value: await wholeArchive(options?.signal ?? context.signal),
        }),
        'pack-container': async (input, options) => {
          if (archive.recovery !== undefined) throw recoveredWriteError()
          const request = record(input, 'container.pack input')
          if (request.schemaVersion !== 1) {
            throw new TypeError('container.pack requires schemaVersion 1')
          }
          const containerRevision = String(context.input.revisions.revision)
          if (request.expectedContainerRevision !== containerRevision) {
            throw new TypeError('container.pack expectedContainerRevision is stale')
          }
          const signal = options?.signal ?? context.signal
          signal?.throwIfAborted()
          const bytes = await wholeArchive(signal)
          if (request.mode !== undefined) {
            if (request.mode !== 'create') {
              throw codedTypeError(
                MPQ_FRESH_PACK_UNSUPPORTED,
                `container.pack mode «${String(request.mode)}» is not supported`,
              )
            }
            return createFreshPackPlan(request, bytes, context, signal)
          }
          if (
            !Array.isArray(request.replacements) ||
            request.replacements.length === 0 ||
            request.replacements.length > context.budget.maxNodes
          ) {
            throw new TypeError('container.pack replacements must be a non-empty bounded array')
          }
          const replacements = []
          const seen = new Set()
          let replacementBytes = 0
          for (const [index, candidate] of request.replacements.entries()) {
            const replacement = record(candidate, `container.pack replacements[${index}]`)
            const entryId = String(replacement.entryId ?? '')
            const entry = byId.get(entryId)
            if (entry === undefined) throw new TypeError(`MPQ entry id was not found: ${entryId}`)
            if (seen.has(entryId))
              throw new TypeError(`duplicate MPQ replacement entry id: ${entryId}`)
            seen.add(entryId)
            // The entry's revision as the host's entry table named it, or the whole archive's.
            const containerRevision = String(context.source.revision)
            const entryRevision = String(
              containerEntryRevision(revisionId(containerRevision), entry.path, BigInt(entry.block.size)),
            )
            if (replacement.expectedRevision !== entryRevision && replacement.expectedRevision !== containerRevision) {
              throw new TypeError(`MPQ replacement revision is stale: ${entryId}`)
            }
            const replacementValue = decodeBase64(
              replacement.bytesBase64,
              `container.pack replacements[${index}].bytesBase64`,
              context.budget.maxScalarBytes,
            )
            replacementBytes += replacementValue.byteLength
            if (
              replacementValue.byteLength > context.budget.maxScalarBytes ||
              !Number.isSafeInteger(replacementBytes) ||
              BigInt(replacementBytes) > context.budget.maxInputBytes
            ) {
              throw new RangeError('container.pack replacement payloads exceed the codec budget')
            }
            replacements.push({ path: entry.path, bytes: replacementValue })
          }
          signal?.throwIfAborted()
          const intent =
            request.intent === undefined
              ? undefined
              : record(request.intent, 'container.pack intent')
          const semanticInput = intent?.input
          const archiveMode =
            typeof semanticInput === 'object' &&
            semanticInput !== null &&
            !Array.isArray(semanticInput) &&
            semanticInput.archiveMode === 'deterministic-rebuild'
              ? 'deterministic-rebuild'
              : 'native-preserving'
          const limits = {
            maxArchiveBytes: Math.min(Number(context.budget.maxInputBytes), MAX_ARCHIVE_BYTES),
            maxBlocks: context.budget.maxNodes,
            maxReplacementBytes: context.budget.maxScalarBytes,
          }
          let outputBytes
          let fidelity
          let receipt
          if (archiveMode === 'native-preserving') {
            const encoded = await encodeNativePreservingMpq({
              sourceBytes: bytes,
              replacements,
              signal,
              ...limits,
            })
            outputBytes = encoded.bytes
            fidelity = nativePreservingFidelity
            receipt = encoded.receipt
          } else {
            const snapshot = await readNativeMpqSnapshot({
              sourceBytes: bytes,
              signal,
              maxArchiveBytes: limits.maxArchiveBytes,
              maxBlocks: limits.maxBlocks,
              maxEntries: context.budget.maxNodes,
              maxEntryBytes: context.budget.maxScalarBytes,
              maxTotalBytes: limits.maxArchiveBytes,
            })
            if (
              !snapshot.completeNamedSnapshot ||
              snapshot.opaqueInternalPaths.length > 0 ||
              snapshot.aliasedBlocks.length > 0
            ) {
              throw new TypeError(
                'deterministic MPQ rebuild requires a complete uniquely named archive without opaque internal entries',
              )
            }
            const changed = new Map(
              replacements.map(replacement => [replacement.path.toLowerCase(), replacement.bytes]),
            )
            outputBytes = encodeFreshMpq(
              snapshot.entries.map(entry => ({
                path: entry.path,
                bytes: changed.get(entry.path.toLowerCase()) ?? entry.bytes,
              })),
              limits.maxArchiveBytes,
              { signal },
            )
            fidelity = Object.freeze({
              roundTrip: 'semantic',
              preservesUnknownData: true,
              notes: Object.freeze([
                'all named entry payloads outside the replacement set remain byte-identical',
                'the MPQ layout is rebuilt deterministically as v0 stored single-unit entries',
              ]),
            })
            receipt = Object.freeze({
              kind: 'mpq-deterministic-pack-receipt-v1',
              strategy: 'complete-named-mpq-v0-stored-single-unit',
              entries: snapshot.entries.length,
              replacements: replacements.length,
            })
          }
          signal?.throwIfAborted()
          const semanticPlanId =
            typeof intent?.semanticPlanId === 'string'
              ? intent.semanticPlanId
              : 'semantic-entry-replacements'
          return Object.freeze({
            kind: 'edit-plan',
            plan: editPlanFromInput(context.input, {
              planId: `mpq-pack:${archiveMode}:${semanticPlanId}`,
              edits: [
                replaceBytes(0, bytes.byteLength, outputBytes, `materialize ${archiveMode} MPQ`),
              ],
              fidelity,
              diagnostics: [
                Object.freeze({
                  severity: 'information',
                  code: 'blizzard/mpq-pack-receipt',
                  message: JSON.stringify(receipt),
                }),
              ],
            }),
          })
        },
      },
      diagnostics:
        archive.recovery === undefined
          ? []
          : [
              Object.freeze({
                id: 'blizzard/mpq-recovered-read-only',
                severity: 'warning',
                code: 'blizzard/mpq-recovered-read-only',
                category: 'structure',
                message:
                  'Recovered compressed blocks have synthetic IDs and unverified ownership; writing is disabled.',
              }),
            ],
      maxDecodedBytes: archive.entries.reduce((sum, entry) => sum + BigInt(entry.block.size), 0n),
      unsupportedFeatures: [
        'encrypted-entries',
        'implode-compression',
        'patch-entries',
        'high-offset-tables',
        ...(archive.recovery === undefined
          ? []
          : ['recovered-archive-writing', 'recovery-owner-assignment']),
      ],
    }
  },
})

export const abiVersion = 1
export const createCodec = () => createInspectionCodec(definition)

/**
 * Read-only archive access using the same MPQ v0-v3 parser as the namespace codec. `input` is the
 * archive in memory or a byte range source over it; with a range source only the header, the two
 * tables and the entries asked for are read, so an archive of any size opens in bounded memory.
 */
export async function openMpqReader(input, options) {
  const { maxArchiveBytes, maxEntries, maxEntryBytes, signal } = options
  for (const value of [maxArchiveBytes, maxEntries, maxEntryBytes]) {
    if (!Number.isSafeInteger(value) || value <= 0 || value > MAX_ARCHIVE_BYTES) {
      throw new RangeError('MPQ reader limits must be positive integers at most 1 GiB')
    }
  }
  if (input instanceof Uint8Array && input.byteLength > maxArchiveBytes) {
    throw new RangeError('MPQ reader input exceeds maxArchiveBytes')
  }
  signal?.throwIfAborted()
  let source = await archiveSource(input, signal)
  // Held bytes bound what the archive may occupy; a range source bounds only what one read takes
  // (a recovery scan reads the whole archive, so it is refused past maxArchiveBytes).
  let archive = await parseArchive(source, maxEntries, maxEntryBytes, maxArchiveBytes, signal)
  signal?.throwIfAborted()
  if (archive.entries.length > maxEntries) throw new RangeError('MPQ reader exceeds maxEntries')
  const listed = entry => Object.freeze({
    id: entry.id,
    path: entry.path,
    size: entry.block.size,
    ...(internalMpqPath(entry.path) ? { hidden: true } : {}),
  })
  const entries = Object.freeze(archive.entries.map(listed))
  // A recovery may retain decoded blocks in addition to the source archive.
  const retainedBytes = (source.held?.byteLength ?? 0) + archive.entries.reduce(
    (total, entry) => total + (entry.recoveredBytes?.byteLength ?? 0), 0,
  )
  let byId = new Map(archive.entries.map(entry => [entry.id, entry]))
  const { header } = archive
  if (header.userDataBytes > maxEntryBytes) throw new RangeError('MPQ user-data payload exceeds maxEntryBytes')
  // The payload runs from byte 16 for userDataBytes, cut at the MPQ header.
  const preamble = header.userDataBytes === 0
    ? undefined
    : userDataPreamble(
        await source.read(0, Math.min(source.size, 16 + Math.min(header.userDataBytes, Math.max(header.offset - 16, 0))), 'user-data payload', signal),
        header,
      )
  const live = () => {
    if (archive === undefined) throw new TypeError('MPQ reader is disposed')
    return archive
  }
  return Object.freeze({
    entries,
    ...(preamble === undefined ? {} : { preamble }),
    retainedBytes,
    recovered: archive.recovery !== undefined,
    /** The declared header size and version were junk and the base layout was assumed. */
    headerRepaired: archive.header.repaired === true,
    /** An entry by path: a listed one, or one the hash table holds where no listfile names it. */
    find(path) {
      const entry = entryAt(live(), byId, String(path).replaceAll('\\', '/'))
      return entry === undefined ? undefined : listed(entry)
    },
    async read(id, readSignal) {
      readSignal?.throwIfAborted()
      const current = live()
      const entry = entryAt(current, byId, id)
      if (entry === undefined) throw new TypeError(`MPQ entry was not found: ${id}`)
      return entry.recoveredBytes === undefined
        ? readEntry(source, current.header, entry.block, entry.path, maxEntryBytes, readSignal)
        : recoveredEntryBytes(entry, readSignal)
    },
    dispose() {
      archive = undefined
      byId.clear()
      source = undefined
    },
  })
}

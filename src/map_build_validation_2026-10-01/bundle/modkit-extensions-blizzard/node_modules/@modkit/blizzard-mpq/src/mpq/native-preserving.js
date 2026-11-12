import { compressPortable, decompressBounded } from '@modkit/codec-kit/compression/bounded'
import { HASH_TYPE, mpqHash } from '@modkit/codec-kit/crypto'

/**
 * A table's entry count as the game reads it. Storm sizes a table as count × 16 in 32-bit
 * arithmetic, so only the low 28 bits of the count survive; StarCraft map protectors set the high
 * bits (a 1024-entry hash table declared as 0x10000400) to break readers that do not wrap.
 */
export function mpqTableEntries(declared) {
  return (declared & 0x0fffffff) >>> 0
}

/**
 * The hash-table slots Storm probes for a name, in order: `hash & (size - 1)`, then each next slot
 * masked the same way, until an empty slot or the start again. For a power-of-two table this is a
 * plain modulo walk; a table of 1000 entries (Blizzard's own Jacobs Ladder map) needs the mask, or a
 * reader looks in slots the game never wrote.
 */
export function* mpqProbeSlots(tableHash, size) {
  if (size === 0) return
  const mask = size - 1
  const start = (tableHash & mask) >>> 0
  let slot = start
  for (let step = 0; step < size; step += 1) {
    yield slot
    slot = ((slot + 1) & mask) >>> 0
    if (slot === start) return
  }
}

const HEADER_BYTES_V0 = 32
const HEADER_BYTES_V1 = 44
const HASH_ENTRY_BYTES = 16
const BLOCK_ENTRY_BYTES = 16
const EMPTY_BLOCK = 0xffffffff
const DELETED_BLOCK = 0xfffffffe
const FILE_IMPLODE = 0x00000100
const FILE_COMPRESS = 0x00000200
const FILE_ENCRYPTED = 0x00010000
const FILE_PATCH = 0x00100000
const FILE_SINGLE_UNIT = 0x01000000
const FILE_SECTOR_CRC = 0x04000000
const FILE_EXISTS = 0x80000000

export const MPQ_NATIVE_PRESERVING_UNSUPPORTED =
  'blizzard/mpq-native-preserving-feature-unsupported'

const error = (code, message) => Object.freeze({ severity: 'error', code, message })

const signalList = signals =>
  (Array.isArray(signals) ? signals : [signals]).filter(
    signal => signal !== undefined && signal !== null,
  )

const abort = signals => {
  for (const signal of signalList(signals)) {
    if (signal.aborted) throw new DOMException('operation cancelled', 'AbortError')
  }
}

const cancellationCheckpoint = async signals => {
  abort(signals)
  if (signalList(signals).length === 0) return
  await new Promise(resolve => setTimeout(resolve, 0))
  abort(signals)
}

const streamSignal = signals => {
  const present = signalList(signals)
  if (present.length === 0) return undefined
  if (present.length === 1) return present[0]
  return typeof globalThis.AbortSignal?.any === 'function'
    ? globalThis.AbortSignal.any(present)
    : undefined
}

function record(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined
}

function codedTypeError(code, message) {
  const result = new TypeError(message)
  Object.defineProperty(result, 'code', { value: code, enumerable: true })
  return result
}

function unsupported(message) {
  return codedTypeError(MPQ_NATIVE_PRESERVING_UNSUPPORTED, message)
}

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

function portablePath(path, label = 'MPQ entry') {
  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    path.includes('\0') ||
    path.startsWith('/') ||
    /^[A-Za-z]:/u.test(path) ||
    path.length > 1_024
  ) {
    throw new TypeError(`${label} path «${String(path)}» is not a portable relative path`)
  }
  const normalized = path.replaceAll('\\', '/')
  if (normalized.split('/').some(part => part === '' || part === '.' || part === '..')) {
    throw new TypeError(`${label} path «${path}» contains an empty or traversal segment`)
  }
  return normalized
}

function archiveNameOf(value) {
  const path = portablePath(value, 'MPQ Save As')
  if (path.includes('/') || /[<>:"|?*]/u.test(path) || !/^[\x20-\x7e]+$/u.test(path)) {
    throw new TypeError('MPQ Save As name must be one portable ASCII file inside the target')
  }
  return path
}

const cryptTable = (() => {
  const result = new Uint32Array(0x500)
  let seed = 0x00100001
  for (let first = 0; first < 0x100; first += 1) {
    let index = first
    for (let round = 0; round < 5; round += 1) {
      seed = (seed * 125 + 3) % 0x2aaaab
      const high = (seed & 0xffff) << 16
      seed = (seed * 125 + 3) % 0x2aaaab
      result[index] = (high | (seed & 0xffff)) >>> 0
      index += 0x100
    }
  }
  return result
})()

const mpqPathHash = (input, type) => mpqHash(input.replaceAll('/', '\\'), type)

async function crypt(data, key, decrypting, signals) {
  if (data.byteLength % 4 !== 0) throw new TypeError('MPQ table is not word aligned')
  const output = data.slice()
  const inputView = viewOf(data)
  const outputView = viewOf(output)
  let seed1 = key >>> 0
  let seed2 = 0xeeeeeeee
  for (let offset = 0; offset < data.byteLength; offset += 4) {
    if ((offset & 0xffff) === 0) await cancellationCheckpoint(signals)
    seed2 = (seed2 + (cryptTable[0x400 + (seed1 & 0xff)] ?? 0)) >>> 0
    const input = inputView.getUint32(offset, true)
    const plain = decrypting ? (input ^ ((seed1 + seed2) >>> 0)) >>> 0 : input
    const cipher = decrypting ? input : (plain ^ ((seed1 + seed2) >>> 0)) >>> 0
    outputView.setUint32(offset, decrypting ? plain : cipher, true)
    seed1 = ((((~seed1 << 21) >>> 0) + 0x11111111) | (seed1 >>> 11)) >>> 0
    seed2 = (plain + seed2 + ((seed2 << 5) >>> 0) + 3) >>> 0
  }
  abort(signals)
  return output
}

const decryptTable = (data, key, signals) => crypt(data, key, true, signals)
const encryptTable = (data, key, signals) => crypt(data, key, false, signals)

async function parseArchive(bytes, maxBlocks, signals) {
  abort(signals)
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < HEADER_BYTES_V0) {
    throw new TypeError('native MPQ source is truncated')
  }
  let headerOffset = 0
  let userDataBytes = 0
  if (magic(bytes) === 'MPQ\u001b') {
    if (bytes.byteLength < 16) throw new TypeError('MPQ user-data header is truncated')
    userDataBytes = u32(bytes, 4)
    headerOffset = u32(bytes, 8)
    if (headerOffset < 16 || headerOffset > bytes.byteLength - HEADER_BYTES_V0) {
      throw new RangeError('MPQ user-data header points outside the source')
    }
  }
  if (magic(bytes, headerOffset) !== 'MPQ\u001a') throw new TypeError('MPQ magic is missing')
  checkedSlice(bytes, headerOffset, HEADER_BYTES_V0, 'base header')
  const version = u16(bytes, headerOffset + 12)
  if (version > 1) {
    throw unsupported(`MPQ version ${version} preserving replacement is not implemented`)
  }
  const headerSize = u32(bytes, headerOffset + 4)
  const minimumHeader = version === 0 ? HEADER_BYTES_V0 : HEADER_BYTES_V1
  if (headerSize < minimumHeader) throw new TypeError('MPQ header size is invalid')
  checkedSlice(bytes, headerOffset, headerSize, 'complete header')
  const archiveSize = u32(bytes, headerOffset + 8)
  if (archiveSize < headerSize || archiveSize > bytes.byteLength - headerOffset) {
    throw new RangeError('MPQ declared archive size is outside the source')
  }
  let hashHigh = 0
  let blockHigh = 0
  let extendedBlockOffset = 0n
  if (version > 0) {
    extendedBlockOffset = viewOf(bytes).getBigUint64(headerOffset + 32, true)
    hashHigh = u16(bytes, headerOffset + 40)
    blockHigh = u16(bytes, headerOffset + 42)
    if (extendedBlockOffset !== 0n || hashHigh !== 0 || blockHigh !== 0) {
      throw unsupported('MPQ high-offset and extended block tables remain a named remainder')
    }
  }
  const sectorShift = u16(bytes, headerOffset + 14)
  if (sectorShift > 20) throw unsupported('MPQ sector shifts above 20 are not supported')
  const hashOffset = u32(bytes, headerOffset + 16)
  const blockOffset = u32(bytes, headerOffset + 20)
  const hashEntries = mpqTableEntries(u32(bytes, headerOffset + 24))
  const blockEntries = mpqTableEntries(u32(bytes, headerOffset + 28))
  if (
    !Number.isSafeInteger(maxBlocks) ||
    maxBlocks <= 0 ||
    hashEntries > maxBlocks * 4 ||
    blockEntries > maxBlocks
  ) {
    throw new RangeError('MPQ tables exceed the preserving-writer block budget')
  }
  const hashBytes = hashEntries * HASH_ENTRY_BYTES
  const blockBytes = blockEntries * BLOCK_ENTRY_BYTES
  if (!Number.isSafeInteger(hashBytes) || !Number.isSafeInteger(blockBytes)) {
    throw new RangeError('MPQ table size overflows')
  }
  if (
    hashOffset < headerSize ||
    blockOffset < headerSize ||
    hashOffset + hashBytes > archiveSize ||
    blockOffset + blockBytes > archiveSize
  ) {
    throw new RangeError('MPQ table lies outside the declared archive')
  }
  const hashCipher = checkedSlice(bytes, headerOffset + hashOffset, hashBytes, 'hash table')
  const blockCipher = checkedSlice(bytes, headerOffset + blockOffset, blockBytes, 'block table')
  const hashPlain = await decryptTable(hashCipher, mpqHash('(hash table)', HASH_TYPE.TABLE), signals)
  abort(signals)
  const blockPlain = await decryptTable(blockCipher, mpqHash('(block table)', HASH_TYPE.TABLE), signals)
  abort(signals)
  const hashTable = []
  for (let index = 0; index < hashEntries; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signals)
    const offset = index * HASH_ENTRY_BYTES
    hashTable.push(
      Object.freeze({
        index,
        hashA: u32(hashPlain, offset),
        hashB: u32(hashPlain, offset + 4),
        locale: u16(hashPlain, offset + 8),
        platform: u16(hashPlain, offset + 10),
        blockIndex: u32(hashPlain, offset + 12),
      }),
    )
  }
  const blockTable = []
  const ranges = []
  for (let index = 0; index < blockEntries; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signals)
    const offset = index * BLOCK_ENTRY_BYTES
    const block = Object.freeze({
      index,
      offset: u32(blockPlain, offset),
      archivedSize: u32(blockPlain, offset + 4),
      size: u32(blockPlain, offset + 8),
      flags: u32(blockPlain, offset + 12),
    })
    if ((block.flags & FILE_EXISTS) !== 0) {
      if (block.offset < headerSize || block.offset + block.archivedSize > archiveSize) {
        throw new RangeError(`MPQ block ${index} lies outside the declared archive`)
      }
      ranges.push({
        start: block.offset,
        end: block.offset + block.archivedSize,
        label: `block ${index}`,
      })
    }
    blockTable.push(block)
  }
  ranges.push({ start: hashOffset, end: hashOffset + hashBytes, label: 'hash table' })
  ranges.push({ start: blockOffset, end: blockOffset + blockBytes, label: 'block table' })
  await cancellationCheckpoint(signals)
  ranges.sort((left, right) => left.start - right.start || left.end - right.end)
  await cancellationCheckpoint(signals)
  for (let index = 1; index < ranges.length; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signals)
    const previous = ranges[index - 1]
    const current = ranges[index]
    if (
      previous.end > current.start &&
      previous.end !== previous.start &&
      current.end !== current.start
    ) {
      throw unsupported(
        `overlapping ${previous.label} and ${current.label} cannot be preserved safely`,
      )
    }
  }
  abort(signals)
  return Object.freeze({
    bytes,
    header: Object.freeze({
      offset: headerOffset,
      userDataBytes,
      headerSize,
      archiveSize,
      version,
      sectorShift,
      hashOffset,
      blockOffset,
      hashEntries,
      blockEntries,
      extendedBlockOffset,
      hashHigh,
      blockHigh,
    }),
    hashCipher,
    blockCipher,
    hashPlain,
    blockPlain,
    hashTable: Object.freeze(hashTable),
    blockTable: Object.freeze(blockTable),
  })
}

async function matchingBlockIndices(path, archive, signals) {
  abort(signals)
  if (archive.hashTable.length === 0) return []
  const hashA = mpqPathHash(path, HASH_TYPE.HASH_A)
  const hashB = mpqPathHash(path, HASH_TYPE.HASH_B)
  const found = new Set()
  let probe = 0
  for (const slot of mpqProbeSlots(mpqPathHash(path, HASH_TYPE.TABLE_OFFSET), archive.hashTable.length)) {
    if ((probe++ & 0x0fff) === 0) await cancellationCheckpoint(signals)
    const entry = archive.hashTable[slot]
    if (entry.blockIndex === EMPTY_BLOCK) break
    if (entry.blockIndex === DELETED_BLOCK) continue
    const block = archive.blockTable[entry.blockIndex]
    if (
      entry.hashA === hashA &&
      entry.hashB === hashB &&
      block !== undefined &&
      (block.flags & FILE_EXISTS) !== 0
    ) {
      found.add(block.index)
    }
  }
  abort(signals)
  return [...found]
}

async function liveHashEntriesForBlock(archive, blockIndex, signals) {
  const found = []
  for (let index = 0; index < archive.hashTable.length; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signals)
    const entry = archive.hashTable[index]
    if (
      entry.blockIndex !== EMPTY_BLOCK &&
      entry.blockIndex !== DELETED_BLOCK &&
      entry.blockIndex === blockIndex
    ) {
      found.push(entry)
      if (found.length > 1) return found
    }
  }
  abort(signals)
  return found
}

/** zlib through codec-kit's bounded owner: at most `expected` bytes ever come out. */
async function zlibDecoded(payload, expected, label, signals) {
  abort(signals)
  const signal = streamSignal(signals)
  const result = await decompressBounded(payload, 'deflate', {
    maxOutputBytes: expected,
    ...(signal === undefined ? {} : { signal }),
    outputLimitError: maximum => new RangeError(`MPQ ${label} decodes past its ${maximum}-byte size`),
  })
  abort(signals)
  return result
}

async function zlibEncoded(payload, signals) {
  abort(signals)
  const result = await compressPortable(payload, 'deflate', streamSignal(signals))
  abort(signals)
  return result
}

async function decodeCompressed(payload, expected, label, signals) {
  abort(signals)
  if (payload.byteLength === 0) throw new TypeError(`MPQ compressed ${label} is empty`)
  const method = payload[0]
  let decoded
  if (method === 0) decoded = payload.slice(1)
  else if (method === 2) decoded = await zlibDecoded(payload.slice(1), expected, label, signals)
  else throw unsupported(`MPQ compression mask 0x${method.toString(16)} for ${label}`)
  abort(signals)
  if (decoded.byteLength !== expected) throw new TypeError(`MPQ ${label} size mismatch`)
  return Object.freeze({ bytes: decoded, method })
}

function rawBlockBytes(archive, block) {
  return checkedSlice(
    archive.bytes,
    archive.header.offset + block.offset,
    block.archivedSize,
    `block ${block.index}`,
  )
}

async function sectorLayout(archive, block, label, signals) {
  abort(signals)
  if ((block.flags & FILE_SECTOR_CRC) !== 0) {
    throw unsupported(`changed sector-CRC entry «${label}» is not supported`)
  }
  const sectorSize = 512 * 2 ** archive.header.sectorShift
  const sectorCount = Math.ceil(block.size / sectorSize)
  const positionCount = sectorCount + 1
  const tableBytes = positionCount * 4
  const raw = rawBlockBytes(archive, block)
  if (raw.byteLength < tableBytes) throw new TypeError(`MPQ ${label} sector table is truncated`)
  const positions = []
  for (let index = 0; index < positionCount; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signals)
    positions.push(u32(raw, index * 4))
  }
  if (positions[0] < tableBytes || positions.at(-1) > raw.byteLength) {
    throw new TypeError(`MPQ ${label} sector table is invalid`)
  }
  for (let index = 1; index < positions.length; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signals)
    if (positions[index] < positions[index - 1]) {
      throw new TypeError(`MPQ ${label} sector offsets are not monotonic`)
    }
  }
  abort(signals)
  return Object.freeze({ raw, sectorSize, sectorCount, positions })
}

async function readBlock(archive, block, label, signals) {
  abort(signals)
  if ((block.flags & FILE_ENCRYPTED) !== 0) throw unsupported(`encrypted entry «${label}»`)
  if ((block.flags & FILE_IMPLODE) !== 0) throw unsupported(`implode entry «${label}»`)
  if ((block.flags & FILE_PATCH) !== 0) throw unsupported(`patch entry «${label}»`)
  const raw = rawBlockBytes(archive, block)
  abort(signals)
  if ((block.flags & FILE_SINGLE_UNIT) !== 0) {
    if ((block.flags & FILE_COMPRESS) !== 0 && block.size > block.archivedSize) {
      const decoded = await decodeCompressed(raw, block.size, label, signals)
      abort(signals)
      return decoded.bytes
    }
    if (raw.byteLength < block.size) throw new TypeError(`MPQ ${label} is truncated`)
    return raw.slice(0, block.size)
  }
  if ((block.flags & FILE_COMPRESS) === 0) {
    if (raw.byteLength !== block.size) throw new TypeError(`MPQ ${label} size mismatch`)
    return raw
  }
  const layout = await sectorLayout(archive, block, label, signals)
  abort(signals)
  const output = new Uint8Array(block.size)
  let target = 0
  for (let index = 0; index < layout.sectorCount; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signals)
    const expected = Math.min(layout.sectorSize, block.size - target)
    const sector = layout.raw.slice(layout.positions[index], layout.positions[index + 1])
    const decoded =
      sector.byteLength < expected
        ? (await decodeCompressed(sector, expected, `${label}#${index}`, signals)).bytes
        : sector
    abort(signals)
    if (decoded.byteLength !== expected) throw new TypeError(`MPQ ${label} sector size mismatch`)
    output.set(decoded, target)
    target += decoded.byteLength
  }
  abort(signals)
  return output
}

async function namesOf(archive, signals) {
  abort(signals)
  const names = new Map()
  const listIndices = await matchingBlockIndices('(listfile)', archive, signals)
  abort(signals)
  if (listIndices.length === 1) {
    try {
      const listfile = await readBlock(
        archive,
        archive.blockTable[listIndices[0]],
        '(listfile)',
        signals,
      )
      abort(signals)
      const lines = new TextDecoder('utf-8', { fatal: true }).decode(listfile).split(/\r?\n/u)
      for (let index = 0; index < lines.length; index += 1) {
        if ((index & 0x0fff) === 0) await cancellationCheckpoint(signals)
        const raw = lines[index]
        const trimmed = raw.trim()
        if (trimmed === '') continue
        const path = portablePath(trimmed)
        const matches = await matchingBlockIndices(path, archive, signals)
        if (matches.length === 1) names.set(path.toLowerCase(), { path, blockIndex: matches[0] })
      }
    } catch (cause) {
      if (cause?.name === 'AbortError') throw cause
      if (cause?.code === MPQ_NATIVE_PRESERVING_UNSUPPORTED) throw cause
      throw unsupported(
        `the MPQ listfile cannot be decoded safely: ${cause instanceof Error ? cause.message : String(cause)}`,
      )
    }
  }
  for (const path of ['(listfile)', '(attributes)', '(signature)']) {
    abort(signals)
    const matches = await matchingBlockIndices(path, archive, signals)
    if (matches.length === 1) names.set(path, { path, blockIndex: matches[0] })
  }
  abort(signals)
  return names
}

async function distinctNamesForBlock(names, blockIndex, signals) {
  const result = new Map()
  let index = 0
  for (const named of names.values()) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signals)
    index += 1
    if (named.blockIndex !== blockIndex) continue
    const key = named.path.replaceAll('\\', '/').toLowerCase()
    if (!result.has(key)) result.set(key, named.path)
  }
  abort(signals)
  return [...result.values()].sort()
}

async function encodeByOriginalMethod(archive, block, path, replacement, signals) {
  abort(signals)
  if ((block.flags & FILE_ENCRYPTED) !== 0) {
    throw unsupported(`changed encrypted entry «${path}» requires native key handling`)
  }
  if ((block.flags & FILE_IMPLODE) !== 0) {
    throw unsupported(`changed implode entry «${path}» is not supported`)
  }
  if ((block.flags & FILE_PATCH) !== 0) {
    throw unsupported(`changed patch entry «${path}» requires patch-chain reconstruction`)
  }
  if ((block.flags & FILE_SECTOR_CRC) !== 0) {
    throw unsupported(`changed sector-CRC entry «${path}» requires CRC reconstruction`)
  }
  const raw = rawBlockBytes(archive, block)
  abort(signals)
  if ((block.flags & FILE_SINGLE_UNIT) !== 0) {
    if ((block.flags & FILE_COMPRESS) === 0 || block.size <= block.archivedSize) {
      return Object.freeze({ bytes: replacement.slice(), method: 'stored' })
    }
    const method = raw[0]
    if (method === 0) {
      const bytes = new Uint8Array(replacement.byteLength + 1)
      bytes[0] = 0
      bytes.set(replacement, 1)
      return Object.freeze({ bytes, method: 'compression-mask-0x00' })
    }
    if (method === 2) {
      const compressed = await zlibEncoded(replacement, signals)
      abort(signals)
      const bytes = new Uint8Array(compressed.byteLength + 1)
      bytes[0] = 2
      bytes.set(compressed, 1)
      if (bytes.byteLength >= replacement.byteLength) {
        throw unsupported(
          `changed zlib entry «${path}» no longer compresses with its original method`,
        )
      }
      return Object.freeze({ bytes, method: 'zlib' })
    }
    throw unsupported(`changed entry «${path}» uses compression mask 0x${method.toString(16)}`)
  }
  if ((block.flags & FILE_COMPRESS) === 0) {
    return Object.freeze({ bytes: replacement.slice(), method: 'stored' })
  }
  if (replacement.byteLength !== block.size) {
    throw unsupported(`changed sector-compressed entry «${path}» must keep its uncompressed size`)
  }
  const layout = await sectorLayout(archive, block, path, signals)
  abort(signals)
  const encodedSectors = []
  let sourceOffset = 0
  for (let index = 0; index < layout.sectorCount; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signals)
    const expected = Math.min(layout.sectorSize, replacement.byteLength - sourceOffset)
    const original = layout.raw.slice(layout.positions[index], layout.positions[index + 1])
    const plain = replacement.slice(sourceOffset, sourceOffset + expected)
    sourceOffset += expected
    if (original.byteLength >= expected) {
      encodedSectors.push(plain)
      continue
    }
    const method = original[0]
    if (method === 0) {
      const encoded = new Uint8Array(plain.byteLength + 1)
      encoded[0] = 0
      encoded.set(plain, 1)
      encodedSectors.push(encoded)
      continue
    }
    if (method !== 2) {
      throw unsupported(
        `changed entry «${path}» sector ${index} uses mask 0x${method.toString(16)}`,
      )
    }
    const compressed = await zlibEncoded(plain, signals)
    abort(signals)
    const encoded = new Uint8Array(compressed.byteLength + 1)
    encoded[0] = 2
    encoded.set(compressed, 1)
    if (encoded.byteLength >= expected) {
      throw unsupported(
        `changed zlib entry «${path}» sector ${index} no longer compresses with its original method`,
      )
    }
    encodedSectors.push(encoded)
  }
  const tableBytes = (layout.sectorCount + 1) * 4
  let total = tableBytes
  for (let index = 0; index < encodedSectors.length; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signals)
    total += encodedSectors[index].byteLength
  }
  const encoded = new Uint8Array(total)
  const encodedView = viewOf(encoded)
  let cursor = tableBytes
  encodedView.setUint32(0, cursor, true)
  for (let index = 0; index < encodedSectors.length; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signals)
    const sector = encodedSectors[index]
    encoded.set(sector, cursor)
    cursor += sector.byteLength
    encodedView.setUint32((index + 1) * 4, cursor, true)
  }
  abort(signals)
  return Object.freeze({ bytes: encoded, method: 'sector-methods-preserved' })
}

async function bytesEqual(left, right, signals) {
  abort(signals)
  if (left.byteLength !== right.byteLength) return false
  for (let index = 0; index < left.byteLength; index += 1) {
    if ((index & 0x0fffff) === 0) await cancellationCheckpoint(signals)
    if (left[index] !== right[index]) return false
  }
  abort(signals)
  return true
}

async function digest(bytes, signals) {
  abort(signals)
  if (globalThis.crypto?.subtle === undefined) {
    throw unsupported('SHA-256 is unavailable in this runtime')
  }
  const value = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))
  abort(signals)
  return `sha256:${[...value].map(item => item.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Read a bounded, revision-independent snapshot of every listfile-named MPQ entry.
 *
 * This is deliberately narrower than a generic archive API. It exists so semantic editors can
 * inspect the exact documents they intend to replace while using the same parser, decompressor,
 * path rules and cancellation checkpoints as the native-preserving writer. Callers that want to
 * rebuild a fresh archive must require `completeNamedSnapshot`, an empty `opaqueInternalPaths`,
 * and an empty `aliasedBlocks`; otherwise native data would be omitted or duplicated.
 */
export async function readNativeMpqSnapshot(options) {
  const {
    sourceBytes,
    signal,
    includeBasenames,
    maxArchiveBytes = 67_108_864,
    maxBlocks = 16_384,
    maxEntries = 4_096,
    maxEntryBytes = 16_777_216,
    maxTotalBytes = 67_108_864,
  } = options ?? {}
  abort(signal)
  if (!(sourceBytes instanceof Uint8Array)) throw new TypeError('native MPQ source has no bytes')
  for (const [name, value] of Object.entries({
    maxArchiveBytes,
    maxBlocks,
    maxEntries,
    maxEntryBytes,
    maxTotalBytes,
  })) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError(`${name} must be a positive safe integer`)
    }
  }
  if (
    maxArchiveBytes > 1_073_741_824 ||
    maxBlocks > 1_000_000 ||
    maxEntries > 1_000_000 ||
    maxEntryBytes > 1_073_741_824 ||
    maxTotalBytes > 1_073_741_824
  ) {
    throw new RangeError('native MPQ snapshot limits exceed the hard safety ceiling')
  }
  if (sourceBytes.byteLength > maxArchiveBytes) {
    throw new RangeError('native MPQ source exceeds maxArchiveBytes')
  }
  let selectedBasenames
  if (includeBasenames !== undefined) {
    if (!Array.isArray(includeBasenames) || includeBasenames.length === 0) {
      throw new TypeError('includeBasenames must be a non-empty string array')
    }
    selectedBasenames = new Set()
    for (const candidate of includeBasenames) {
      if (
        typeof candidate !== 'string' ||
        candidate.length === 0 ||
        candidate.includes('/') ||
        candidate.includes('\\') ||
        candidate.includes('\0')
      ) {
        throw new TypeError(`invalid MPQ snapshot basename «${String(candidate)}»`)
      }
      selectedBasenames.add(candidate.toLowerCase())
    }
  }

  const archive = await parseArchive(sourceBytes, maxBlocks, signal)
  abort(signal)
  const names = await namesOf(archive, signal)
  abort(signal)
  const internal = new Set(['(listfile)', '(attributes)', '(signature)'])
  const activeBlocks = archive.blockTable.filter(block => (block.flags & FILE_EXISTS) !== 0)
  const namedBlocks = new Map()
  const opaqueInternalPaths = []
  for (const named of names.values()) {
    const paths = namedBlocks.get(named.blockIndex) ?? []
    paths.push(named.path)
    namedBlocks.set(named.blockIndex, paths)
    if (internal.has(named.path.toLowerCase()) && named.path.toLowerCase() !== '(listfile)') {
      opaqueInternalPaths.push(named.path)
    }
  }
  const aliasedBlocks = [...namedBlocks]
    .filter(([, paths]) => paths.length > 1)
    .map(([blockIndex, paths]) =>
      Object.freeze({ blockIndex, paths: Object.freeze([...paths].sort()) }),
    )
  const unnamedBlocks = activeBlocks.filter(block => !namedBlocks.has(block.index)).length
  const entries = []
  let totalBytes = 0
  let index = 0
  for (const named of [...names.values()].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  )) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signal)
    index += 1
    const foldedPath = named.path.toLowerCase()
    if (internal.has(foldedPath)) continue
    const basename = named.path.replaceAll('\\', '/').split('/').at(-1)?.toLowerCase() ?? ''
    if (selectedBasenames !== undefined && !selectedBasenames.has(basename)) continue
    if (entries.length >= maxEntries) throw new RangeError('native MPQ snapshot exceeds maxEntries')
    const block = archive.blockTable[named.blockIndex]
    if (block === undefined) throw new TypeError(`MPQ named block is missing: ${named.path}`)
    if (block.size > maxEntryBytes) {
      throw new RangeError(`native MPQ entry «${named.path}» exceeds maxEntryBytes`)
    }
    const bytes = await readBlock(archive, block, named.path, signal)
    abort(signal)
    totalBytes += bytes.byteLength
    if (!Number.isSafeInteger(totalBytes) || totalBytes > maxTotalBytes) {
      throw new RangeError('native MPQ snapshot exceeds maxTotalBytes')
    }
    entries.push(
      Object.freeze({
        path: named.path,
        bytes,
        blockIndex: block.index,
        flags: `0x${block.flags.toString(16).padStart(8, '0')}`,
        method: methodLabel(archive, block),
      }),
    )
  }
  abort(signal)
  return Object.freeze({
    schemaVersion: 1,
    kind: 'mpq-native-named-snapshot-v1',
    sourceArchiveDigest: await digest(sourceBytes, signal),
    archiveVersion: archive.header.version,
    archiveBytes: sourceBytes.byteLength,
    activeBlocks: activeBlocks.length,
    namedBlocks: namedBlocks.size,
    unnamedBlocks,
    completeNamedSnapshot: unnamedBlocks === 0,
    opaqueInternalPaths: Object.freeze([...opaqueInternalPaths].sort()),
    aliasedBlocks: Object.freeze(aliasedBlocks),
    filtered: selectedBasenames !== undefined,
    entries: Object.freeze(entries),
  })
}

function methodLabel(archive, block) {
  if ((block.flags & FILE_ENCRYPTED) !== 0) return 'encrypted-opaque'
  if ((block.flags & FILE_PATCH) !== 0) return 'patch-opaque'
  if ((block.flags & FILE_IMPLODE) !== 0) return 'implode-opaque'
  if ((block.flags & FILE_COMPRESS) === 0) return 'stored'
  if ((block.flags & FILE_SINGLE_UNIT) === 0) return 'sector-compressed-opaque'
  if (block.size <= block.archivedSize) return 'stored-with-compress-flag'
  const raw = rawBlockBytes(archive, block)
  return raw[0] === 2 ? 'zlib' : `compression-mask-0x${(raw[0] ?? 0).toString(16)}`
}

/**
 * Build a fixed-slot native-preserving replacement. The complete source archive remains immutable;
 * callers commit the returned bytes as a separate file through the durable writer coordinator.
 */
export async function encodeNativePreservingMpq(options) {
  const {
    sourceBytes,
    replacements,
    signal,
    maxArchiveBytes = 67_108_864,
    maxBlocks = 16_384,
    maxReplacementBytes = 16_777_216,
  } = options
  abort(signal)
  if (!(sourceBytes instanceof Uint8Array)) throw new TypeError('native MPQ source has no bytes')
  for (const [name, value] of Object.entries({
    maxArchiveBytes,
    maxBlocks,
    maxReplacementBytes,
  })) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new TypeError(`${name} must be a positive safe integer`)
    }
  }
  if (maxArchiveBytes > 1_073_741_824 || maxBlocks > 1_000_000) {
    throw new RangeError('native MPQ preserving-writer limits exceed the hard safety ceiling')
  }
  if (sourceBytes.byteLength > maxArchiveBytes) {
    throw new RangeError('native MPQ source exceeds maxArchiveBytes')
  }
  if (!Array.isArray(replacements) || replacements.length === 0) {
    throw new TypeError('native MPQ preserving replacement requires at least one changed entry')
  }
  const source = await parseArchive(sourceBytes, maxBlocks, signal)
  abort(signal)
  const names = await namesOf(source, signal)
  abort(signal)
  const normalized = []
  const folded = new Set()
  let replacementBytes = 0
  for (let index = 0; index < replacements.length; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signal)
    const candidate = replacements[index]
    const item = record(candidate)
    const path = portablePath(item?.path)
    const key = path.toLowerCase()
    if (folded.has(key)) throw new TypeError(`duplicate changed MPQ path «${path}»`)
    if (key === '(listfile)' || key === '(attributes)' || key === '(signature)') {
      throw unsupported(`${path} is an opaque native record and cannot be changed by this writer`)
    }
    if (!(item?.bytes instanceof Uint8Array)) {
      throw new TypeError(`changed MPQ entry «${path}» has no bytes`)
    }
    replacementBytes += item.bytes.byteLength
    if (item.bytes.byteLength > maxReplacementBytes || replacementBytes > maxArchiveBytes) {
      throw new RangeError('native MPQ replacements exceed the byte budget')
    }
    const named = names.get(key)
    if (named === undefined) {
      if ((await matchingBlockIndices(path, source, signal)).length > 0) {
        throw unsupported(`MPQ entry «${path}» is ambiguous and cannot be changed safely`)
      }
      throw new TypeError(`MPQ listfile does not name changed entry «${path}»`)
    }
    const hashReferences = await liveHashEntriesForBlock(source, named.blockIndex, signal)
    if (hashReferences.length > 1) {
      throw unsupported(
        `MPQ block ${named.blockIndex} is referenced by multiple live hash-table entries`,
      )
    }
    const blockNames = await distinctNamesForBlock(names, named.blockIndex, signal)
    if (blockNames.length !== 1) {
      throw unsupported(
        `MPQ block ${named.blockIndex} is associated with multiple distinct names: ${blockNames.join(', ')}`,
      )
    }
    folded.add(key)
    normalized.push(
      Object.freeze({ path: named.path, bytes: item.bytes.slice(), blockIndex: named.blockIndex }),
    )
  }

  await cancellationCheckpoint(signal)
  const output = sourceBytes.slice()
  abort(signal)
  const nextBlockPlain = source.blockPlain.slice()
  abort(signal)
  const changed = []
  const changedBlocks = new Set()
  for (let index = 0; index < normalized.length; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signal)
    const replacement = normalized[index]
    if (changedBlocks.has(replacement.blockIndex)) {
      throw unsupported(
        `multiple listfile aliases resolve to changed MPQ block ${replacement.blockIndex}`,
      )
    }
    const block = source.blockTable[replacement.blockIndex]
    const originalDecoded = await readBlock(source, block, replacement.path, signal)
    abort(signal)
    if (await bytesEqual(originalDecoded, replacement.bytes, signal)) {
      throw new TypeError(`changed MPQ entry «${replacement.path}» is byte-identical to its source`)
    }
    const encoded = await encodeByOriginalMethod(
      source,
      block,
      replacement.path,
      replacement.bytes,
      signal,
    )
    abort(signal)
    if (encoded.bytes.byteLength > block.archivedSize) {
      throw unsupported(
        `changed entry «${replacement.path}» needs ${encoded.bytes.byteLength} bytes but its native slot has ${block.archivedSize}`,
      )
    }
    const payloadStart = source.header.offset + block.offset
    abort(signal)
    output.set(encoded.bytes, payloadStart)
    output.fill(0, payloadStart + encoded.bytes.byteLength, payloadStart + block.archivedSize)
    abort(signal)
    const entryOffset = block.index * BLOCK_ENTRY_BYTES
    const blockView = viewOf(nextBlockPlain)
    blockView.setUint32(entryOffset + 4, encoded.bytes.byteLength, true)
    blockView.setUint32(entryOffset + 8, replacement.bytes.byteLength, true)
    changedBlocks.add(block.index)
    changed.push(
      Object.freeze({
        path: replacement.path,
        blockIndex: block.index,
        flags: `0x${block.flags.toString(16).padStart(8, '0')}`,
        method: encoded.method,
        sourceBytes: block.size,
        outputBytes: replacement.bytes.byteLength,
        sourceArchivedBytes: block.archivedSize,
        outputArchivedBytes: encoded.bytes.byteLength,
        zeroFilledSlackBytes: block.archivedSize - encoded.bytes.byteLength,
      }),
    )
  }
  const nextBlockCipher = await encryptTable(
    nextBlockPlain,
    mpqHash('(block table)', HASH_TYPE.TABLE),
    signal,
  )
  abort(signal)
  output.set(nextBlockCipher, source.header.offset + source.header.blockOffset)
  abort(signal)

  const reopened = await parseArchive(output, maxBlocks, signal)
  abort(signal)
  if (!(await bytesEqual(source.hashCipher, reopened.hashCipher, signal))) {
    throw new TypeError('native MPQ verification found hash-table drift')
  }
  if (
    source.blockTable.length !== reopened.blockTable.length ||
    source.header.version !== reopened.header.version ||
    source.header.headerSize !== reopened.header.headerSize ||
    source.header.archiveSize !== reopened.header.archiveSize
  ) {
    throw new TypeError('native MPQ verification found archive metadata drift')
  }
  for (let index = 0; index < source.blockTable.length; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signal)
    const sourceBlock = source.blockTable[index]
    const outputBlock = reopened.blockTable[sourceBlock.index]
    if (
      outputBlock.offset !== sourceBlock.offset ||
      outputBlock.flags !== sourceBlock.flags ||
      (!changedBlocks.has(sourceBlock.index) &&
        (outputBlock.archivedSize !== sourceBlock.archivedSize ||
          outputBlock.size !== sourceBlock.size))
    ) {
      throw new TypeError(`native MPQ verification found block-table drift at ${sourceBlock.index}`)
    }
    if (
      !changedBlocks.has(sourceBlock.index) &&
      (sourceBlock.flags & FILE_EXISTS) !== 0 &&
      !(await bytesEqual(
        rawBlockBytes(source, sourceBlock),
        rawBlockBytes(reopened, outputBlock),
        signal,
      ))
    ) {
      throw new TypeError(
        `native MPQ verification found untouched payload drift at ${sourceBlock.index}`,
      )
    }
  }
  for (let index = 0; index < normalized.length; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signal)
    const replacement = normalized[index]
    const block = reopened.blockTable[replacement.blockIndex]
    const decoded = await readBlock(reopened, block, replacement.path, signal)
    abort(signal)
    if (!(await bytesEqual(decoded, replacement.bytes, signal))) {
      throw new TypeError(
        `native MPQ verification could not reopen changed entry «${replacement.path}»`,
      )
    }
  }
  if (
    !(await bytesEqual(
      sourceBytes.slice(0, source.header.offset),
      output.slice(0, reopened.header.offset),
      signal,
    )) ||
    !(await bytesEqual(
      sourceBytes.slice(source.header.offset + source.header.archiveSize),
      output.slice(reopened.header.offset + reopened.header.archiveSize),
      signal,
    ))
  ) {
    throw new TypeError('native MPQ verification found opaque prefix/suffix drift')
  }
  const rewrittenRegions = []
  for (let index = 0; index < normalized.length; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signal)
    const sourceBlock = source.blockTable[normalized[index].blockIndex]
    rewrittenRegions.push({
      start: source.header.offset + sourceBlock.offset,
      end: source.header.offset + sourceBlock.offset + sourceBlock.archivedSize,
    })
  }
  rewrittenRegions.push({
    start: source.header.offset + source.header.blockOffset,
    end:
      source.header.offset +
      source.header.blockOffset +
      source.header.blockEntries * BLOCK_ENTRY_BYTES,
  })
  await cancellationCheckpoint(signal)
  rewrittenRegions.sort((left, right) => left.start - right.start)
  await cancellationCheckpoint(signal)
  let verifiedUntil = 0
  for (let index = 0; index < rewrittenRegions.length; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signal)
    const region = rewrittenRegions[index]
    if (
      region.start > verifiedUntil &&
      !(await bytesEqual(
        sourceBytes.subarray(verifiedUntil, region.start),
        output.subarray(verifiedUntil, region.start),
        signal,
      ))
    ) {
      throw new TypeError('native MPQ verification found drift outside declared rewritten regions')
    }
    verifiedUntil = Math.max(verifiedUntil, region.end)
  }
  if (
    verifiedUntil < sourceBytes.byteLength &&
    !(await bytesEqual(sourceBytes.subarray(verifiedUntil), output.subarray(verifiedUntil), signal))
  ) {
    throw new TypeError('native MPQ verification found trailing drift outside rewritten regions')
  }

  const namedBlocks = new Set()
  let namedIndex = 0
  for (const item of names.values()) {
    if ((namedIndex & 0x0fff) === 0) await cancellationCheckpoint(signal)
    namedBlocks.add(item.blockIndex)
    namedIndex += 1
  }
  const activeBlocks = []
  const unchangedMethods = new Set()
  let unnamedBlocks = 0
  let patchBlocks = 0
  for (let index = 0; index < source.blockTable.length; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signal)
    const block = source.blockTable[index]
    if ((block.flags & FILE_EXISTS) === 0) continue
    activeBlocks.push(block)
    if (!namedBlocks.has(block.index)) unnamedBlocks += 1
    if ((block.flags & FILE_PATCH) !== 0) patchBlocks += 1
    if (!changedBlocks.has(block.index)) unchangedMethods.add(methodLabel(source, block))
  }
  let changedSectorMethods = false
  for (let index = 0; index < changed.length; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signal)
    if (changed[index].method === 'sector-methods-preserved') changedSectorMethods = true
  }
  const attributes = names.get('(attributes)')
  const internalSignature = names.get('(signature)')
  const suffixStart = source.header.offset + source.header.archiveSize
  const externalStrongSignature =
    sourceBytes.byteLength - suffixStart >= 260 && magic(sourceBytes, suffixStart) === 'NGIS'
  const signatureKinds = Object.freeze([
    ...(internalSignature === undefined ? [] : ['internal-signature-entry']),
    ...(externalStrongSignature ? ['external-strong-ngis-256'] : []),
  ])
  const signaturePresent = signatureKinds.length > 0
  const sourceArchiveDigest = await digest(sourceBytes, signal)
  abort(signal)
  const outputArchiveDigest = await digest(output, signal)
  abort(signal)
  const receipt = Object.freeze({
    schemaVersion: 1,
    kind: 'mpq-native-export-receipt-v1',
    strategy: 'whole-archive-save-as-fixed-slots',
    sourceArchiveDigest,
    outputArchiveDigest,
    archiveByteIdentity: sourceArchiveDigest === outputArchiveDigest ? 'identical' : 'changed',
    source: Object.freeze({
      version: source.header.version,
      headerBytes: source.header.headerSize,
      archiveBytes: source.header.archiveSize,
      userDataBytes: source.header.userDataBytes,
      prefixBytes: source.header.offset,
      suffixBytes: sourceBytes.byteLength - source.header.offset - source.header.archiveSize,
      hashSlots: source.hashTable.length,
      blockSlots: source.blockTable.length,
    }),
    unchanged: Object.freeze({
      entries: activeBlocks.length - changedBlocks.size,
      guarantee: 'raw-payload-flags-and-method-byte-identical',
      methods: Object.freeze([...unchangedMethods].sort()),
    }),
    changed: Object.freeze(changed),
    tables: Object.freeze({
      hash: 'byte-identical',
      block: 'deterministic-semantic-rebuild-in-original-slot',
      blockOrder: 'preserved',
      blockOffsets: 'preserved',
      sectorTables: changedSectorMethods
        ? 'changed-entry-methods-preserved'
        : 'untouched-byte-identical',
    }),
    opaque: Object.freeze({
      prefix: 'byte-identical',
      suffix: 'byte-identical',
      extendedHeader: 'byte-identical',
      interstitialBytes: 'byte-identical',
      changedEntrySlack: 'zero-filled-no-source-payload-retained',
      sourceArchive: 'not-mutated',
      unnamedBlocks,
      unnamedBlocksPolicy: 'byte-identical',
      patchBlocks,
      patchBlocksPolicy: 'byte-identical-when-untouched',
      attributes: Object.freeze({
        present: attributes !== undefined,
        bytes: attributes === undefined ? 'absent' : 'preserved-opaque',
        status: attributes === undefined ? 'not-present' : 'invalidated-by-modification',
      }),
    }),
    signature: Object.freeze({
      present: signaturePresent,
      kind:
        signatureKinds.length === 0
          ? 'none'
          : signatureKinds.length === 1
            ? signatureKinds[0]
            : 'multiple',
      kinds: signatureKinds,
      externalStrongBytes: externalStrongSignature ? 260 : 0,
      bytes: signaturePresent ? 'preserved-opaque' : 'absent',
      status: signaturePresent ? 'invalidated-by-modification' : 'not-present',
    }),
    launchData: 'outside-writer-scope',
  })
  return Object.freeze({ bytes: output, receipt })
}

export const nativePreservingFidelity = Object.freeze({
  roundTrip: 'semantic',
  preservesUnknownData: true,
  notes: Object.freeze([
    'untouched native MPQ blocks retain byte-identical raw payloads, flags and compression methods',
    'changed entries retain their flags and supported stored/zlib method inside the original block slot',
    'hash order, block order and block offsets stay fixed; the encrypted block table is rebuilt deterministically',
    'unknown blocks, patch blocks, user-data prefixes and archive suffixes are copied opaque',
    'opaque attributes and signatures are copied byte-identically but reported invalidated after modification',
    'unused bytes in each changed native block slot are zero-filled in the new archive; the source archive is never erased or mutated',
    'the result is a separate whole-archive Save As replacement, never an in-place native edit claim',
  ]),
})

export async function validateNativePreservingChange(change, context, signal) {
  const signals = [context.signal, signal]
  abort(signals)
  const diagnostics = []
  const intent = record(change.semanticIntent)
  const receipt = record(intent?.nativeExportReceipt)
  const receiptSignature = record(receipt?.signature)
  const receiptSignatureKinds = Array.isArray(receiptSignature?.kinds) ? receiptSignature.kinds : []
  const signatureKindsSeen = new Set()
  let receiptSignatureKindsValid = receiptSignatureKinds.length <= context.budgets.maxNodes
  for (let index = 0; index < receiptSignatureKinds.length; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signals)
    const kind = receiptSignatureKinds[index]
    if (
      !['internal-signature-entry', 'external-strong-ngis-256'].includes(kind) ||
      signatureKindsSeen.has(kind)
    ) {
      receiptSignatureKindsValid = false
    }
    signatureKindsSeen.add(kind)
  }
  const receiptSignatureKind =
    receiptSignatureKinds.length === 0
      ? 'none'
      : receiptSignatureKinds.length === 1
        ? receiptSignatureKinds[0]
        : 'multiple'
  const receiptAttributes = record(record(receipt?.opaque)?.attributes)
  const changedReceiptEntries = Array.isArray(receipt?.changed) ? receipt.changed : []
  let receiptChangesAreValid =
    changedReceiptEntries.length > 0 && changedReceiptEntries.length <= context.budgets.maxNodes
  for (let index = 0; index < changedReceiptEntries.length; index += 1) {
    if ((index & 0x0fff) === 0) await cancellationCheckpoint(signals)
    const entry = record(changedReceiptEntries[index])
    if (!(
      typeof entry?.path === 'string' &&
      entry.path.length > 0 &&
      Number.isSafeInteger(entry.blockIndex) &&
      entry.blockIndex >= 0 &&
      /^0x[0-9a-f]{8}$/u.test(String(entry.flags ?? '')) &&
      typeof entry.method === 'string' &&
      entry.method.length > 0 &&
      Number.isSafeInteger(entry.sourceBytes) &&
      entry.sourceBytes >= 0 &&
      Number.isSafeInteger(entry.outputBytes) &&
      entry.outputBytes >= 0 &&
      Number.isSafeInteger(entry.zeroFilledSlackBytes) &&
      entry.zeroFilledSlackBytes >= 0
    )) {
      receiptChangesAreValid = false
    }
  }
  abort(signals)
  if (
    intent?.kind !== 'mpq-native-preserving-export-v1' ||
    intent.sourceMode !== 'native-mpq' ||
    intent.completeSnapshot !== true ||
    intent.replacementMode !== 'whole-archive-save-as' ||
    intent.unknownDataPolicy !== 'preserve-opaque-source-bytes' ||
    receipt?.kind !== 'mpq-native-export-receipt-v1' ||
    receipt.strategy !== 'whole-archive-save-as-fixed-slots' ||
    !/^sha256:[0-9a-f]{64}$/u.test(String(receipt.sourceArchiveDigest ?? '')) ||
    !/^sha256:[0-9a-f]{64}$/u.test(String(receipt.outputArchiveDigest ?? '')) ||
    receipt.archiveByteIdentity !== 'changed' ||
    record(receipt.unchanged)?.guarantee !== 'raw-payload-flags-and-method-byte-identical' ||
    record(receipt.tables)?.hash !== 'byte-identical' ||
    record(receipt.tables)?.block !== 'deterministic-semantic-rebuild-in-original-slot' ||
    record(receipt.tables)?.blockOrder !== 'preserved' ||
    record(receipt.tables)?.blockOffsets !== 'preserved' ||
    record(receipt.opaque)?.prefix !== 'byte-identical' ||
    record(receipt.opaque)?.suffix !== 'byte-identical' ||
    record(receipt.opaque)?.extendedHeader !== 'byte-identical' ||
    record(receipt.opaque)?.interstitialBytes !== 'byte-identical' ||
    record(receipt.opaque)?.changedEntrySlack !== 'zero-filled-no-source-payload-retained' ||
    record(receipt.opaque)?.sourceArchive !== 'not-mutated' ||
    !(
      (receiptAttributes?.present === true &&
        receiptAttributes.bytes === 'preserved-opaque' &&
        receiptAttributes.status === 'invalidated-by-modification') ||
      (receiptAttributes?.present === false &&
        receiptAttributes.bytes === 'absent' &&
        receiptAttributes.status === 'not-present')
    ) ||
    !(
      (receiptSignature?.present === true &&
        receiptSignatureKindsValid &&
        receiptSignatureKinds.length > 0 &&
        receiptSignature.kind === receiptSignatureKind &&
        receiptSignature.externalStrongBytes ===
          (receiptSignatureKinds.includes('external-strong-ngis-256') ? 260 : 0) &&
        receiptSignature.bytes === 'preserved-opaque' &&
        receiptSignature.status === 'invalidated-by-modification') ||
      (receiptSignature?.present === false &&
        receiptSignatureKindsValid &&
        receiptSignatureKinds.length === 0 &&
        receiptSignature.kind === 'none' &&
        receiptSignature.externalStrongBytes === 0 &&
        receiptSignature.bytes === 'absent' &&
        receiptSignature.status === 'not-present')
    ) ||
    !receiptChangesAreValid
  ) {
    diagnostics.push(
      error(
        'blizzard/mpq-native-export-intent-invalid',
        'native MPQ export requires a complete source snapshot and fixed-slot preservation receipt',
      ),
    )
  }
  if (
    change.targets.length !== 1 ||
    change.targets[0].expectedRevision.namespaceRevision === undefined
  ) {
    diagnostics.push(
      error(
        'blizzard/mpq-native-export-target-not-namespace',
        'native MPQ Save As requires one revision-pinned destination namespace',
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
      throw new TypeError('native MPQ Save As accepts one inline destination create')
    }
    if (
      edit.payload.bytes.byteLength > context.budgets.maxScalarBytes ||
      BigInt(edit.payload.bytes.byteLength) > context.budgets.maxInputBytes
    ) {
      throw new RangeError('native MPQ output exceeds the provider resource budget')
    }
    await parseArchive(edit.payload.bytes, context.budgets.maxNodes, signals)
    abort(signals)
    const outputDigest = await digest(edit.payload.bytes, signals)
    abort(signals)
    if (outputDigest !== receipt?.outputArchiveDigest) {
      throw new TypeError('native MPQ output digest does not match its preservation receipt')
    }
  } catch (cause) {
    if (cause?.name === 'AbortError') throw cause
    diagnostics.push(
      error(
        'blizzard/mpq-native-export-edit-invalid',
        cause instanceof Error ? cause.message : String(cause),
      ),
    )
  }
  return Object.freeze({ valid: diagnostics.length === 0, diagnostics: Object.freeze(diagnostics) })
}

export async function snapshotNativePreservingMpq(options) {
  const { target, archiveName: requestedArchiveName, signal } = options
  abort(signal)
  if (target?.expectedRevision?.namespaceRevision === undefined) {
    throw new TypeError('native MPQ Save As target is not a revision-pinned namespace')
  }
  const archiveName = archiveNameOf(requestedArchiveName)
  const encoded = await encodeNativePreservingMpq(options)
  abort(signal)
  return Object.freeze({
    targets: Object.freeze([target]),
    edits: Object.freeze([
      Object.freeze({
        operation: 'create',
        targetId: target.targetId,
        source: target.ownerSource,
        newPath: archiveName,
        payload: Object.freeze({ kind: 'inline', bytes: encoded.bytes }),
      }),
    ]),
    semanticIntent: Object.freeze({
      kind: 'mpq-native-preserving-export-v1',
      sourceMode: 'native-mpq',
      completeSnapshot: true,
      replacementMode: 'whole-archive-save-as',
      unknownDataPolicy: 'preserve-opaque-source-bytes',
      archiveName,
      nativeExportReceipt: encoded.receipt,
    }),
    provenance: Object.freeze({ actor: 'user', note: 'bounded native-preserving MPQ Save As' }),
  })
}

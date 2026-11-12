import { bzip2Decompress, createAdler32, decompressBounded } from '@modkit/codec-kit/compression'

const DEFAULT_MAX_SCAN_BYTES = 67_108_864
const DEFAULT_MAX_CANDIDATES = 131_072
const DEFAULT_MAX_BLOCKS = 16_384
const DEFAULT_MAX_DECODE_ATTEMPTS = 262_144
const DEFAULT_MAX_BOUNDARY_CANDIDATES = 64
const DEFAULT_MAX_DECODED_ENTRY_BYTES = 16_777_216
const DEFAULT_MAX_TOTAL_DECODED_BYTES = 67_108_864
const DEFAULT_RAW_CHUNK_SIZE = 0x4000

const HARD_MAX_BYTES = 1_073_741_824
const HARD_MAX_CANDIDATES = 1_000_000
const HARD_MAX_BLOCKS = 1_000_000
const HARD_MAX_DECODE_ATTEMPTS = 1_000_000
const HARD_MAX_BOUNDARY_CANDIDATES = 4_096
const HARD_MAX_RAW_CHUNK_SIZE = 1_048_576
const CHECKPOINT_BYTES = 65_536
const MAX_MD5_GAPS = 32

export const MPQ_RECOVERY_FAILED = 'blizzard/mpq-recovery-failed'
export const MPQ_RECOVERY_LIMIT = 'blizzard/mpq-recovery-limit'
export const MPQ_RECOVERED_WRITE_UNSUPPORTED = 'blizzard/mpq-recovered-write-unsupported'

function codedError(ErrorType, code, message, cause) {
  const result = new ErrorType(message, cause === undefined ? undefined : { cause })
  Object.defineProperty(result, 'code', { value: code, enumerable: true })
  return result
}

function recoveryFailure(message, cause) {
  return codedError(TypeError, MPQ_RECOVERY_FAILED, message, cause)
}

function recoveryLimit(message) {
  return codedError(RangeError, MPQ_RECOVERY_LIMIT, message)
}

function positiveSafeInteger(value, name, hardMaximum) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive safe integer`)
  }
  if (value > hardMaximum) throw recoveryLimit(`${name} exceeds its hard safety ceiling`)
  return value
}

function abort(signal) {
  signal?.throwIfAborted()
}

async function cancellationCheckpoint(signal) {
  abort(signal)
  if (signal === undefined) return
  await new Promise(resolve => setTimeout(resolve, 0))
  abort(signal)
}

function isZlibCandidate(bytes, offset, end) {
  if (offset + 3 > end || bytes[offset] !== 0x02) return false
  const cmf = bytes[offset + 1]
  const flg = bytes[offset + 2]
  return (cmf & 0x0f) === 8 && cmf >>> 4 <= 7 && ((cmf << 8) | flg) % 31 === 0 && (flg & 0x20) === 0
}

function isBzip2Candidate(bytes, offset, end) {
  return (
    offset + 5 <= end &&
    bytes[offset] === 0x10 &&
    bytes[offset + 1] === 0x42 &&
    bytes[offset + 2] === 0x5a &&
    bytes[offset + 3] === 0x68 &&
    bytes[offset + 4] >= 0x31 &&
    bytes[offset + 4] <= 0x39
  )
}

async function findCandidates(bytes, start, end, maxCandidates, signal) {
  const candidates = []
  for (let offset = start; offset < end; offset += 1) {
    if ((offset - start) % CHECKPOINT_BYTES === 0) await cancellationCheckpoint(signal)
    let method
    if (isZlibCandidate(bytes, offset, end)) method = 'zlib'
    else if (isBzip2Candidate(bytes, offset, end)) method = 'bzip2'
    else continue
    if (candidates.length >= maxCandidates) {
      throw recoveryLimit(`MPQ recovery exceeds maxCandidates (${maxCandidates})`)
    }
    candidates.push(Object.freeze({ offset, method }))
  }
  abort(signal)
  return candidates
}

function chargeDecodedWork(work, bytes) {
  work.decodedBytes += bytes
  if (!Number.isSafeInteger(work.decodedBytes) || work.decodedBytes > work.maximum) {
    throw recoveryLimit(`MPQ recovery exceeds maxTotalDecodedBytes (${work.maximum})`)
  }
}

async function decompressZlib(payload, maxOutputBytes, work, signal) {
  abort(signal)
  if (typeof DecompressionStream !== 'function') {
    throw recoveryFailure('MPQ recovery requires portable zlib decompression')
  }
  return decompressBounded(payload, 'deflate', {
    maxOutputBytes,
    ...(signal === undefined ? {} : { signal }),
    onChunk: bytes => chargeDecodedWork(work, bytes),
    outputLimitError: maximum =>
      recoveryLimit(`MPQ recovered entry exceeds its ${maximum}-byte decode bound`),
  })
}

async function checksumAdler32(bytes, signal) {
  const checksum = createAdler32()
  for (let offset = 0; offset < bytes.byteLength; offset += CHECKPOINT_BYTES) {
    await cancellationCheckpoint(signal)
    checksum.update(bytes.subarray(offset, offset + CHECKPOINT_BYTES))
  }
  abort(signal)
  return checksum.digest()
}

async function decodeCandidate(bytes, candidate, archivedSize, maxOutputBytes, work, signal) {
  if (!Number.isSafeInteger(archivedSize) || archivedSize <= 1) return undefined
  const end = candidate.offset + archivedSize
  if (end > bytes.byteLength) return undefined
  const raw = bytes.slice(candidate.offset, end)
  try {
    if (candidate.method === 'bzip2') {
      const decoded = bzip2Decompress(raw, {
        maxOutputBytes,
        ...(signal === undefined ? {} : { signal }),
      })
      chargeDecodedWork(work, decoded.byteLength)
      return decoded
    }
    if (!isZlibCandidate(raw, 0, raw.byteLength) || raw.byteLength < 7) return undefined
    const payload = raw.slice(1)
    const expectedAdler = new DataView(
      payload.buffer,
      payload.byteOffset + payload.byteLength - 4,
      4,
    ).getUint32(0, false)
    const decoded = await decompressZlib(payload, maxOutputBytes, work, signal)
    if ((await checksumAdler32(decoded, signal)) !== expectedAdler) return undefined
    return decoded
  } catch (cause) {
    abort(signal)
    if (cause?.code === MPQ_RECOVERY_LIMIT || cause instanceof RangeError) throw cause
    if (cause?.code === 'codec-kit/compression-output-limit') {
      throw recoveryLimit(`MPQ recovered entry exceeds its ${maxOutputBytes}-byte decode bound`)
    }
    return undefined
  }
}

function candidateSizes(span, rawChunkSize) {
  const sizes = []
  for (let gapIndex = 1; gapIndex <= MAX_MD5_GAPS; gapIndex += 1) {
    const gap = gapIndex * 16
    const archivedSize = span - gap
    if (archivedSize <= 1) continue
    if (Math.ceil(archivedSize / rawChunkSize) * 16 === gap) sizes.push(archivedSize)
  }
  if (span > 1) sizes.push(span)
  return sizes
}

function listfileHints(blocks) {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const bytes = blocks[index].bytes
    if (bytes.byteLength < 50 || bytes.byteLength > 8_192) continue
    let text
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      continue
    }
    if (!text.includes('\r\n')) continue
    const lines = text.trim().split(/\r?\n/u).filter(Boolean)
    if (lines.length < 3 || lines.length > 500) continue
    if (!lines.every(line => line.length < 150 && /^[\x20-\x7e]+$/u.test(line))) continue
    const pathLines = lines.filter(
      line => line.includes('\\') || /\.[A-Za-z0-9]{2,10}$/u.test(line) || line.startsWith('('),
    )
    if (pathLines.length < lines.length * 0.8) continue
    return Object.freeze(lines)
  }
  return Object.freeze([])
}

function scanEndFor(bytes, header, dataStart) {
  const tableOffsets = [header.hashOffset, header.blockOffset]
    .filter(value => Number.isSafeInteger(value) && value >= header.headerSize)
    .map(value => header.offset + value)
    .filter(value => value >= dataStart)
  return Math.min(
    bytes.byteLength,
    ...(tableOffsets.length === 0 ? [bytes.byteLength] : tableOffsets),
  )
}

/**
 * Recover a complete chain of independently validated compressed single-unit payloads.
 * Listfile-looking text is returned only as an unverified hint; it never assigns block ownership.
 */
export async function recoverArchive(bytes, header, options = {}) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('MPQ recovery source must be Uint8Array')
  if (typeof header !== 'object' || header === null || Array.isArray(header)) {
    throw new TypeError('MPQ recovery requires a parsed header')
  }
  const {
    rawChunkSize = DEFAULT_RAW_CHUNK_SIZE,
    maxScanBytes = DEFAULT_MAX_SCAN_BYTES,
    maxCandidates = DEFAULT_MAX_CANDIDATES,
    maxBlocks = DEFAULT_MAX_BLOCKS,
    maxDecodeAttempts = DEFAULT_MAX_DECODE_ATTEMPTS,
    maxBoundaryCandidates = DEFAULT_MAX_BOUNDARY_CANDIDATES,
    maxDecodedEntryBytes = DEFAULT_MAX_DECODED_ENTRY_BYTES,
    maxTotalDecodedBytes = DEFAULT_MAX_TOTAL_DECODED_BYTES,
    signal,
  } = options
  positiveSafeInteger(rawChunkSize, 'rawChunkSize', HARD_MAX_RAW_CHUNK_SIZE)
  positiveSafeInteger(maxScanBytes, 'maxScanBytes', HARD_MAX_BYTES)
  positiveSafeInteger(maxCandidates, 'maxCandidates', HARD_MAX_CANDIDATES)
  positiveSafeInteger(maxBlocks, 'maxBlocks', HARD_MAX_BLOCKS)
  positiveSafeInteger(maxDecodeAttempts, 'maxDecodeAttempts', HARD_MAX_DECODE_ATTEMPTS)
  positiveSafeInteger(maxBoundaryCandidates, 'maxBoundaryCandidates', HARD_MAX_BOUNDARY_CANDIDATES)
  positiveSafeInteger(maxDecodedEntryBytes, 'maxDecodedEntryBytes', HARD_MAX_BYTES)
  positiveSafeInteger(maxTotalDecodedBytes, 'maxTotalDecodedBytes', HARD_MAX_BYTES)
  abort(signal)

  const dataStart = header.offset + header.headerSize
  if (!Number.isSafeInteger(dataStart) || dataStart < 0 || dataStart > bytes.byteLength) {
    throw recoveryFailure('MPQ recovery data range is invalid')
  }
  const scanEnd = scanEndFor(bytes, header, dataStart)
  const scanBytes = scanEnd - dataStart
  if (scanBytes <= 0) throw recoveryFailure('MPQ recovery found no archive data to scan')
  if (scanBytes > maxScanBytes) {
    throw recoveryLimit(`MPQ recovery scan exceeds maxScanBytes (${maxScanBytes})`)
  }

  const candidates = await findCandidates(bytes, dataStart, scanEnd, maxCandidates, signal)
  if (candidates.length === 0 || candidates[0].offset !== dataStart) {
    throw recoveryFailure('MPQ recovery found no complete compressed block chain')
  }

  const blocks = []
  let candidateIndex = 0
  let decodeAttempts = 0
  const decodedWork = { decodedBytes: 0, maximum: maxTotalDecodedBytes }
  while (candidateIndex < candidates.length) {
    await cancellationCheckpoint(signal)
    if (blocks.length >= maxBlocks) {
      throw recoveryLimit(`MPQ recovery exceeds maxBlocks (${maxBlocks})`)
    }
    const candidate = candidates[candidateIndex]
    const lastBoundaryIndex = Math.min(candidates.length, candidateIndex + maxBoundaryCandidates)
    let resolved
    for (
      let boundaryIndex = candidateIndex + 1;
      boundaryIndex <= lastBoundaryIndex;
      boundaryIndex += 1
    ) {
      const atEnd = boundaryIndex === candidates.length
      const boundary = atEnd ? scanEnd : candidates[boundaryIndex].offset
      const span = boundary - candidate.offset
      for (const archivedSize of candidateSizes(span, rawChunkSize)) {
        decodeAttempts += 1
        if (decodeAttempts > maxDecodeAttempts) {
          throw recoveryLimit(`MPQ recovery exceeds maxDecodeAttempts (${maxDecodeAttempts})`)
        }
        const remainingDecodedBytes = decodedWork.maximum - decodedWork.decodedBytes
        if (remainingDecodedBytes <= 0) {
          throw recoveryLimit(`MPQ recovery exceeds maxTotalDecodedBytes (${maxTotalDecodedBytes})`)
        }
        const decoded = await decodeCandidate(
          bytes,
          candidate,
          archivedSize,
          Math.min(maxDecodedEntryBytes, remainingDecodedBytes),
          decodedWork,
          signal,
        )
        if (decoded === undefined) continue
        if (decoded.byteLength > maxDecodedEntryBytes) {
          throw recoveryLimit(
            `MPQ recovered entry exceeds maxDecodedEntryBytes (${maxDecodedEntryBytes})`,
          )
        }
        resolved = { boundaryIndex, archivedSize, decoded }
        break
      }
      if (resolved !== undefined) break
    }
    if (resolved === undefined) {
      throw recoveryFailure('MPQ recovery could not validate a complete compressed block chain')
    }
    const index = blocks.length
    blocks.push(
      Object.freeze({
        id: `recovered/block/${String(index).padStart(4, '0')}`,
        index,
        offset: candidate.offset,
        archivedSize: resolved.archivedSize,
        size: resolved.decoded.byteLength,
        method: candidate.method,
        bytes: resolved.decoded,
      }),
    )
    candidateIndex = resolved.boundaryIndex
  }
  if (blocks.length === 0 || candidateIndex !== candidates.length) {
    throw recoveryFailure('MPQ recovery did not cover the complete compressed block chain')
  }
  abort(signal)
  return Object.freeze({
    schemaVersion: 1,
    kind: 'mpq-compressed-block-recovery-v1',
    recovery: true,
    complete: false,
    scanStart: dataStart,
    scanEnd,
    scanBytes,
    recoveredBlocks: blocks.length,
    decodeAttempts,
    decodedBytes: blocks.reduce((sum, block) => sum + block.size, 0),
    entries: Object.freeze(blocks),
    unverifiedListfileHints: listfileHints(blocks),
  })
}

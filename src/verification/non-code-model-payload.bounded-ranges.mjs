// Independent bounded MD34 reader. Layout facts: SC2Mapster/m3addon structures.xml
// (MD34V11, MD34IndexEntryV0 and primitive block sizes). No model is rewritten.
// CHAR, unknown structures, alignment bytes and opaque tails remain scanned.
const sizes = Object.freeze({
  U8__: 1,
  I16_: 2,
  U16_: 2,
  I32_: 4,
  U32_: 4,
  U64_: 8,
  REAL: 4,
  FLAG: 4,
  VEC2: 8,
  VEC3: 12,
  VEC4: 16,
  QUAT: 16,
});
const tag = (b, p) =>
  [...b.subarray(p, p + 4)]
    .reverse()
    .map((n) => String.fromCharCode(n))
    .join('');
export function inspectNonCodeModelPayload(fileName, bytes) {
  const name = fileName.replaceAll('\\', '/');
  if (
    !/\.m3$/iu.test(name) ||
    name.split('/').some((p) => p === '.' || p === '..') ||
    bytes.length < 40 ||
    tag(bytes, 0) !== 'MD34'
  )
    return;
  const u = (p) => bytes.readUInt32LE(p),
    indexOffset = u(4),
    indexSize = u(8),
    indexEnd = indexOffset + indexSize * 16;
  if (
    indexSize < 2 ||
    indexSize > 100000 ||
    indexOffset < 24 ||
    indexOffset % 16 ||
    indexEnd > bytes.length ||
    u(12) !== 1 ||
    u(16) >= indexSize
  )
    return;
  const entries = [];
  for (let i = 0; i < indexSize; i++) {
    const p = indexOffset + i * 16,
      kind = tag(bytes, p),
      offset = u(p + 4),
      count = u(p + 8),
      version = u(p + 12);
    if (
      !/^[A-Z0-9_]{4}$/u.test(kind) ||
      offset >= indexOffset ||
      offset % 16 ||
      count < 1 ||
      version > 65535
    )
      return;
    entries.push({ kind, offset, count, version, index: i });
  }
  const header = entries.filter((e) => e.kind === 'MD34');
  if (
    header.length !== 1 ||
    header[0].offset !== 0 ||
    header[0].count !== 1 ||
    header[0].version !== 11 ||
    entries[u(16)].kind !== 'MODL'
  )
    return;
  const ordered = entries.toSorted((a, b) => a.offset - b.offset);
  if (new Set(ordered.map((e) => e.offset)).size !== entries.length) return;
  const numeric = [],
    ranges = [
      { start: 0, end: 24 },
      { start: indexOffset, end: indexEnd },
    ];
  for (let i = 0; i < ordered.length; i++) {
    const e = ordered[i],
      next = ordered[i + 1]?.offset ?? indexOffset,
      size = sizes[e.kind];
    if (e.offset === 0) {
      if (next < 24) return;
      continue;
    }
    if (e.offset < 24 || next <= e.offset) return;
    if (!size || e.version !== 0) continue;
    const end = e.offset + e.count * size;
    if (!Number.isSafeInteger(end) || end > next) return;
    ranges.push({ start: e.offset, end });
    numeric.push({ ...e, elementBytes: size, end });
  }
  ranges.sort((a, b) => a.start - b.start);
  const nonReferenceRanges = [];
  for (const r of ranges) {
    const last = nonReferenceRanges.at(-1);
    if (last && last.end > r.start) return;
    if (last && last.end === r.start) last.end = r.end;
    else nonReferenceRanges.push({ ...r });
  }
  const opaqueRanges = [];
  let cursor = 0;
  for (const r of nonReferenceRanges) {
    if (r.start > cursor) opaqueRanges.push({ start: cursor, end: r.start });
    cursor = r.end;
  }
  if (cursor < bytes.length) opaqueRanges.push({ start: cursor, end: bytes.length });
  return {
    kind: 'MD34_VALIDATED_INDEX_AND_PRIMITIVE_NUMERIC_RANGES',
    indexOffset,
    indexSize,
    indexEnd,
    numericBlocks: numeric,
    nonReferenceRanges,
    opaqueRanges,
    sourceOrAssetChanged: false,
    scope:
      'Standard M3 model loading and supplied Galaxy/native observers. Unknown/CHAR blocks and gaps remain opaque; no claim about arbitrary custom binary loaders.',
  };
}

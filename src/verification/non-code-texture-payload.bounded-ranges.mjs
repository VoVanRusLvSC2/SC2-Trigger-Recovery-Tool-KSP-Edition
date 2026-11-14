// A typed resource view, not a texture rewrite. Only the bounded DDS header and
// dimensions/format-derived pixel ranges are non-reference fields. Unknown tail
// bytes remain opaque and must be checked for all protected identities.
// https://learn.microsoft.com/en-us/windows/win32/direct3ddds/dx-graphics-dds-pguide
export function inspectNonCodeTexturePayload(fileName, bytes) {
  const name = fileName.replaceAll('\\', '/');
  if (
    !/\.dds$/iu.test(name) ||
    name.split('/').some((p) => p === '.' || p === '..') ||
    bytes.length < 128 ||
    bytes.toString('ascii', 0, 4) !== 'DDS '
  )
    return;
  const u = (i) => bytes.readUInt32LE(i),
    flags = u(8),
    width = u(16),
    height = u(12),
    mips = u(28) || 1,
    pf = u(80),
    fourcc = bytes.toString('ascii', 84, 88),
    block = { DXT1: 8, DXT3: 16, DXT5: 16 }[fourcc];
  if (
    u(4) !== 124 ||
    u(76) !== 32 ||
    (flags & 0x1007) !== 0x1007 ||
    flags & 0x800000 ||
    u(24) > 1 ||
    !width ||
    !height ||
    width > 16384 ||
    height > 16384 ||
    mips > Math.floor(Math.log2(Math.max(width, height))) + 1 ||
    !(u(108) & 0x1000)
  )
    return;
  const cube = u(112),
    faces = cube === 0 ? 1 : cube === 0xfe00 && width === height ? 6 : 0;
  if (!faces) return;
  let format, bytesPerPixel;
  if (pf === 4 && block) {
    if ([88, 92, 96, 100, 104].some((i) => u(i) !== 0)) return;
    format = fourcc;
  } else if ((pf === 0x40 || pf === 0x41) && u(84) === 0 && u(88) === 32) {
    const masks = [92, 96, 100, 104].map(u);
    if (
      masks.slice(0, 3).some((n) => !n) ||
      (pf === 0x41 && !masks[3]) ||
      (pf === 0x40 && masks[3])
    )
      return;
    let used = 0n;
    for (const value of masks) {
      let mask = BigInt(value);
      if (mask & used) return;
      used |= mask;
      if (mask) {
        while (!(mask & 1n)) mask >>= 1n;
        if (mask & (mask + 1n)) return;
      }
    }
    format = 'MASKED_RGB32';
    bytesPerPixel = 4;
  } else return;
  let size = 0,
    w = width,
    h = height;
  for (let i = 0; i < mips; i++) {
    size += block ? Math.ceil(w / 4) * Math.ceil(h / 4) * block : w * h * bytesPerPixel;
    w = Math.max(1, w >> 1);
    h = Math.max(1, h >> 1);
  }
  size *= faces;
  const end = 128 + size;
  if (!Number.isSafeInteger(end) || bytes.length < end) return;
  return {
    kind: 'DDS_BOUNDED_HEADER_AND_PIXEL_RANGES',
    format,
    width,
    height,
    mips,
    faces,
    pixelBytes: size,
    headerBytes: 128,
    nonReferenceRanges: [{ start: 0, end }],
    opaqueRanges: end < bytes.length ? [{ start: end, end: bytes.length }] : [],
    declaredLinearSize: u(20),
    computedBaseSurfaceBytes: block
      ? Math.ceil(width / 4) * Math.ceil(height / 4) * block
      : width * height * bytesPerPixel,
    sourceOrAssetChanged: false,
    scope:
      'Standard texture loading and supplied Galaxy/native name/storage observers; not arbitrary external custom binary loaders.',
  };
}

/** Library ownership comes from the compiler's body/header pairs, never map names. */
export function modLibraryUnits(paths) {
  const byName = new Map(paths.map((name) => [name.replaceAll('\\', '/').toLowerCase(), name]));
  return paths.flatMap((body) => {
    const normalized = body.replaceAll('\\', '/');
    const match = /(?:^|\/)Lib([A-Za-z0-9]+)\.galaxy$/i.exec(normalized);
    if (!match) return [];
    const header = byName.get(normalized.replace(/\.galaxy$/i, '_h.galaxy').toLowerCase());
    return header ? [{ libraryId: match[1], body, header }] : [];
  });
}

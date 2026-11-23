const ascii = /^[\x20-\x7e]+$/u;
const maxPrefixMatches = 32768;

/** A package-relative view of the live CASC name index. */
export function blizzardPackageIndex(source, packagePath, read) {
  const base = packagePath.toLowerCase() + '/';
  let localeComponents;
  return {
    async list(prefix) {
      if (!ascii.test(prefix)) return;
      const index = (await source.open()).entryIndex;
      const key = base + prefix;
      const next = key.slice(0, -1) + String.fromCharCode(key.charCodeAt(key.length - 1) + 1);
      const start = index.lowerBound(key);
      const end = index.lowerBound(next);
      // Let the existing listing handle broad queries and names outside ASCII sort order.
      if (end - start > maxPrefixMatches) return;
      const matches = [];
      for (let row = start; row < end; row++) {
        const relative = index.keyAt(row).slice(base.length);
        if (!ascii.test(relative)) return;
        matches.push(relative);
      }
      return matches;
    },
    async find(spellings) {
      const index = (await source.open()).entryIndex;
      for (const spelling of spellings) {
        const key = base + spelling;
        const row = index.lowerBound(key);
        if (row < index.size && index.keyAt(row) === key) return spelling;
      }
    },
    localeComponents() {
      return (localeComponents ??= source.list(packagePath).then((entries) =>
        entries
          .filter(
            (entry) =>
              entry.directory &&
              entry.name.endsWith('.sc2assets') &&
              entry.name !== 'base.sc2assets',
          )
          .map((entry) => entry.name)
          .sort(),
      ));
    },
    read: (file) => read(packagePath + '/' + file, 64 * 1024 ** 2),
  };
}

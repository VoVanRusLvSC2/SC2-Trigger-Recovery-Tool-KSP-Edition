/** Read only keys actually required for GUI captions. Do not edit localization tables. */
export function filterCaptionTables(tables, keys) {
  return tables.map((source) => ({
    ...source,
    values: source.values.filter((line) => {
      const at = line.indexOf('=');
      return at > 0 && keys.has(line.slice(0, at).replace(/^\uFEFF/, ''));
    }),
  }));
}

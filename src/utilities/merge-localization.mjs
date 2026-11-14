/** Linear localization merge; preserves original bytes and last-key semantics.
 * No cache escapes this call. All authored keys are still independently checked.
 */
import assert from 'node:assert/strict';
export const localizationTable = (text) =>
  new Map(
    text
      .replace(/^\uFEFF/u, '')
      .split(/\r?\n/u)
      .flatMap((line) => {
        const at = line.indexOf('=');
        return at > 0 ? [[line.slice(0, at), line.slice(at + 1)]] : [];
      }),
  );
export function mergeLocalization(original, generated) {
  const raw = original.toString('utf8'),
    before = localizationTable(raw),
    after = localizationTable(generated);
  const additions = [...after].filter(([key]) => !before.has(key));
  const newline = raw.includes('\r\n') ? '\r\n' : '\n';
  const combined =
    raw +
    (additions.length && raw && !raw.endsWith('\n') ? newline : '') +
    additions.map(([key, value]) => key + '=' + value + newline).join('');
  // Parse once, instead of reparsing O(keys) bytes separately for every key.
  const preserved = localizationTable(combined);
  assert([...before].every(([key, value]) => preserved.get(key) === value));
  return {
    bytes: Buffer.from(combined),
    added: additions.length,
    conflicts: [...after].filter(([key, value]) => before.has(key) && before.get(key) !== value)
      .length,
  };
}

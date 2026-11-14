/** Narrow C escape reader for source-bound ASCII callback registrations.
 * It does not guess Unicode/overflow semantics and is not a general lexer patch.
 */
export function decodeBoundAsciiString(node, source) {
  if (node?.kind !== 3 || !Number.isInteger(node.pos) || !Number.isInteger(node.end))
    return undefined;
  const raw = source.slice(node.pos, node.end).trim();
  if (raw[0] !== '"' || raw.at(-1) !== '"') return undefined;
  let out = '';
  for (let i = 1; i < raw.length - 1; i++) {
    const c = raw[i];
    if (c !== '\\') {
      if (c === '"' || c.charCodeAt(0) > 127 || c === '\r' || c === '\n') return undefined;
      out += c;
      continue;
    }
    const next = raw[++i];
    if (next === undefined) return undefined;
    if (/[0-7]/u.test(next)) {
      let digits = next;
      while (digits.length < 3 && /[0-7]/u.test(raw[i + 1] ?? '') && i + 1 < raw.length - 1)
        digits += raw[++i];
      const value = parseInt(digits, 8);
      if (value > 127) return undefined;
      out += String.fromCharCode(value);
      continue;
    }
    if (next === 'x') {
      let digits = '';
      while (i + 1 < raw.length - 1 && /[0-9A-Fa-f]/u.test(raw[i + 1])) digits += raw[++i];
      if (!digits) return undefined;
      const value = parseInt(digits, 16);
      if (value > 127 || !Number.isSafeInteger(value)) return undefined;
      out += String.fromCharCode(value);
      continue;
    }
    const escapes = {
      '\\': '\\',
      '"': '"',
      "'": "'",
      n: '\n',
      r: '\r',
      t: '\t',
      b: '\b',
      f: '\f',
      v: '\v',
      a: '\x07',
    };
    if (!(next in escapes)) return undefined;
    out += escapes[next];
  }
  return out;
}

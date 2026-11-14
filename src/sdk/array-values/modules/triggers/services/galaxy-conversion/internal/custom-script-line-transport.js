/** Native 0577 evidence: one raw ScriptCode line was cut at 4095 characters.
 * Insert whitespace only outside tokens/comments, at statement/block borders.
 * Small scripts retain their original formatting. Never split a string value.
 */
export function wrapCustomScriptLines(source) {
  const bytes = s => new TextEncoder().encode(s).length;
  if (!source.split('\n').some(line => bytes(line) > 3000)) return source;
  let out = '', mode = 'code';
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    out += c;
    if (mode === 'string' || mode === 'char') {
      if (c === '\\' && next !== undefined) {out += next; i++;}
      else if (c === (mode === 'string' ? '"' : "'")) mode = 'code';
      continue;
    }
    if (mode === 'line') {if (c === '\n') mode = 'code'; continue;}
    if (mode === 'block') {
      if (c === '*' && next === '/') {out += next; i++; mode = 'code';}
      continue;
    }
    if (c === '"') mode = 'string';
    else if (c === "'") mode = 'char';
    else if (c === '/' && (next === '/' || next === '*')) {
      out += next; i++; mode = next === '/' ? 'line' : 'block';
    } else if (';{}'.includes(c) && next !== '\n') out += '\n';
  }
  if (out.split('\n').some(line => bytes(line) > 3000)) {
    // A huge atomic literal or expression cannot be safely solved by this
    // formatting rule. Fail explicitly instead of accepting silent truncation.
    throw new Error('CUSTOM_SCRIPT_LINE_TOO_LONG: no lossless statement-boundary transport under 3000 UTF-8 bytes');
  }
  return out;
}

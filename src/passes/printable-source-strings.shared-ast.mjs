/** Normalize only source-owned, decoded printable ASCII literals before G2T.
 * Keep controls/non-ASCII/unsupported escapes verbatim for separate transport.
 * No calls, identifiers, operators, comments or statement order are edited.
 */
import { decodeBoundAsciiString } from '../utilities/galaxy-ascii-string.mjs';
const ignored = new Set(['parent', 'symbol', 'locals', 'flowNode', 'syntaxTokens']);
export function normalizePrintableSourceStrings(text, parse, document) {
  const ast = document ? document.input(text) : parse(text);
  if (ast.parseDiagnostics?.length)
    throw Error(
      'String normalization source syntax errors: ' +
        JSON.stringify(
          ast.parseDiagnostics.map((d) => ({
            start: d.start,
            length: d.length,
            message: d.messageText ?? d.message,
          })),
        ),
    );
  const edits = [],
    pending = [ast];
  while (pending.length) {
    const n = pending.pop();
    if (!n || typeof n !== 'object') continue;
    if (n.kind === 3) {
      const raw = text.slice(n.pos, n.end).trim();
      if (raw !== n.text) throw Error('String token source ownership differs');
      const value = raw.includes('\\') ? decodeBoundAsciiString(n, text) : undefined;
      if (value !== undefined && !/[\x00-\x1f\x7f]/u.test(value)) {
        const quoted = JSON.stringify(value);
        if (raw !== quoted) {
          const start = n.pos + text.slice(n.pos, n.end).indexOf(raw);
          edits.push({ start, end: start + raw.length, raw, quoted, value });
        }
      }
    }
    for (const key of Object.keys(n)) {
      const child = n[key];
      if (!child || typeof child !== 'object' || ignored.has(key)) continue;
      if (Array.isArray(child)) pending.push(...child);
      else pending.push(child);
    }
  }
  edits.sort((a, b) => b.start - a.start);
  const chunks = [];
  let boundary = text.length;
  for (const edit of edits) {
    if (edit.end > boundary) throw Error('String token edits overlap');
    chunks.push(text.slice(edit.end, boundary), edit.quoted);
    boundary = edit.start;
  }
  if (edits.length) chunks.push(text.slice(0, boundary));
  const out = edits.length ? chunks.reverse().join('') : text;
  const after = document ? document.output(out) : parse(out);
  if (after.parseDiagnostics?.length) throw Error('Normalized string source syntax errors');
  return {
    text: out,
    proof: {
      literalEdits: edits.length,
      examples: edits.slice(0, 12).map(({ raw, quoted, value }) => ({ raw, quoted, value })),
      controlAndNonAsciiLiteralsPreserved: true,
      sourceArchiveChanged: false,
      nativeAcceptance: false,
    },
  };
}

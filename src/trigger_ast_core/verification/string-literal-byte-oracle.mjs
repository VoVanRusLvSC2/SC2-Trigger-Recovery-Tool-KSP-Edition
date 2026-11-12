// An additional veto on a raw oracle MATCH. The independent oracle is unchanged;
// projection can never upgrade REVIEW. No projected text is compiled or saved
// to a source/candidate map. Ordinary root/SDK/resource gates remain mandatory.
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
import {forEachChild, SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function project(source, fileName) {
  const ast = parseImmutableGalaxySyntax(source, fileName);
  if (ast.parseDiagnostics.length) return {status: 'UNVERIFIED_SYNTAX', diagnostics: ast.parseDiagnostics.length};
  const edits = [], issues = [];
  const walk = node => {
    if (!node) return;
    if (node.kind === K.StringLiteral) {
      const token = node.text, start = node.end - token.length;
      if (start < node.pos || source.slice(start, node.end) !== token) {
        issues.push({reason: 'LITERAL_SOURCE_OWNERSHIP', start: node.pos}); return;
      }
      const literal = readStringLiteralValue(token);
      if (!literal) { issues.push({reason: 'UNSUPPORTED_LITERAL_BYTES', start}); return; }
      // Hex is injective for arbitrary byte strings, including empty, controls,
      // high bytes and literal text resembling this prefix. There are no escape
      // sequences left for the old oracle's loose scanner to misinterpret.
      edits.push({start, end: node.end, replacement: JSON.stringify('bytes:' + literal.bytes.toString('hex'))});
    }
    forEachChild(node, walk);
  };
  walk(ast);
  if (issues.length) return {status: 'UNVERIFIED_LITERAL_BYTES', issues};
  let text = source, boundary = source.length;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    if (edit.end > boundary) return {status: 'UNVERIFIED_OVERLAPPING_LITERALS'};
    text = text.slice(0, edit.start) + edit.replacement + text.slice(edit.end); boundary = edit.start;
  }
  return {status: 'PROJECTED', text, literalCount: edits.length};
}

export function guardOracleLiteralBytes(oracle, before, after, raw, options = {libraryId: 'Map', sampleLimit: 12}) {
  const start = performance.now();
  const base = {rawExact: raw.exact === true, rawOracleChanged: false, sourceOrCandidateChanged: false,
    sourceSha256: sha(before), generatedSha256: sha(after), wholeProgramEquivalent: false};
  if (raw.exact !== true) return {...base, status: 'NOT_NEEDED_RAW_ORACLE_NOT_MATCH',
    matchAllowed: false, semanticDifferenceProved: false, seconds: (performance.now() - start) / 1000};
  const a = project(before, 'original-literal-bytes.galaxy'), b = project(after, 'generated-literal-bytes.galaxy');
  const metadata = value => ({status: value.status, literalCount: value.literalCount, issues: value.issues});
  if (a.status !== 'PROJECTED' || b.status !== 'PROJECTED') return {...base,
    status: 'REVIEW_LITERAL_BYTES_UNVERIFIED', matchAllowed: false, semanticDifferenceProved: false,
    original: metadata(a), generated: metadata(b), seconds: (performance.now() - start) / 1000};
  const comparison = JSON.parse(JSON.stringify(oracle.compareGalaxy(a.text, b.text, options)));
  return {...base, status: comparison.exact === true ? 'PASSED_RAW_MATCH_LITERAL_BYTE_GUARD' : 'REVIEW_LITERAL_BYTE_PROJECTION',
    matchAllowed: comparison.exact === true, semanticDifferenceProved: false,
    original: metadata(a), generated: metadata(b), comparison,
    scope: 'A necessary additional check on raw MATCH, not a sufficient code/root/engine proof. Projection REVIEW can also represent a legitimate guarded callback rename.',
    seconds: (performance.now() - start) / 1000};
}

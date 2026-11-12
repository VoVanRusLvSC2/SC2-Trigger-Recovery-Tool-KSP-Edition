// Exact closed integer arithmetic only: no host floating point, division,
// overflow, implicit fixed conversion, const lookup, calls, or state reads.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K, forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha = text => createHash('sha256').update(text).digest('hex');
const minimum = -2147483648n, maximum = 2147483647n;
const bounded = value => value >= minimum && value <= maximum;
function evaluate(node, depth = 0) {
  if (!node || depth > 32) return;
  if (node.kind === K.ParenthesizedExpression) return evaluate(node.expression, depth + 1);
  if (node.kind === K.NumericLiteral) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(node.text ?? '') || node.text.length > 10) return;
    const value = BigInt(node.text);return bounded(value) ? value : undefined;
  }
  if (node.kind === K.PrefixUnaryExpression && [K.PlusToken, K.MinusToken].includes(node.operator?.kind)) {
    const operand = evaluate(node.operand, depth + 1);if (operand === undefined) return;
    const value = node.operator.kind === K.MinusToken ? -operand : operand;return bounded(value) ? value : undefined;
  }
  if (node.kind !== K.BinaryExpression || ![K.PlusToken, K.MinusToken, K.AsteriskToken].includes(node.operatorToken?.kind)) return;
  const a = evaluate(node.left, depth + 1), b = evaluate(node.right, depth + 1);if (a === undefined || b === undefined) return;
  const value = node.operatorToken.kind === K.PlusToken ? a + b : node.operatorToken.kind === K.MinusToken ? a - b : a * b;
  return bounded(value) ? value : undefined;
}
export function canonicalClosedIntegerLiteralArithmetic(text) {
  const ast = parseImmutableGalaxySyntax(text, 'integer-arithmetic.galaxy');assert.equal(ast.parseDiagnostics.length, 0);
  const edits = [], pending = [ast];
  while (pending.length) {
    const node = pending.pop();
    if (node.kind === K.BinaryExpression) {
      const value = evaluate(node);
      if (value !== undefined) {
        edits.push({start: node.pos, end: node.end, before: text.slice(node.pos, node.end), replacement: `(${value})`, result: value.toString(),
          everyIntermediateWithinSignedInt32: true});continue;
      }
    }
    const children = [];forEachChild(node, child => {children.push(child);});pending.push(...children);
  }
  edits.sort((a, b) => a.start - b.start);
  for (let i = 1; i < edits.length; i++) assert(edits[i - 1].end <= edits[i].start);
  let result = text;
  for (const edit of [...edits].reverse()) {
    assert.equal(result.slice(edit.start, edit.end), edit.before);
    result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
  }
  assert.equal(parseImmutableGalaxySyntax(result, 'integer-arithmetic-result.galaxy').parseDiagnostics.length, 0);
  return {text: result, proof: {kind: 'CLOSED_DECIMAL_INT32_ADDITION_SUBTRACTION_MULTIPLICATION', sourceSha256: sha(text), proofInputSha256: sha(result), edits,
    fixedAndAmbiguousNumericTokensNeverEvaluated: true, callsNamesAndStateReadsNeverEvaluated: true, allOtherSourceBytesUnchanged: true,
    sourceOrExportChanged: false, rawOracleReplaced: false, wholeMapAccepted: false}};
}

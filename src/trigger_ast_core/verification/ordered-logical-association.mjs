import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K, forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha = text => createHash('sha256').update(text).digest('hex');
const unwrap = node => node?.kind === K.ParenthesizedExpression ? unwrap(node.expression) : node;
const logical = node => node?.kind === K.BinaryExpression && [K.AmpersandAmpersandToken, K.BarBarToken].includes(node.operatorToken?.kind);
function leaves(node, operator, output = []) {
  node = unwrap(node);
  if (logical(node) && node.operatorToken.kind === operator) {
    leaves(node.left, operator, output);leaves(node.right, operator, output);
  } else output.push(node);
  return output;
}
const ignored = new Set(['parent', 'pos', 'end', 'line', 'char', 'syntaxTokens', 'comments', 'symbol', 'locals', 'flowNode']);
function associationShape(node) {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(associationShape);
  if (node.kind === K.ParenthesizedExpression) return associationShape(node.expression);
  if (logical(node)) return {logicalOperator: node.operatorToken.kind,
    orderedOperands: leaves(node, node.operatorToken.kind).map(associationShape)};
  return Object.fromEntries(Object.entries(node).filter(([key]) => !ignored.has(key)).map(([key, value]) => [key, associationShape(value)]));
}

// Associativity of one logical operator preserves each operand's evaluation
// predicate and left-to-right order, including calls and short-circuit effects.
// Do not commute operands, flatten mixed operators, or alter arithmetic/bitwise.
export function canonicalOrderedLogicalAssociation(source) {
  const ast = parseImmutableGalaxySyntax(source, 'logical-association.galaxy');
  assert.equal(ast.parseDiagnostics.length, 0);
  const records = [];
  function rewrite(node) {
    if (logical(node)) {
      const parts = leaves(node, node.operatorToken.kind), operator = node.operatorToken.kind === K.AmpersandAmpersandToken ? '&&' : '||';
      const texts = parts.map(rewrite);
      let text = '(' + texts[0] + ')';
      for (const next of texts.slice(1)) text = '(' + text + ' ' + operator + ' (' + next + '))';
      records.push({start: node.pos, end: node.end, operator, operands: parts.map(part => ({start: part.pos, end: part.end})),
        operandOrderUnchanged: true, shortCircuitPredicatesUnchanged: true});
      return text;
    }
    const edits = [];
    forEachChild(node, child => {
      const text = rewrite(child);
      if (text !== source.slice(child.pos, child.end)) edits.push({start: child.pos, end: child.end, text});
    });
    edits.sort((a, b) => a.start - b.start);
    for (let i = 1; i < edits.length; i++) assert(edits[i - 1].end <= edits[i].start, 'LOGICAL_AST_CHILD_OVERLAP');
    let text = source.slice(node.pos, node.end);
    for (const edit of edits.reverse()) text = text.slice(0, edit.start - node.pos) + edit.text + text.slice(edit.end - node.pos);
    return text;
  }
  const text = rewrite(ast), after = parseImmutableGalaxySyntax(text, 'logical-associated.galaxy');
  assert.equal(after.parseDiagnostics.length, 0);
  assert.deepEqual(associationShape(after.statements), associationShape(ast.statements), 'LOGICAL_OTHER_AST_CHANGED');
  return {text, proof: {kind: 'ORDERED_SHORT_CIRCUIT_ASSOCIATION', sourceSha256: sha(source), viewSha256: sha(text), records,
    commutationAllowed: false, mixedOperatorsFlattened: false, sourceOrExportChanged: false, rawOracleReplaced: false, wholeMapAccepted: false}};
}

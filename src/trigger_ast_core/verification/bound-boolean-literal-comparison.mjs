// Proof view only. No truthiness conversion or inferred native return type.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../../trigger_ast_implementation_2026-10-07/source-bug-v1670/verified-input-v1689/galaxy-program-context.identity.mjs';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K, forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha = text => createHash('sha256').update(text).digest('hex');
const unwrap = node => {while (node?.kind === K.ParenthesizedExpression) node = node.expression;return node;};
const literal = node => [K.TrueKeyword, K.FalseKeyword].includes(unwrap(node)?.kind);
export function canonicalBoundBooleanLiteralComparisons(text) {
  const input = {fileName: 'boolean-comparison.galaxy', sourceId: 'boolean-comparison', text, owned: true, contentSha256: sha(text)};
  const program = new GalaxyProgramContext([input], {files: [input], dependencies: []}, sha);
  try {
    const ast = program.documents.get(input.fileName);program.attachOriginal(ast);
    assert.equal(ast.parseDiagnostics.length, 0, 'BOOLEAN_COMPARISON_SYNTAX');
    const edits = [], refused = [], pending = [ast];
    while (pending.length) {
      const node = pending.pop();
      const children = [];forEachChild(node, child => {children.push(child);});pending.push(...children);
      if (node.kind !== K.BinaryExpression || ![K.EqualsEqualsToken, K.ExclamationEqualsToken].includes(node.operatorToken?.kind)) continue;
      let value, reference;
      if (literal(node.right)) {value = unwrap(node.right);reference = unwrap(node.left);}
      else if (literal(node.left)) {value = unwrap(node.left);reference = unwrap(node.right);}
      else continue;
      if (reference?.kind !== K.Identifier) continue;
      const binding = program.getBinding(reference), declaration = program.declarationAt(reference);
      if (binding.status !== 'BOUND' || !declaration || ![K.VariableDeclaration, K.ParameterDeclaration].includes(declaration.kind) || declaration.type?.kind !== K.BoolKeyword) {
        refused.push({start: node.pos, reason: 'UNIQUE_SCALAR_BOOLEAN_BINDING_NOT_PROVED'});continue;
      }
      const positive = (value.kind === K.TrueKeyword) === (node.operatorToken.kind === K.EqualsEqualsToken);
      const spelling = text.slice(reference.pos, reference.end);
      edits.push({start: node.pos, end: node.end, before: text.slice(node.pos, node.end),
        replacement: positive ? `(${spelling})` : `(!(${spelling}))`,
        symbolId: binding.symbolId, declarationPosition: declaration.pos,
        declarationType: 'bool', referenceEvaluationsBefore: 1, referenceEvaluationsAfter: 1});
    }
    edits.sort((a, b) => a.start - b.start);
    for (let i = 1; i < edits.length; i++) assert(edits[i - 1].end <= edits[i].start, 'BOOLEAN_COMPARISON_OVERLAP');
    let result = text;
    for (const edit of [...edits].reverse()) {
      assert.equal(result.slice(edit.start, edit.end), edit.before);
      result = result.slice(0, edit.start) + edit.replacement + result.slice(edit.end);
    }
    assert.equal(parseImmutableGalaxySyntax(result, 'boolean-comparison-result.galaxy').parseDiagnostics.length, 0);
    return {text: result, proof: {kind: 'EXACT_BOUND_BOOLEAN_IDENTIFIER_LITERAL_COMPARISON', sourceSha256: sha(text), proofInputSha256: sha(result), edits, refused,
      callsAndPropertyAccessesExcluded: true, scalarBooleanCarrierRequired: true, operandEvaluationCountUnchanged: true,
      allOtherSourceBytesUnchanged: true, sourceOrExportChanged: false, rawOracleReplaced: false, wholeMapAccepted: false}};
  } finally {program.dispose();}
}

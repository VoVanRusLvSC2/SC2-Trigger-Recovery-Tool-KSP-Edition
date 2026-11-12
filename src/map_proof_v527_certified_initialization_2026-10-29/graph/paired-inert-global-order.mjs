import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {assertExactAstShape} from './exact-ast-shape.mjs';
import {canonicalInertGlobalInitializerOrder as canonical} from './inert-global-initializer-order.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha = text => createHash('sha256').update(text).digest('hex');
const ignoredFields = new Set(['parent', 'pos', 'end', 'line', 'char']);

// Equal initializer sequences need no permutation. Independent sorting can split
// them differently at relocated type declarations and manufacture a difference.
// This decision only selects a whole proof view; the unchanged oracle still
// checks every declaration, include, function and initialization sequence.
export function canonicalInertGlobalOrderPair(before, after) {
  const initializers = (text, label) => {
    const ast = parse(text, label);assert.equal(ast.parseDiagnostics.length, 0);
    return ast.statements.filter(node => node.kind === K.VariableDeclaration && node.initializer);
  };
  const left = initializers(before, 'paired-global-before'), right = initializers(after, 'paired-global-after');
  let identical;
  try { identical = assertExactAstShape(left, right, {ignoredFields, label: 'GLOBAL_SEQUENCE_DIFFERS'}); }
  catch (error) { if (error.code !== 'ERR_ASSERTION') throw error; }
  if (identical) {
    const proof = {kind: 'IDENTICAL_GLOBAL_INITIALIZER_SEQUENCE_RETAINED', beforeSha256: sha(before),
      afterSha256: sha(after), declarations: left.length, exactSequence: identical,
      edits: [], newEquivalenceRules: 0, sourceOrExportChanged: false, wholeMapAccepted: false};
    return {before: {text: before, proof}, after: {text: after, proof}};
  }
  return {before: canonical(before), after: canonical(after)};
}

// An additional proof tier. The user's raw oracle result remains unchanged;
// this module certifies only complete program comparison through finite rules.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
import {canonicalLiteralBooleanConditions} from './literal-boolean-condition-proof.mjs';
import {canonicalLocalInitializerSequence as scalarInitializers} from './local-initializer-sequence-proof.mjs';
import {canonicalElseIfBlocks} from './else-if-block-proof.mjs';
import {canonicalIndependentLocalDeclarations} from './local-declaration-order.constant-reads.mjs';
import {canonicalLocalCompoundAssignments} from './local-compound-assignment-proof.mjs';
import {canonicalBoundBooleanLiteralComparisons} from './bound-boolean-literal-comparison.mjs';
import {canonicalLocalInitializerSequence as valueInitializers} from './local-initializer-sequence.value-handles.mjs';
import {canonicalClosedIntegerLiteralArithmetic} from './closed-integer-literal-arithmetic.mjs';
import {canonicalInertGlobalInitializerOrder} from './inert-global-initializer-order.mjs';
import {qualifyNativePrefixBeforeComposition} from './native-prefix-before-owned-composition.mjs';
import {canonicalExpressionGrouping} from './expression-grouping-proof.typedef-terminators.mjs';
import {normalizePrototypeFormalNamesPair} from './prototype-formal-names.mjs';
const sha = text => createHash('sha256').update(text).digest('hex');
export async function proveFiniteProgramEquivalence(before, after, {declarations = [], nativeProof} = {}) {
  const oracle = await openPinnedUserOracle();
  const rawComparison = oracle.compare(before, after);
  const transforms = [
    ['literal-boolean-condition-proof.mjs', canonicalLiteralBooleanConditions],
    ['local-initializer-sequence-proof.mjs', scalarInitializers],
    ['else-if-block-proof.mjs', canonicalElseIfBlocks],
    ['local-declaration-order.constant-reads.mjs', canonicalIndependentLocalDeclarations],
    ['local-compound-assignment-proof.mjs', canonicalLocalCompoundAssignments],
    ['bound-boolean-literal-comparison.mjs', canonicalBoundBooleanLiteralComparisons],
    ['local-initializer-sequence.value-handles.mjs', valueInitializers],
    ['local-declaration-order.constant-reads.mjs', canonicalIndependentLocalDeclarations],
    ['closed-integer-literal-arithmetic.mjs', canonicalClosedIntegerLiteralArithmetic],
    ['inert-global-initializer-order.mjs', canonicalInertGlobalInitializerOrder],
    ['native-prefix-before-owned-composition.mjs', text => qualifyNativePrefixBeforeComposition(text, {declarations, nativeProof})],
    ['expression-grouping-proof.typedef-terminators.mjs', canonicalExpressionGrouping],
  ];
  const implementations = [];
  for (const name of new Set([...transforms.map(([name]) => name), 'prototype-formal-names.mjs', 'finite-program-equivalence.mjs'])) {
    const url = new URL(name, import.meta.url);implementations.push({path: url.href, sha256: sha(await readFile(url))});
  }
  const proofs = {}, views = {};
  for (const [side, source] of [['before', before], ['after', after]]) {
    let text = source;proofs[side] = [];
    for (const [, transform] of transforms) {const result = transform(text);text = result.text;proofs[side].push(result.proof);}
    views[side] = text;
  }
  const prototypes = normalizePrototypeFormalNamesPair(views.before, views.after);
  const comparison = oracle.compare(prototypes.before, prototypes.after);
  await oracle.verify();
  return {kind: 'FINITE_COMPLETE_PROGRAM_EQUIVALENCE',
    inputSha256: {before: sha(before), after: sha(after)}, viewSha256: {before: sha(prototypes.before), after: sha(prototypes.after)},
    rawVerdict: rawComparison.exact ? 'MATCH' : rawComparison.syntaxValid ? 'REVIEW' : 'INVALID_SYNTAX', rawComparison,
    finiteProgramEquivalent: comparison.exact && comparison.syntaxValid, comparison,
    proofs, prototypeNames: prototypes.proof, prototypeNameRefusals: prototypes.refused, implementations,
    dependencies: declarations.map(d => ({fileName: d.fileName, sha256: sha(d.text)})),
    oracleManifestSha256: oracle.manifestSha256, oracleFilesVerified: oracle.assets,
    rawOracleReplaced: false, sourceOrExportChanged: false, actualEditor: false, archivePackingVerified: false, wholeMapAccepted: false};
}

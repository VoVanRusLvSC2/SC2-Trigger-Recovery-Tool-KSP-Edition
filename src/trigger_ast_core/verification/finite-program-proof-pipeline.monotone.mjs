import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
import {qualifyDocumentAttributeView} from './document-attribute-selector-view.mjs';
import {normalizeBoundPrivateForCounters} from './private-for-counter-lifetimes.mjs';
import {verifyPrivateCounterReferences} from './private-counter-reference-guard.mjs';
import {canonicalClosedAbiFixedLiterals} from './closed-abi-fixed-literals.mjs';
import {qualifyNativePrefixBeforeComposition} from './native-prefix-before-owned-composition.mjs';
import {canonicalLiteralBooleanConditions} from './literal-boolean-condition-proof.mjs';
import {canonicalLocalInitializerSequence as scalarInitializers} from './local-initializer-sequence-proof.mjs';
import {canonicalElseIfBlocks} from './else-if-block-proof.mjs';
import {canonicalIndependentLocalDeclarations} from './local-declaration-order.constant-reads.mjs';
import {canonicalLocalCompoundAssignments} from './local-compound-assignment-proof.mjs';
import {canonicalBoundBooleanLiteralComparisons} from './bound-boolean-literal-comparison.mjs';
import {canonicalLocalInitializerSequence as valueInitializers} from './local-initializer-sequence.value-handles.mjs';
import {canonicalClosedIntegerLiteralArithmetic} from './closed-integer-literal-arithmetic.mjs';
import {canonicalInertGlobalInitializerOrder} from './inert-global-initializer-order.mjs';
import {canonicalExpressionGrouping} from './expression-grouping-proof.typedef-terminators.mjs';
import {normalizePrototypeFormalNamesPair} from './prototype-formal-names.mjs';
import {normalizeClosedUnreachableStatements} from './closed-unreachable-statements.mjs';
import {canonicalOrderedLogicalAssociation} from './ordered-logical-association.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');

// One invocation, one raw comparison and one final comparison. All established
// finite rules keep their order and refusals. No persistent model/result cache.
export async function proveClosedFiniteProgramEquivalence(before, after, options = {}) {
  const {declarations = [], nativeProof, closedContext = {}, documentAttributes} = options;
  const oracle = await openPinnedUserOracle(), timings = [];
  const timed = async (stage, operation) => {
    const start = performance.now();
    try { return await operation(); }
    finally { timings.push({stage, milliseconds: performance.now() - start}); }
  };
  const rawComparison = await timed('raw-oracle', () => oracle.compare(before, after));
  const attribute = documentAttributes && await timed('document-attribute-identity', () =>
    qualifyDocumentAttributeView(before, {...closedContext, ...documentAttributes}));
  const counterSource = attribute?.text ?? before;
  const counters = await timed('private-counter-identities', () => normalizeBoundPrivateForCounters(counterSource, after));
  const guards = await timed('private-counter-reference-guards', () => ({
    before: verifyPrivateCounterReferences(counterSource, counters.proof.before),
    after: verifyPrivateCounterReferences(after, counters.proof.after)}));
  const transforms = [
    ['native-prefix-before-owned-composition.mjs', text => qualifyNativePrefixBeforeComposition(text, {declarations, nativeProof})],
    ['closed-abi-fixed-literals.mjs', text => canonicalClosedAbiFixedLiterals(text, closedContext)],
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
  const refinements = [['ordered-logical-association.mjs', canonicalOrderedLogicalAssociation],
    ['closed-unreachable-statements.mjs', normalizeClosedUnreachableStatements]];
  const views = {}, proofs = {};
  for (const [side, source] of [['before', counters.before], ['after', counters.after]]) {
    let text = source;proofs[side] = [];
    for (const [name, transform] of transforms) {
      const result = await timed(side + ':' + name, () => transform(text));
      text = result.text;proofs[side].push(result.proof);
    }
    views[side] = text;
  }
  let prototypes = await timed('prototype-formal-identities', () => normalizePrototypeFormalNamesPair(views.before, views.after));
  let comparison = await timed('base-oracle', () => oracle.compare(prototypes.before, prototypes.after));
  let selectedProofView = 'BASE', finalOracleComparisons = 1;
  const summary = (view, result) => ({view, exact: result.exact, differingFunctions: result.functions.differing.length,
    missingFunctions: result.functions.missing, addedFunctions: result.functions.added});
  const attempts = [summary('BASE', comparison)], refinementProofs = {};
  // Keep a previously proved whole-program result. A new canonical view is
  // additional evidence; failure to align that view cannot revoke old proof.
  // Never combine function lists from incompatible views to manufacture PASS.
  if (!comparison.exact) {
    const refined = {};
    for (const side of ['before', 'after']) {
      let text = views[side];refinementProofs[side] = [];
      for (const [name, transform] of refinements) {
        const result = await timed(side + ':' + name, () => transform(text));
        text = result.text;refinementProofs[side].push(result.proof);
      }
      refined[side] = text;
    }
    const alternate = normalizePrototypeFormalNamesPair(refined.before, refined.after);
    const result = await timed('refined-oracle', () => oracle.compare(alternate.before, alternate.after));
    finalOracleComparisons++;attempts.push(summary('REFINED', result));
    const score = result => result.functions.differing.length + result.functions.missing.length + result.functions.added.length;
    if (result.exact || score(result) < score(comparison)) {
      prototypes = alternate;comparison = result;selectedProofView = 'REFINED';
    }
  }
  await oracle.verify();
  const names = new Set([...transforms.map(([name]) => name), ...refinements.map(([name]) => name), 'finite-program-proof-pipeline.monotone.mjs',
    'prototype-formal-names.mjs', 'private-for-counter-lifetimes.mjs', 'private-counter-reference-guard.mjs',
    'bounded-numeric-literal-arithmetic.recursive.mjs', 'document-attribute-selector-view.mjs',
    '../../map_attributes/attribute_identity_context.mjs', '../../map_attributes/attribute_identity.mjs',
    '../../map_attributes/attribute_gui.mjs', '../model/verified-conversion-program.mjs',
    '../passes/owned-include-closure.mjs', '../model/source-ownership.mjs', '../types/string-literal-value.mjs']);
  const implementations = [];
  for (const name of names) {
    const url = new URL(name, import.meta.url);
    implementations.push({path: url.href, sha256: sha(await readFile(url))});
  }
  return {kind: 'SHARED_INVOCATION_FINITE_PROGRAM_PROOF', inputSha256: {before: sha(before), after: sha(after)},
    viewSha256: {before: sha(prototypes.before), after: sha(prototypes.after)},
    rawVerdict: rawComparison.exact ? 'MATCH' : rawComparison.syntaxValid ? 'REVIEW' : 'INVALID_SYNTAX',
    rawComparison, finiteProgramEquivalent: comparison.exact && comparison.syntaxValid, comparison,
    proofs, privateCounterStage: counters.proof, privateCounterReferenceGuards: guards,
    documentAttributeSelectorStage: attribute?.proof, prototypeNames: prototypes.proof, prototypeNameRefusals: prototypes.refused,
    implementations, dependencies: declarations.map(file => ({fileName: file.fileName, sha256: sha(file.text)})),
    timings, selectedProofView, proofViewAttempts: attempts, refinementProofs,
    rawOracleComparisons: 1, finalOracleComparisons, persistentCache: false,
    oracleManifestSha256: oracle.manifestSha256, oracleFilesVerified: oracle.assets,
    rawOracleReplaced: false, sourceOrExportChanged: false, wholeMapAccepted: false, fullOriginalLobbyProved: false,
    actualEditor: false, archivePackingVerified: false, newEquivalenceRules: 3 + Number(!!attribute)};
}

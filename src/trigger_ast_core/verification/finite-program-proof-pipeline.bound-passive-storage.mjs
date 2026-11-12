import {canonicalPrivateWhileCounterSyntax} from './private-while-counter-syntax.mjs';
import {canonicalUnreferencedIntrinsicLocals} from './unreferenced-intrinsic-locals.mjs';
import {normalizeBoundedEventRegistrationPair} from './bounded-event-registration-pair.reversible.mjs';
import {stockNativeEventTraceContracts} from './stock-native-event-trace-contracts.mjs';
import {canonicalTypedBooleanDoubleNegation} from './typed-boolean-double-negation.bound-calls.mjs';
import {canonicalPassiveGlobalInitializerLayout as groupedLiteralGlobalLayout} from './passive-global-initializer-layout.grouped-literals.mjs';
import {canonicalPassiveGlobalInitializerLayout} from './passive-global-initializer-layout.mjs';
import {canonicalPrivateGuardOnlyCalls} from './private-guard-only-calls.mjs';
import {canonicalBlockEmptyStatements} from './block-empty-statements.mjs';
import {canonicalTypedZeroSubtraction} from './typed-zero-subtraction.mjs';
import {canonicalPrivateStringArrayAppend} from './private-string-array-append.mjs';
import {canonicalTypedBooleanLiteralComparisons as boundBooleanMembers} from './typed-boolean-literal-comparison.bound-members.lexical.mjs';
import {canonicalBoundIntegerExtentsAndBounds as canonicalBoundIntegerValueContexts} from './bound-integer-contexts.by-value.mjs';
import {canonicalPrimitiveInitializerSuffix} from './local-initializer-suffix-proof.mjs';
import {canonicalOrderedForLoops} from './ordered-for-to-while-proof.mjs';
import {canonicalIndependentLocalDeclarations as firstReferenceDeclarations} from './local-declaration-order.passive-storage.mjs';
import {canonicalBoundIntegerExtentsAndBounds} from './bound-integer-extents-and-bounds.mjs';
import {projectEmptyCustomLifecyclePair} from './empty-custom-lifecycle-proof.symmetric.mjs';
import {canonicalPrivateFrameConcatAssignments} from './private-frame-concat-proof.mjs';
import {transportGuiGlobalBindings} from './gui-global-binding-transport.mjs';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
import {qualifyDocumentAttributeView} from './document-attribute-selector-view.mjs';
import {normalizeBoundPrivateForCounters} from './private-for-counter-lifetimes.bound-constants.mjs';
import {verifyPrivateCounterReferences} from './private-counter-reference-guard.mjs';
import {canonicalClosedAbiFixedLiterals} from './closed-abi-fixed-literals.mjs';
import {qualifyNativePrefixBeforeComposition} from './native-prefix-before-owned-composition.mjs';
import {canonicalLiteralBooleanConditions} from './literal-boolean-condition-proof.mjs';
import {canonicalLocalInitializerSequence as scalarInitializers} from './local-initializer-sequence-proof.mjs';
import {canonicalElseIfBlocks} from './else-if-block-proof.mjs';
import {canonicalIndependentLocalDeclarations} from './local-declaration-order.constant-reads.mjs';
import {canonicalLocalCompoundAssignments} from './local-compound-assignment-proof.mjs';
import {canonicalTypedBooleanLiteralComparisons} from './typed-boolean-literal-comparison.lexical.mjs';
import {canonicalLocalInitializerSequence as valueInitializers} from './local-initializer-sequence.shared-passive-storage.mjs';
import {canonicalClosedIntegerLiteralArithmetic} from './closed-integer-literal-arithmetic.mjs';
import {canonicalInertGlobalOrderPair} from './paired-inert-global-order.mjs';
import {canonicalExpressionGrouping} from './expression-grouping-proof.typedef-terminators.mjs';
import {normalizePrototypeFormalNamesPair} from './prototype-formal-names.mjs';
import {normalizeClosedUnreachableStatements} from './closed-unreachable-statements.mjs';
import {canonicalOrderedLogicalAssociation} from './ordered-logical-association.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');

// One invocation, one raw comparison and one final comparison. All established
// finite rules keep their order and refusals. No persistent model/result cache.
export async function proveClosedFiniteProgramEquivalence(before, after, options = {}) {
  const {declarations = [], nativeProof, closedContext = {}, documentAttributes, guiLibraries} = options;
  const oracle = await openPinnedUserOracle(), timings = [];
  const timed = async (stage, operation) => {
    const start = performance.now();
    try { return await operation(); }
    finally { timings.push({stage, milliseconds: performance.now() - start}); }
  };
  const rawComparison = await timed('raw-oracle', () => oracle.compare(before, after));
  const attribute = documentAttributes && await timed('document-attribute-identity', () =>
    qualifyDocumentAttributeView(before, {...closedContext, ...documentAttributes}));
  const registrations = await timed('exact-bounded-event-registration-traces', () =>
    normalizeBoundedEventRegistrationPair(attribute?.text ?? before,after,
      {externalSources:[...declarations,...(closedContext.ownedSources??[])],
       nativeEvents:stockNativeEventTraceContracts(options.nativeGuiLibraries)}));
  const counterSource = registrations.before, counterTarget = registrations.after;
  const loopSyntax=await timed('shared-private-counter-loop-syntax',()=>({
    before:canonicalPrivateWhileCounterSyntax(counterSource),after:canonicalPrivateWhileCounterSyntax(counterTarget)}));
  const counters = await timed('private-counter-identities', () => normalizeBoundPrivateForCounters(loopSyntax.before.text, loopSyntax.after.text));
  const guards = await timed('private-counter-reference-guards', () => ({
    before: verifyPrivateCounterReferences(loopSyntax.before.text, counters.proof.before),
    after: verifyPrivateCounterReferences(loopSyntax.after.text, counters.proof.after)}));
  const transforms = [
    ['unreferenced-intrinsic-locals.mjs', canonicalUnreferencedIntrinsicLocals],
    ['native-prefix-before-owned-composition.mjs', text => qualifyNativePrefixBeforeComposition(text, {declarations, nativeProof})],
    ['closed-abi-fixed-literals.mjs', text => canonicalClosedAbiFixedLiterals(text, closedContext)],
    ['literal-boolean-condition-proof.mjs', canonicalLiteralBooleanConditions],
    ['bound-integer-extents-and-bounds.mjs', text => canonicalBoundIntegerExtentsAndBounds(text, closedContext)],
    ['local-initializer-sequence-proof.mjs', scalarInitializers],
    ['else-if-block-proof.mjs', canonicalElseIfBlocks],
    ['local-declaration-order.constant-reads.mjs', canonicalIndependentLocalDeclarations],
    ['local-compound-assignment-proof.mjs', canonicalLocalCompoundAssignments],
    ['typed-boolean-literal-comparison.lexical.mjs', canonicalTypedBooleanLiteralComparisons],
    ['local-initializer-sequence.shared-passive-storage.mjs', valueInitializers],
    ['local-declaration-order.constant-reads.mjs', canonicalIndependentLocalDeclarations],
    ['closed-integer-literal-arithmetic.mjs', canonicalClosedIntegerLiteralArithmetic],
    ['inert-global-initializer-order.mjs', null],
    ['native-prefix-before-owned-composition.mjs', text => qualifyNativePrefixBeforeComposition(text, {declarations, nativeProof})],
    ['expression-grouping-proof.typedef-terminators.mjs', canonicalExpressionGrouping],
  ];
  const refinements = [['ordered-logical-association.mjs', canonicalOrderedLogicalAssociation],
    ['closed-unreachable-statements.mjs', normalizeClosedUnreachableStatements]];
  let globals;
  if (guiLibraries) {
    try {
      globals = await timed('gui-global-binding-transport', () => transportGuiGlobalBindings(counters.before, counters.after,
        {libraries: guiLibraries, externalSources: [...(closedContext.ownedSources ?? []), ...(closedContext.externalSources ?? [])]}));
    } catch (error) {
      globals = {before: counters.before, after: counters.after,
        proof: {kind: 'GUI_GLOBAL_BINDING_TRANSPORT_REFUSED', refused: error.message, edits: [], sourceOrExportChanged: false, wholeMapAccepted: false}};
    }
  }
  const views = {before: globals?.before ?? counters.before, after: globals?.after ?? counters.after},
    proofs = {before: globals ? [globals.proof] : [], after: globals ? [globals.proof] : []};
  const originalBindingViews = {...views};
  for (const [name, transform] of transforms) {
    if (transform === null) {
      const pair = await timed('pair:inert-global-order', () => canonicalInertGlobalOrderPair(views.before, views.after));
      for (const side of ['before', 'after']) { views[side] = pair[side].text;proofs[side].push(pair[side].proof); }
    } else for (const side of ['before', 'after']) {
      const result = await timed(side + ':' + name, () => transform(views[side]));
      views[side] = result.text;proofs[side].push(result.proof);
    }
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
  let privateConcatRefinement;
  // Add an independent whole-program view only after the established views
  // failed. Never revoke an old complete proof or merge per-function results.
  if (!comparison.exact && [prototypes.before, prototypes.after].some(text => text.includes('+='))) {
    const pair = {}, qualified = {};
    for (const side of ['before', 'after']) {
      const result = await timed(side + ':private-frame-concat-proof', () => canonicalPrivateFrameConcatAssignments(prototypes[side],
        {declarations: [...declarations, ...(closedContext.ownedSources ?? []), ...(closedContext.externalSources ?? [])]}));
      pair[side] = result.text;qualified[side] = result.proof;
    }
    if (['before', 'after'].some(side => qualified[side].edits.length)) {
      privateConcatRefinement = qualified;
      for (const side of ['before', 'after']) pair[side] = canonicalExpressionGrouping(pair[side]).text;
      const alternate = normalizePrototypeFormalNamesPair(pair.before, pair.after);
      const result = await timed('private-concat-oracle', () => oracle.compare(alternate.before, alternate.after));
      finalOracleComparisons++;attempts.push(summary('PRIVATE_CONCAT', result));
      const score = result => result.functions.differing.length + result.functions.missing.length + result.functions.added.length;
      if (result.exact || score(result) < score(comparison)) {prototypes = alternate;comparison = result;selectedProofView = 'PRIVATE_CONCAT';}
    }
  }
  let emptyLifecycleRefinement;
  if (!comparison.exact) {
    const pair = await timed('paired-empty-custom-lifecycle', () => projectEmptyCustomLifecyclePair(prototypes.before, prototypes.after, {...closedContext, nativeGuiLibraries: options.nativeGuiLibraries}));
    emptyLifecycleRefinement = pair.proof;
    if (pair.proof.applied) {
      const result = await timed('empty-lifecycle-oracle', () => oracle.compare(pair.before, pair.after));
      finalOracleComparisons++;attempts.push(summary('EMPTY_CUSTOM_LIFECYCLE', result));
      const score = result => result.functions.differing.length + result.functions.missing.length + result.functions.added.length;
      if (result.exact || score(result) < score(comparison)) {prototypes = {...prototypes, before: pair.before, after: pair.after};comparison = result;selectedProofView = 'EMPTY_CUSTOM_LIFECYCLE';}
    }
  }
  let constIntegerRefinement;
  if (!comparison.exact) {
    const pair = {}, qualified = {};
    for (const side of ['before', 'after']) {
      const result = await timed(side + ':bound-int-extents-and-bounds', () => canonicalBoundIntegerExtentsAndBounds(prototypes[side], closedContext));
      pair[side] = result.text;qualified[side] = result.proof;
    }
    if (['before', 'after'].some(side => qualified[side].edits.length)) {
      constIntegerRefinement = qualified;
      for (const side of ['before', 'after']) pair[side] = canonicalExpressionGrouping(canonicalClosedIntegerLiteralArithmetic(pair[side]).text).text;
      const result = await timed('const-integer-bound-oracle', () => oracle.compare(pair.before, pair.after));
      finalOracleComparisons++;attempts.push(summary('CONST_INT_EXTENTS_AND_BOUNDS', result));
      const score = result => result.functions.differing.length + result.functions.missing.length + result.functions.added.length;
      if (result.exact || score(result) < score(comparison)) {prototypes = {...prototypes, before: pair.before, after: pair.after};comparison = result;selectedProofView = 'CONST_INT_EXTENTS_AND_BOUNDS';}
    }
  }
  let controlStorageRefinement;
  if (!comparison.exact) {
    const stages = [
      ['local-initializer-suffix-proof', canonicalPrimitiveInitializerSuffix],
      ['ordered-for-to-while-proof', canonicalOrderedForLoops],
      ['closed-unreachable-statements', normalizeClosedUnreachableStatements],
      ['first-reference-local-declarations', firstReferenceDeclarations],
      ['bound-int-extents-and-bounds', text => canonicalBoundIntegerExtentsAndBounds(text, closedContext)],
      ['closed-integer-literal-arithmetic', canonicalClosedIntegerLiteralArithmetic],
      ['expression-grouping-proof', canonicalExpressionGrouping]
    ], pair = {}, qualified = {};
    for (const side of ['before', 'after']) {
      let text = prototypes[side];qualified[side] = [];
      for (const [name, transform] of stages) {
        const result = await timed(side + ':control-storage:' + name, () => transform(text));
        text = result.text;qualified[side].push(result.proof);
      }
      pair[side] = text;
    }
    controlStorageRefinement = qualified;
    const alternate = normalizePrototypeFormalNamesPair(pair.before, pair.after);
    const result = await timed('control-storage-oracle', () => oracle.compare(alternate.before, alternate.after));
    finalOracleComparisons++;attempts.push(summary('CONTROL_FLOW_AND_LOCAL_STORAGE', result));
    const score = result => result.functions.differing.length + result.functions.missing.length + result.functions.added.length;
    if (result.exact || score(result) < score(comparison)) {prototypes = alternate;comparison = result;selectedProofView = 'CONTROL_FLOW_AND_LOCAL_STORAGE';}
  }
  let orderedInitializersRefinement;
  if (!comparison.exact) {
    // Lift ordered initializers before any legal declaration permutation. This
    // independent complete view avoids making their original call order harder
    // to compare; the older complete views remain unchanged above.
    const pair = {...originalBindingViews}, qualified = {before: [], after: []};
    const apply = async (name, transform) => {
      for (const side of ['before', 'after']) {
        const result = await timed(side + ':control-storage:' + name, () => transform(pair[side]));
        pair[side] = result.text;qualified[side].push(result.proof);
      }
    };
    await apply('bound-integer-storage-shapes', text => canonicalBoundIntegerExtentsAndBounds(text, closedContext));
    await apply('value-local-initializers', valueInitializers);
    await apply('initializer-suffix', canonicalPrimitiveInitializerSuffix);
    await apply('ordered-for', canonicalOrderedForLoops);
    for (const [name, transform] of transforms) {
      if (transform === null) {
        const ordered = canonicalInertGlobalOrderPair(pair.before, pair.after);
        for (const side of ['before', 'after']) {pair[side] = ordered[side].text;qualified[side].push(ordered[side].proof);}
      } else await apply(name, name === 'local-declaration-order.constant-reads.mjs' ? firstReferenceDeclarations : transform);
    }
    for (const [name, transform] of refinements) await apply(name, transform);
    await apply('private-frame-concat', text => canonicalPrivateFrameConcatAssignments(text,
      {declarations: [...declarations, ...(closedContext.ownedSources ?? []), ...(closedContext.externalSources ?? [])]}));
    await apply('bound-int-contexts', text => canonicalBoundIntegerValueContexts(text, closedContext));
    await apply('closed-integer-literal-arithmetic', canonicalClosedIntegerLiteralArithmetic);
    await apply('expression-grouping', canonicalExpressionGrouping);
    orderedInitializersRefinement = qualified;
    const alternate = normalizePrototypeFormalNamesPair(pair.before, pair.after);
    const result = await timed('control-storage-oracle', () => oracle.compare(alternate.before, alternate.after));
    finalOracleComparisons++;attempts.push(summary('ORDERED_INITIALIZERS_AND_VALUE_CONTEXTS', result));
    const score = result => result.functions.differing.length + result.functions.missing.length + result.functions.added.length;
    if (result.exact || score(result) < score(comparison)) {prototypes = alternate;comparison = result;selectedProofView = 'ORDERED_INITIALIZERS_AND_VALUE_CONTEXTS';}
  }
  let boundBooleanMemberRefinement;
  if (!comparison.exact) {
    const pair={},qualified={};
    for(const side of ['before','after']){
      const result=await timed(side+':bound-boolean-members',()=>boundBooleanMembers(prototypes[side]));
      pair[side]=canonicalExpressionGrouping(result.text).text;qualified[side]=result.proof;
    }
    if(['before','after'].some(side=>qualified[side].edits.length)){
      boundBooleanMemberRefinement=qualified;
      const alternate=normalizePrototypeFormalNamesPair(pair.before,pair.after);
      const result=await timed('bound-boolean-members-oracle',()=>oracle.compare(alternate.before,alternate.after));
      finalOracleComparisons++;attempts.push(summary('BOUND_BOOLEAN_MEMBERS',result));
      const score=result=>result.functions.differing.length+result.functions.missing.length+result.functions.added.length;
      if(result.exact||score(result)<score(comparison)){prototypes=alternate;comparison=result;selectedProofView='BOUND_BOOLEAN_MEMBERS';}
    }
  }
  let privateArrayAppendRefinement;
  if(!comparison.exact){
    const pair={},qualified={};
    for(const side of ['before','after']){
      const result=await timed(side+':private-string-array-append',()=>canonicalPrivateStringArrayAppend(prototypes[side]));
      pair[side]=canonicalExpressionGrouping(result.text).text;qualified[side]=result.proof;
    }
    if(['before','after'].some(side=>qualified[side].edits.length)){
      privateArrayAppendRefinement=qualified;
      const alternate=normalizePrototypeFormalNamesPair(pair.before,pair.after);
      const result=await timed('private-array-append-oracle',()=>oracle.compare(alternate.before,alternate.after));
      finalOracleComparisons++;attempts.push(summary('PRIVATE_STRING_ARRAY_APPEND',result));
      const score=result=>result.functions.differing.length+result.functions.missing.length+result.functions.added.length;
      if(result.exact||score(result)<score(comparison)){prototypes=alternate;comparison=result;selectedProofView='PRIVATE_STRING_ARRAY_APPEND';}
    }
  }
  let emptyAndZeroRefinement;
  if(!comparison.exact){
    const pair={},qualified={};
    for(const side of ['before','after']){
      const empty=canonicalBlockEmptyStatements(prototypes[side]);
      const zero=canonicalTypedZeroSubtraction(empty.text);
      pair[side]=canonicalExpressionGrouping(zero.text).text;qualified[side]={empty:empty.proof,zero:zero.proof};
    }
    if(['before','after'].some(side=>qualified[side].empty.edits.length||qualified[side].zero.records.length)){
      emptyAndZeroRefinement=qualified;
      const alternate=normalizePrototypeFormalNamesPair(pair.before,pair.after);
      const result=await timed('empty-and-typed-zero-oracle',()=>oracle.compare(alternate.before,alternate.after));
      finalOracleComparisons++;attempts.push(summary('EMPTY_STATEMENTS_AND_TYPED_ZERO',result));
      const score=result=>result.functions.differing.length+result.functions.missing.length+result.functions.added.length;
      if(result.exact||score(result)<score(comparison)){prototypes=alternate;comparison=result;selectedProofView='EMPTY_STATEMENTS_AND_TYPED_ZERO';}
    }
  }
  let privateGuardOnlyRefinement;
  if(!comparison.exact){
    const pair={},qualified={};
    for(const side of ['before','after']){
      const result=canonicalPrivateGuardOnlyCalls(prototypes[side],{...closedContext,nativeGuiLibraries:options.nativeGuiLibraries});
      pair[side]=result.text;qualified[side]=result.proof;
    }
    privateGuardOnlyRefinement=qualified;
    if(['before','after'].some(side=>qualified[side].edits.length)){
      const result=await timed('private-guard-only-oracle',()=>oracle.compare(pair.before,pair.after));
      finalOracleComparisons++;attempts.push(summary('PRIVATE_GUARD_ONLY_CALLS',result));
      const score=result=>result.functions.differing.length+result.functions.missing.length+result.functions.added.length;
      if(result.exact||score(result)<score(comparison)){prototypes={...prototypes,...pair};comparison=result;selectedProofView='PRIVATE_GUARD_ONLY_CALLS';}
    }
  }
  let passiveGlobalLayoutRefinement;
  if(!comparison.exact){
    const pair={},qualified={};
    for(const side of ['before','after']){
      const result=canonicalPassiveGlobalInitializerLayout(prototypes[side]);pair[side]=result.text;qualified[side]=result.proof;
    }
    if(['before','after'].some(side=>qualified[side].edits.length)){
      passiveGlobalLayoutRefinement=qualified;
      const result=await timed('passive-global-layout-oracle',()=>oracle.compare(pair.before,pair.after));
      finalOracleComparisons++;attempts.push(summary('PASSIVE_GLOBAL_INITIALIZER_LAYOUT',result));
      const score=result=>result.functions.differing.length+result.functions.missing.length+result.functions.added.length;
      if(result.exact||score(result)<score(comparison)){prototypes={...prototypes,...pair};comparison=result;selectedProofView='PASSIVE_GLOBAL_INITIALIZER_LAYOUT';}
    }
  }
  let groupedGlobalLayoutRefinement;
  if(!comparison.exact){
    const pair={},qualified={};
    for(const side of ['before','after']){
      const result=groupedLiteralGlobalLayout(prototypes[side]);pair[side]=result.text;qualified[side]=result.proof;
    }
    if(['before','after'].some(side=>qualified[side].edits.length)){
      groupedGlobalLayoutRefinement=qualified;
      const result=await timed('grouped-literal-global-layout-oracle',()=>oracle.compare(pair.before,pair.after));
      finalOracleComparisons++;attempts.push(summary('GROUPED_LITERAL_GLOBAL_LAYOUT',result));
      const score=result=>result.functions.differing.length+result.functions.missing.length+result.functions.added.length;
      if(result.exact||score(result)<score(comparison)){prototypes={...prototypes,...pair};comparison=result;selectedProofView='GROUPED_LITERAL_GLOBAL_LAYOUT';}
    }
  }
  let typedDoubleNegationRefinement;
  if(!comparison.exact){
    const pair={},qualified={};
    for(const side of ['before','after']){
      const result=canonicalTypedBooleanDoubleNegation(prototypes[side],closedContext);
      pair[side]=result.text;qualified[side]=result.proof;
    }
    if(['before','after'].some(side=>qualified[side].edits.length)){
      typedDoubleNegationRefinement=qualified;
      const result=await timed('typed-double-negation-oracle',()=>oracle.compare(pair.before,pair.after));
      finalOracleComparisons++;attempts.push(summary('TYPED_BOOLEAN_DOUBLE_NEGATION',result));
      const score=result=>result.functions.differing.length+result.functions.missing.length+result.functions.added.length;
      if(result.exact||score(result)<score(comparison)){prototypes={...prototypes,...pair};comparison=result;selectedProofView='TYPED_BOOLEAN_DOUBLE_NEGATION';}
    }
  }
  await oracle.verify();
  const names = new Set(['../model/passive-function-entry-storage.mjs',...transforms.map(([name]) => name), ...refinements.map(([name]) => name), 'finite-program-proof-pipeline.bound-passive-storage.mjs', 'empty-custom-lifecycle-proof.typed-gui.mjs', 'typed-boolean-double-negation.bound-calls.mjs', 'passive-global-initializer-layout.grouped-literals.mjs', 'passive-global-initializer-layout.mjs', 'private-guard-only-calls.mjs', 'block-empty-statements.mjs', 'typed-zero-subtraction.mjs', 'private-string-array-append.mjs', 'typed-boolean-literal-comparison.bound-members.lexical.mjs', 'bound-integer-contexts.by-value.mjs', 'ordered-for-to-while-proof.mjs', 'local-initializer-suffix-proof.mjs', 'local-declaration-order.passive-storage.mjs', 'empty-custom-lifecycle-proof.symmetric.mjs', '../model/closed-source-function-reachability.typed-gui.mjs', '../bindings/stock-gui-native-contracts.typed.mjs', '../types/formal-galaxy-carrier.mjs',
    'bound-integer-extents-and-bounds.mjs', 'gui-global-binding-transport.mjs', 'private-frame-concat-proof.mjs', '../lowering/private-frame-concat-assignment.mjs', '../bindings/gui-capability-catalog.mjs', 'paired-inert-global-order.mjs', 'prototype-formal-names.mjs', 'private-for-counter-lifetimes.bound-constants.mjs', 'private-counter-reference-guard.mjs',
    'private-while-counter-syntax.mjs','bounded-event-registration-pair.reversible.mjs','stock-native-event-trace-contracts.mjs','../model/galaxy-program-context.lexical-parameters.mjs', 'bounded-numeric-literal-arithmetic.recursive.mjs', 'document-attribute-selector-view.mjs',
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
    comparedSources: options.captureComparedViews ? {before:prototypes.before,after:prototypes.after} : undefined,
    privateCounterLoopSyntax:{before:loopSyntax.before.proof,after:loopSyntax.after.proof},
    exactRegistrationTraceStage:{records:registrations.records,refused:registrations.refused,proof:registrations.proof},
    proofs, privateCounterStage: counters.proof, privateCounterReferenceGuards: guards,
    documentAttributeSelectorStage: attribute?.proof, prototypeNames: prototypes.proof, prototypeNameRefusals: prototypes.refused,
    implementations, dependencies: declarations.map(file => ({fileName: file.fileName, sha256: sha(file.text)})),
    timings, selectedProofView, proofViewAttempts: attempts, refinementProofs, privateConcatRefinement, emptyLifecycleRefinement, constIntegerRefinement, controlStorageRefinement, orderedInitializersRefinement, boundBooleanMemberRefinement, privateArrayAppendRefinement, emptyAndZeroRefinement, privateGuardOnlyRefinement, passiveGlobalLayoutRefinement, groupedGlobalLayoutRefinement, typedDoubleNegationRefinement,
    rawOracleComparisons: 1, finalOracleComparisons, persistentCache: false,
    oracleManifestSha256: oracle.manifestSha256, oracleFilesVerified: oracle.assets,
    rawOracleReplaced: false, sourceOrExportChanged: false, wholeMapAccepted: false, fullOriginalLobbyProved: false,
    actualEditor: false, archivePackingVerified: false, newEquivalenceRules: 4 + Number(!!typedDoubleNegationRefinement) + Number(!!groupedGlobalLayoutRefinement) + Number(!!passiveGlobalLayoutRefinement) + Number(!!privateGuardOnlyRefinement?.before.edits.length || !!privateGuardOnlyRefinement?.after.edits.length) + Number(!!emptyAndZeroRefinement) + Number(!!privateArrayAppendRefinement) + Number(!!boundBooleanMemberRefinement) + Number(!!orderedInitializersRefinement) + Number(!!controlStorageRefinement) + Number(!!constIntegerRefinement) + Number(!!emptyLifecycleRefinement?.applied) + Number(!!privateConcatRefinement) + Number(!!globals?.proof.edits?.length) + Number(!!attribute)};
}

import {canonicalBranchLiteralCallCaptures} from './branch-literal-call-captures.mjs';
import {canonicalLocalIntegerControlValues} from './local-integer-control-values.linear-edits.mjs';
import {canonicalBoundCountedLoopFrames} from './counted-loop-frames.bound.mjs';
import {normalizeBoundPrivateForCounters} from './private-for-counter-lifetimes.bound-constants.mjs';
import {canonicalClosedFunctionDeclarations} from './closed-function-declaration-view.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {proveClosedFiniteProgramEquivalence as previous} from './finite-program-proof-pipeline.complete-view-score.mjs';
import {transportGuiGlobalBindings} from './gui-global-binding-transport.array-storage-observers.mjs';
import {canonicalPrivateFunctionEntryFrame} from './private-function-entry-frame.first-use.mjs';
import {normalizePrototypeFormalNamesPair} from './prototype-formal-names.independent-counts.mjs';
import {countWholeProgramMismatches as score} from './whole-program-comparison-score.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');

// Extend an existing COMPLETE selected view, never a union of function results.
// The frozen raw oracle result remains in the returned proof unchanged.
export async function proveClosedFiniteProgramEquivalence(before,after,options={}){
  let observed;
  const base=await previous(before,after,{...options,observeComparisonPair:pair=>{observed=pair;}});
  assert(observed&&sha(observed.before)===base.viewSha256.before&&sha(observed.after)===base.viewSha256.after);
  let best={...base},selected=observed;
  const started=performance.now(),context=options.closedContext??{},stages={};
  if(!base.finiteProgramEquivalent){
    const pair={before:observed.before,after:observed.after};
    if(options.guiLibraries){
      const transported=transportGuiGlobalBindings(pair.before,pair.after,{libraries:options.guiLibraries,
        externalSources:[...(context.ownedSources??[]),...(context.externalSources??[])]});
      pair.before=transported.before;stages.globals=transported.proof;
    }
    stages.controlFrames={};
    for(const side of ['before','after']){
      stages.controlFrames[side]=[];
      for(const transform of [s=>canonicalBranchLiteralCallCaptures(s,context),canonicalLocalIntegerControlValues,canonicalBoundCountedLoopFrames]){
        const result=transform(pair[side]);pair[side]=result.text;stages.controlFrames[side].push(result.proof);
      }
    }
    const counters=normalizeBoundPrivateForCounters(pair.before,pair.after);stages.counterFrames=counters.proof;pair.before=counters.before;pair.after=counters.after;
    for(const side of ['before','after']){
      const result=canonicalPrivateFunctionEntryFrame(pair[side],context);pair[side]=result.text;stages[side]=result.proof;
    }
    stages.declarations={};
    for(const side of ['before','after']){const result=canonicalClosedFunctionDeclarations(pair[side],context);pair[side]=result.text;stages.declarations[side]=result.proof;}
    const normalized=normalizePrototypeFormalNamesPair(pair.before,pair.after),oracle=await openPinnedUserOracle();
    assert.equal(oracle.manifestSha256,base.oracleManifestSha256);
    const comparison=await oracle.compare(normalized.before,normalized.after);await oracle.verify();
    stages.prototypes=normalized.proof;stages.comparison=comparison;stages.completeProgramCompared=true;
    const choose=comparison.syntaxValid&&(comparison.exact||score(comparison)<score(base.comparison));
    stages.selected=choose;
    if(choose){
      selected={before:normalized.before,after:normalized.after,selectedProofView:'CLOSED_STORAGE_AND_FUNCTION_FRAMES',
        beforeSha256:sha(normalized.before),afterSha256:sha(normalized.after)};
      best={...best,comparison,finiteProgramEquivalent:comparison.exact,selectedProofView:selected.selectedProofView,
        viewSha256:{before:selected.beforeSha256,after:selected.afterSha256}};
    }
    best.finalOracleComparisons++;
    best.proofViewAttempts=[...base.proofViewAttempts,{view:'CLOSED_STORAGE_AND_FUNCTION_FRAMES',exact:comparison.exact,
      differingFunctions:comparison.functions.differing.length,missingFunctions:comparison.functions.missing,addedFunctions:comparison.functions.added}];
  }
  const names=['branch-literal-call-captures.mjs','local-integer-control-values.linear-edits.mjs','counted-loop-frames.bound.mjs','private-for-counter-lifetimes.bound-constants.mjs','closed-function-declaration-view.mjs','prototype-formal-names.independent-counts.mjs','finite-program-proof-pipeline.closed-storage-frames.mjs','gui-global-binding-transport.array-storage-observers.mjs',
    'gui-global-binding-transport.intrinsic-arrays.mjs','gui-intrinsic-storage-shape.mjs','private-function-entry-frame.first-use.mjs',
    'bound-private-lexical-alpha.first-use.mjs','projected-expression-grouping-shape.mjs','local-initializer-sequence.shared-passive-storage.mjs',
    'local-declaration-order.passive-storage.mjs','../model/passive-function-entry-storage.mjs',
    '../model/verified-source-binding-program.lexical-parameters.mjs','../model/galaxy-program-context.lexical-parameters.mjs'];
  best.implementations=[...base.implementations,...await Promise.all(names.map(async name=>{
    const url=new URL(name,import.meta.url);return {path:url.href,sha256:sha(await readFile(url))};
  }))];
  best.timings=[...base.timings,{stage:'bound-lexical-and-intrinsic-storage',milliseconds:performance.now()-started}];
  best.lexicalStorageRefinement=stages;
  if(options.observeComparisonPair!==undefined){assert.equal(typeof options.observeComparisonPair,'function');await options.observeComparisonPair(Object.freeze(selected));}
  return best;
}

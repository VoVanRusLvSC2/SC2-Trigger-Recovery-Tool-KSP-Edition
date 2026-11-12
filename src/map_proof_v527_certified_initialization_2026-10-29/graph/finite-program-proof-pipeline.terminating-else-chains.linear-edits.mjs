import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {proveClosedFiniteProgramEquivalence as previous} from './finite-program-proof-pipeline.condition-regions.linear-edits.mjs';
import {canonicalTerminatingElseChains} from './terminating-else-chains.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');

// Compose one additional proven control-flow rule over a COMPLETE selected
// comparison view. Never borrow individual matches from different views.
export async function proveClosedFiniteProgramEquivalence(before,after,options={}){
  const proof=await previous(before,after,{...options,captureComparedViews:true});
  const implementations=[...proof.implementations];
  for(const name of ['terminating-else-chains.mjs','finite-program-proof-pipeline.terminating-else-chains.linear-edits.mjs']){
    const url=new URL(name,import.meta.url);implementations.push({path:url.href,sha256:sha(await readFile(url))});
  }
  const cleaned=()=>({...proof,implementations,comparedSources:options.captureComparedViews?proof.comparedSources:undefined});
  if(proof.finiteProgramEquivalent)return cleaned();
  assert.equal(sha(before),proof.inputSha256.before);assert.equal(sha(after),proof.inputSha256.after);
  assert(proof.comparedSources,'COMPLETE_COMPARISON_VIEW_REQUIRED');
  const oracle=await openPinnedUserOracle();await oracle.verify();
  assert.equal(oracle.manifestSha256,proof.oracleManifestSha256);assert.equal(oracle.assets,proof.oracleFilesVerified);
  const score=c=>c.functions.differing.length+c.functions.missing.length+c.functions.added.length;
  const candidates=[{name:'BASE',views:proof.comparedSources,comparison:proof.comparison}];
  const region=proof.conditionRegionRefinement;
  if(region?.completeProgramCompared&&region.comparedSources&&region.completeComparison)
    candidates.push({name:'CONDITION_REGIONS',views:region.comparedSources,comparison:region.completeComparison});
  const refinements=[],attempts=[...proof.proofViewAttempts];let comparisons=proof.finalOracleComparisons,best=cleaned();
  for(const candidate of candidates){
    if(candidate.name==='BASE')for(const side of ['before','after'])assert.equal(sha(candidate.views[side]),proof.viewSha256[side]);
    else{
      const bound=await oracle.compare(candidate.views.before,candidate.views.after);comparisons++;
      assert.deepEqual(bound,candidate.comparison,'CONDITION_VIEW_COMPARISON_NOT_BOUND');
    }
    const pair={},qualified={};
    for(const side of ['before','after']){const result=canonicalTerminatingElseChains(candidate.views[side]);pair[side]=result.text;qualified[side]=result.proof;}
    refinements.push({completeInputView:candidate.name,...qualified});
    if(!qualified.before.changed&&!qualified.after.changed)continue;
    const comparison=await oracle.compare(pair.before,pair.after);comparisons++;
    attempts.push({name:'RETURN_TERMINATED_ELSE_IF_CHAINS:'+candidate.name,exact:comparison.exact,syntaxValid:comparison.syntaxValid,
      differing:comparison.functions.differing.length,missing:comparison.functions.missing.length,added:comparison.functions.added.length});
    if(comparison.syntaxValid&&(comparison.exact||score(comparison)<score(best.comparison)))
      best={...best,comparison,finiteProgramEquivalent:comparison.exact&&comparison.syntaxValid,
        selectedProofView:'RETURN_TERMINATED_ELSE_IF_CHAINS:'+candidate.name,viewSha256:{before:sha(pair.before),after:sha(pair.after)},
        comparedSources:options.captureComparedViews?pair:undefined,newEquivalenceRules:proof.newEquivalenceRules+1};
  }
  await oracle.verify();
  return {...best,terminatingElseRefinement:refinements,finalOracleComparisons:comparisons,proofViewAttempts:attempts,
    sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false};
}

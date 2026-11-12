import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {proveClosedFiniteProgramEquivalence as previous} from './finite-program-proof-pipeline.write-only-integer-literals.mjs';
import {canonicalBoundPrivateLocalNames} from './bound-private-local-alpha.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex'),jsonValue=v=>JSON.parse(JSON.stringify(v));

export async function refineCompleteBoundLocalAlpha(proof,context={},capture=false){
  const implementations=[...proof.implementations];
  for(const name of ['bound-private-local-alpha.mjs','finite-program-proof-pipeline.bound-local-alpha.mjs']){
    const url=new URL(name,import.meta.url);implementations.push({path:url.href,sha256:sha(await readFile(url))});
  }
  const clean=()=>({...proof,implementations,comparedSources:capture?proof.comparedSources:undefined});
  if(proof.finiteProgramEquivalent)return clean();
  assert(proof.comparedSources,'COMPLETE_BOUND_ALPHA_VIEW_REQUIRED');
  const oracle=await openPinnedUserOracle();assert.equal(oracle.manifestSha256,proof.oracleManifestSha256);assert.equal(oracle.assets,proof.oracleFilesVerified);
  const candidates=[{name:'BASE',views:proof.comparedSources,comparison:proof.comparison}];
  const unused=proof.writeOnlyIntegerLiterals;
  if(unused?.completeProgramCompared&&!unused.selected){
    const pair={};
    for(const side of ['before','after']){
      const stage=unused.stages[side];assert.equal(sha(proof.comparedSources[side]),stage.cells.sourceSha256);
      const cells=applyReversibleSourceEdits(proof.comparedSources[side],stage.cells.edits).text;
      assert.equal(sha(cells),stage.cells.viewSha256);assert.equal(sha(cells),stage.order.sourceSha256);
      pair[side]=applyReversibleSourceEdits(cells,stage.order.edits).text;assert.equal(sha(pair[side]),stage.order.proofInputSha256);
    }
    candidates.push({name:'WRITE_ONLY_INTEGER_LITERALS',views:pair,comparison:unused.comparison});
  }
  const started=performance.now(),refinements=[],attempts=[...proof.proofViewAttempts];let best=clean(),comparisons=proof.finalOracleComparisons;
  const score=c=>c.functions.differing.length+c.functions.missing.length+c.functions.added.length;
  for(const candidate of candidates){
    if(candidate.name==='BASE')for(const side of ['before','after'])assert.equal(sha(candidate.views[side]),proof.viewSha256[side]);
    assert.deepEqual(jsonValue(await oracle.compare(candidate.views.before,candidate.views.after)),jsonValue(candidate.comparison),'BOUND_ALPHA_INPUT_COMPARISON_NOT_BOUND');comparisons++;
    const pair={},stages={};
    for(const side of ['before','after']){const r=canonicalBoundPrivateLocalNames(candidate.views[side],context);pair[side]=r.text;stages[side]=r.proof;}
    const comparison=await oracle.compare(pair.before,pair.after);comparisons++;
    const name='QUALIFIED_LOCAL_ALPHA:'+candidate.name+':'+proof.selectedProofView;
    refinements.push({completeInput:candidate.name,stages,comparison});attempts.push({name,exact:comparison.exact,syntaxValid:comparison.syntaxValid,
      differing:comparison.functions.differing.length,missing:comparison.functions.missing.length,added:comparison.functions.added.length});
    if(comparison.syntaxValid&&(comparison.exact||score(comparison)<score(best.comparison)))best={...best,comparison,
      finiteProgramEquivalent:comparison.exact&&comparison.syntaxValid,selectedProofView:name,
      viewSha256:{before:sha(pair.before),after:sha(pair.after)},comparedSources:capture?pair:undefined,
      newEquivalenceRules:proof.newEquivalenceRules+1+Number(candidate.name!=='BASE')};
  }
  await oracle.verify();return {...best,boundLocalAlpha:{candidates:refinements,completeProgramCompared:true},proofViewAttempts:attempts,
    finalOracleComparisons:comparisons,timings:[...proof.timings,{stage:'qualified-private-local-alpha',milliseconds:performance.now()-started}],
    sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false};
}
export async function proveClosedFiniteProgramEquivalence(before,after,options={}){
  return refineCompleteBoundLocalAlpha(await previous(before,after,{...options,captureComparedViews:true}),options.closedContext??{},options.captureComparedViews);
}

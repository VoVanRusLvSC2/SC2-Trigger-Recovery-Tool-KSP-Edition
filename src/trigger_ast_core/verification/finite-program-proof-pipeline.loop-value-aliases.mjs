import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {proveClosedFiniteProgramEquivalence as previous} from './finite-program-proof-pipeline.loop-capture-cells.mjs';
import {canonicalPrivateLoopValueAliases} from './private-loop-value-aliases.mjs';
import {canonicalIndependentLocalDeclarations} from './local-declaration-order.passive-storage.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const jsonValue=v=>JSON.parse(JSON.stringify(v));

export async function refineCompletePrivateLoopAliases(proof,context={},capture=false){
  const implementations=[...proof.implementations];
  for(const name of ['private-loop-value-aliases.mjs','../model/verified-source-binding-program.mjs','finite-program-proof-pipeline.loop-value-aliases.mjs']){
    const url=new URL(name,import.meta.url);implementations.push({path:url.href,sha256:sha(await readFile(url))});
  }
  const clean=()=>({...proof,implementations,comparedSources:capture?proof.comparedSources:undefined});
  if(proof.finiteProgramEquivalent)return clean();
  assert(proof.comparedSources,'COMPLETE_LOOP_ALIAS_VIEW_REQUIRED');
  for(const side of ['before','after'])assert.equal(sha(proof.comparedSources[side]),proof.viewSha256[side]);
  const oracle=await openPinnedUserOracle();assert.equal(oracle.manifestSha256,proof.oracleManifestSha256);assert.equal(oracle.assets,proof.oracleFilesVerified);
  assert.deepEqual(jsonValue(await oracle.compare(proof.comparedSources.before,proof.comparedSources.after)),jsonValue(proof.comparison),'LOOP_ALIAS_INPUT_COMPARISON_NOT_BOUND');
  const started=performance.now(),stages={},pair={};
  for(const side of ['before','after']){
    const cells=canonicalPrivateLoopValueAliases(proof.comparedSources[side],context),ordered=canonicalIndependentLocalDeclarations(cells.text);
    stages[side]={cells:cells.proof,order:ordered.proof};pair[side]=ordered.text;
  }
  const comparison=await oracle.compare(pair.before,pair.after);await oracle.verify();
  const score=c=>c.functions.differing.length+c.functions.missing.length+c.functions.added.length;
  const selected=comparison.syntaxValid&&(comparison.exact||score(comparison)<score(proof.comparison));
  const name='PRIVATE_LOOP_LOCAL_VALUE_ALIASES:'+proof.selectedProofView;
  return {...clean(),...(selected?{comparison,finiteProgramEquivalent:comparison.exact&&comparison.syntaxValid,
    selectedProofView:name,viewSha256:{before:sha(pair.before),after:sha(pair.after)},comparedSources:capture?pair:undefined,
    newEquivalenceRules:proof.newEquivalenceRules+1}:{}),
    privateLoopAliases:{stages,completeProgramCompared:true,selected,comparison},
    finalOracleComparisons:proof.finalOracleComparisons+2,
    proofViewAttempts:[...proof.proofViewAttempts,{name,exact:comparison.exact,syntaxValid:comparison.syntaxValid,
      differing:comparison.functions.differing.length,missing:comparison.functions.missing.length,added:comparison.functions.added.length}],
    timings:[...proof.timings,{stage:'private-loop-local-value-aliases',milliseconds:performance.now()-started}],
    sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false};
}
export async function proveClosedFiniteProgramEquivalence(before,after,options={}){
  return refineCompletePrivateLoopAliases(await previous(before,after,{...options,captureComparedViews:true}),options.closedContext??{},options.captureComparedViews);
}

// One complete source-bound comparison pair; raw oracle and files stay intact.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {readFile} from 'node:fs/promises';
import {proveClosedFiniteProgramEquivalence as previous} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/finite-program-proof-pipeline.constant-range-snapshots.mjs';
import {canonicalClosedLiteralLoopSnapshots as canonical} from './closed-literal-loop-snapshots.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
import {countWholeProgramMismatches as score} from './whole-program-comparison-score.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
export async function proveClosedFiniteProgramEquivalence(before,after,options={}){
 let pair;const base=await previous(before,after,{...options,observeComparisonPair:p=>{assert(!pair,'MULTIPLE_LITERAL_SNAPSHOT_BASE_PAIRS');pair=p;}});
 assert(pair&&sha(pair.before)===base.viewSha256.before&&sha(pair.after)===base.viewSha256.after,'LITERAL_SNAPSHOT_BASE_SHA');
 let chosen=pair,comparison=base.comparison,equivalent=base.finiteProgramEquivalent,refinement={performed:false},selectedProofView=base.selectedProofView;
 if(!equivalent){
  const a=canonical(pair.before,options.closedContext??{}),b=canonical(pair.after,options.closedContext??{});
  refinement={performed:true,before:a.proof,after:b.proof,wholeProgramCompared:false,selected:false};
  if(a.proof.records.length||b.proof.records.length){
   const oracle=await openPinnedUserOracle();assert.equal(oracle.manifestSha256,base.oracleManifestSha256,'LITERAL_SNAPSHOT_ORACLE_CHANGED');
   const checked=await oracle.compare(a.text,b.text);await oracle.verify();refinement={...refinement,wholeProgramCompared:true,comparison:checked,oracleAssetsVerified:oracle.assets};
   if(checked.syntaxValid&&(checked.exact||score(checked)<score(base.comparison))){
    chosen={before:a.text,after:b.text,beforeSha256:sha(a.text),afterSha256:sha(b.text),selectedProofView:'CLOSED_LITERAL_INTEGER_LOOP_SNAPSHOTS'};
    comparison=checked;equivalent=checked.exact;selectedProofView=chosen.selectedProofView;refinement.selected=true;
   }
  }
 }
 if(options.observeComparisonPair)await options.observeComparisonPair(Object.freeze(chosen));
 const implementations=await Promise.all([new URL(import.meta.url),new URL('./closed-literal-loop-snapshots.mjs',import.meta.url)].map(async url=>({path:url.href,sha256:sha(await readFile(url))})));
 return {...base,comparison,finiteProgramEquivalent:equivalent,selectedProofView,viewSha256:{before:sha(chosen.before),after:sha(chosen.after)},literalLoopSnapshotRefinement:refinement,
  newEquivalenceRules:(base.newEquivalenceRules??0)+Number(refinement.selected),implementations:[...base.implementations,...implementations],completeProgramPairOnly:true,perFunctionProofUnion:false,sourceOrExportChanged:false,persistentCache:false};
}

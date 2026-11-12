// Strict refinement of one complete comparison pair. The original raw result,
// maps and generated Galaxy remain unchanged; no per-function unions.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {proveClosedFiniteProgramEquivalence as previous} from './finite-program-proof-pipeline.closed-storage-loop-captures.mjs';
import {canonicalBoundCountedLoopFrames} from './counted-loop-frames.bound.mjs';
import {canonicalConstantRangeSnapshots} from './constant-range-snapshot.closed-proof.mjs';
import {countWholeProgramMismatches as score} from './whole-program-comparison-score.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
export async function proveClosedFiniteProgramEquivalence(before,after,options={}){
 let priorPair;
 const base=await previous(before,after,{...options,observeComparisonPair:p=>{assert(!priorPair,'MULTIPLE_BASE_PAIRS');priorPair=p;}});
 assert(priorPair&&sha(priorPair.before)===base.viewSha256.before&&sha(priorPair.after)===base.viewSha256.after,'SNAPSHOT_BASE_PAIR_HASH');
 let chosen=priorPair,comparison=base.comparison,equivalent=base.finiteProgramEquivalent,selectedProofView=base.selectedProofView,refinement={performed:false};
 if(!equivalent){
  const left=canonicalConstantRangeSnapshots(priorPair.before,options.closedContext??{}),right=canonicalConstantRangeSnapshots(priorPair.after,options.closedContext??{});
  refinement={performed:true,before:left.proof,after:right.proof,wholeProgramCompared:false,selected:false};
  if(left.proof.records.length||right.proof.records.length){
   const oracle=await openPinnedUserOracle();assert.equal(oracle.manifestSha256,base.oracleManifestSha256,'SNAPSHOT_ORACLE_CHANGED');
   const leftFrame=canonicalBoundCountedLoopFrames(left.text),rightFrame=canonicalBoundCountedLoopFrames(right.text);const checked=await oracle.compare(leftFrame.text,rightFrame.text);await oracle.verify();
   refinement={...refinement,wholeProgramCompared:true,oracleAssetsVerified:oracle.assets,frames:{before:leftFrame.proof,after:rightFrame.proof},comparison:checked};
   if(checked.syntaxValid&&(checked.exact||score(checked)<score(base.comparison))){
    chosen={before:leftFrame.text,after:rightFrame.text,beforeSha256:sha(leftFrame.text),afterSha256:sha(rightFrame.text),selectedProofView:'CLOSED_CONSTANT_RANGE_SNAPSHOTS'};
    comparison=checked;equivalent=checked.exact;selectedProofView=chosen.selectedProofView;refinement.selected=true;
   }
  }
 }
 if(options.observeComparisonPair)await options.observeComparisonPair(Object.freeze(chosen));
 const own=new URL(import.meta.url),rule=new URL('./constant-range-snapshot.closed-proof.mjs',import.meta.url);
 return {...base,comparison,finiteProgramEquivalent:equivalent,selectedProofView,viewSha256:{before:sha(chosen.before),after:sha(chosen.after)},constantRangeSnapshotRefinement:refinement,
  newEquivalenceRules:(base.newEquivalenceRules??0)+Number(refinement.selected),implementations:[...base.implementations,{path:own.href,sha256:sha(await readFile(own))},{path:rule.href,sha256:sha(await readFile(rule))}],completeProgramPairOnly:true,perFunctionProofUnion:false,sourceOrExportChanged:false,persistentCache:false};
}

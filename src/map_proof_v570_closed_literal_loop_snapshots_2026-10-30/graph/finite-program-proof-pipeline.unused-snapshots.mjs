// Apply the narrow unused-constant proof to one complete selected pair, then
// rerun the unchanged pinned oracle on the whole program. Never union partial
// function results or alter archives, raw oracle results, or generated code.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {proveClosedFiniteProgramEquivalence as previous} from './finite-program-proof-pipeline.constant-range-snapshots.mjs';
import {canonicalUnusedConstantSnapshotLocals as project} from './unreferenced-constant-snapshot-locals.mjs';
import {countWholeProgramMismatches as score} from './whole-program-comparison-score.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
export async function proveClosedFiniteProgramEquivalence(before,after,options={}){
 let priorPair;
 const base=await previous(before,after,{...options,observeComparisonPair:p=>{assert(!priorPair,'MULTIPLE_BASE_PAIRS');priorPair=p;}});
 assert(priorPair&&sha(priorPair.before)===base.viewSha256.before&&sha(priorPair.after)===base.viewSha256.after,'UNUSED_SNAPSHOT_BASE_PAIR_HASH');
 let chosen=priorPair,comparison=base.comparison,equivalent=base.finiteProgramEquivalent,selectedProofView=base.selectedProofView,refinement={performed:false};
 if(!equivalent){
  const left=project(priorPair.before),right=project(priorPair.after);
  refinement={performed:true,before:left.proof,after:right.proof,wholeProgramCompared:false,selected:false};
  if(left.proof.edits.length||right.proof.edits.length){
   const oracle=await openPinnedUserOracle();assert.equal(oracle.manifestSha256,base.oracleManifestSha256,'UNUSED_SNAPSHOT_ORACLE_CHANGED');
   const checked=await oracle.compare(left.text,right.text);await oracle.verify();
   refinement={...refinement,wholeProgramCompared:true,oracleAssetsVerified:oracle.assets,comparison:checked};
   if(checked.syntaxValid&&(checked.exact||score(checked)<score(base.comparison))){
    chosen={before:left.text,after:right.text,beforeSha256:sha(left.text),afterSha256:sha(right.text),selectedProofView:'UNREFERENCED_PURE_INTEGER_SNAPSHOTS'};
    comparison=checked;equivalent=checked.exact;selectedProofView=chosen.selectedProofView;refinement.selected=true;
   }
  }
 }
 if(options.observeComparisonPair)await options.observeComparisonPair(Object.freeze(chosen));
 const own=new URL(import.meta.url),rule=new URL('./unreferenced-constant-snapshot-locals.mjs',import.meta.url);
 return {...base,comparison,finiteProgramEquivalent:equivalent,selectedProofView,viewSha256:{before:sha(chosen.before),after:sha(chosen.after)},
  unusedSnapshotRefinement:refinement,newEquivalenceRules:(base.newEquivalenceRules??0)+Number(refinement.selected),
  implementations:[...base.implementations,{path:own.href,sha256:sha(await readFile(own))},{path:rule.href,sha256:sha(await readFile(rule))}],
  completeProgramPairOnly:true,perFunctionProofUnion:false,sourceOrExportChanged:false,persistentCache:false};
}

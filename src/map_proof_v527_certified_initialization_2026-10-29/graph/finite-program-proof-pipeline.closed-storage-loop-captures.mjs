import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {proveClosedFiniteProgramEquivalence as proveBase} from './finite-program-proof-pipeline.closed-storage-frames.mjs';
import {refineCompleteLoopCaptureCells} from './finite-program-proof-pipeline.loop-capture-cells.for-initializers.mjs';

const sha=text=>createHash('sha256').update(text).digest('hex');

/** Preserve the raw oracle and refine exactly one complete selected pair.
 * Never combine separate function results or treat a partial match as PASS. */
export async function proveClosedFiniteProgramEquivalence(before,after,options={}){
 let pair;
 const base=await proveBase(before,after,{...options,observeComparisonPair:value=>{assert(!pair,'MULTIPLE_COMPLETE_BASE_PAIRS');pair=value;}});
 assert(pair&&sha(pair.before)===base.viewSha256.before&&sha(pair.after)===base.viewSha256.after,'COMPLETE_BASE_PAIR_HASH');
 const refined=await refineCompleteLoopCaptureCells({...base,comparedSources:{before:pair.before,after:pair.after}},options.closedContext??{},true);
 const chosen=refined.comparedSources;
 assert(chosen&&sha(chosen.before)===refined.viewSha256.before&&sha(chosen.after)===refined.viewSha256.after,'COMPLETE_REFINED_PAIR_HASH');
 const {comparedSources,...proof}=refined;
 if(options.observeComparisonPair){assert.equal(typeof options.observeComparisonPair,'function');await options.observeComparisonPair(Object.freeze({
  before:chosen.before,after:chosen.after,beforeSha256:sha(chosen.before),afterSha256:sha(chosen.after),selectedProofView:proof.selectedProofView}));}
 const url=new URL(import.meta.url),own={path:url.href,sha256:sha(await readFile(url))};
 return {...proof,implementations:[...proof.implementations,own],completeProgramPairOnly:true,perFunctionProofUnion:false,persistentCache:false};
}

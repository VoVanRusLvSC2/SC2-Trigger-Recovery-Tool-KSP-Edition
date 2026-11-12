import assert from 'node:assert/strict';
import {canonicalConstantRangeSnapshots} from './constant-range-snapshot.literal-bound.mjs';
import {canonicalBoundCountedLoopFrames} from './counted-loop-frames.bound.mjs';
import {canonicalPrivateFunctionEntryFrame} from './private-function-entry-frame.first-use.mjs';
import {normalizeEntryLocalDefaultPair} from './entry-local-default-pair.counter-guards.mjs';
import {normalizePrototypeFormalNamesPair} from './prototype-formal-names.independent-counts.mjs';
import {inspectNamedStorageObservers} from '../analysis/named-storage-observers.mjs';
// Compose only reversible, independently checked program views. The caller must
// run the unchanged oracle on this entire pair; this helper cannot grant PASS.
export function refinePrivateEntryRangePair(before,after,{context={},observerRoots=[before,after],externalSources=context.externalSources??[]}={}){
 const defaults=normalizeEntryLocalDefaultPair(before,after),pair={},proofs={},names=new Set();
 for(const side of ['before','after']){
  const ranges=canonicalConstantRangeSnapshots(defaults[side],context),loops=canonicalBoundCountedLoopFrames(ranges.text),frame=canonicalPrivateFunctionEntryFrame(loops.text,context);
  assert(!frame.proof.alpha.reason,'PRIVATE_ENTRY_UNCLOSED_BINDINGS');
  for(const r of frame.proof.alpha.records){names.add(r.function);names.add(r.from);names.add(r.to);}
  proofs[side]={ranges:ranges.proof,loops:loops.proof,frame:frame.proof};pair[side]=frame.text;
 }
 const observers=observerRoots.map(root=>inspectNamedStorageObservers(root,[...names],{externalSources}));
 assert(observers.every(p=>!p.unknownObserverInput&&!p.observedNames.length),'PRIVATE_ENTRY_NAMED_STORAGE_OBSERVER');
 const prototypes=normalizePrototypeFormalNamesPair(pair.before,pair.after);
 return {before:prototypes.before,after:prototypes.after,proof:{kind:'BOUND_PRIVATE_ENTRY_AND_LITERAL_RANGE_PAIR',defaults:defaults.proof,projections:proofs,observers,prototypes:prototypes.proof,sourceOrExportChanged:false,wholeProgramOracleStillRequired:true,perFunctionUnion:false,passGranted:false}};
}

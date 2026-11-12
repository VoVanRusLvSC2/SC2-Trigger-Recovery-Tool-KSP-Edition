import {canonicalOverwrittenLocalInitializations} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_proof_v561_batched_storage_observers_2026-10-30/graph/68eb6cfbff93-overwritten-local-array-fill.mjs';
import {canonicalDeadLocalLiteralStores} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/dead-local-literal-stores.mjs';
import {canonicalIndependentNullArrayFillOrder} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/independent-null-array-fill-order.mjs';
import {refineClosedCaptureEntryPair} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/closed-capture-entry-pair.mjs';
import {refinePrivateEntryRangePair} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/private-entry-range-pair.mjs';
// A complete pair of program views. Independent dead-cell and fill-order rules
// compose with existing bound capture/frame proofs; no function-wise union.
export function refineObservableLocalFillPair(before,after,options={}){
 const captured=refineClosedCaptureEntryPair(before,after,options),pair={},stages={};
 for(const side of ['before','after']){
  const overwrite=canonicalOverwrittenLocalInitializations(captured[side],options.context??{});
  const dead=canonicalDeadLocalLiteralStores(overwrite.text,options.context??{});
  const fills=canonicalIndependentNullArrayFillOrder(dead.text,options.context??{});
  pair[side]=fills.text;stages[side]={overwrite:overwrite.proof,dead:dead.proof,fills:fills.proof};
 }
 const frames=refinePrivateEntryRangePair(pair.before,pair.after,options);
 return{before:frames.before,after:frames.after,proof:{kind:'OBSERVABLE_LOCAL_STORAGE_AND_COMPLETE_NULL_FILL_ORDER',
  captures:captured.proof,stages,frames:frames.proof,sourceOrExportChanged:false,
  defaultsAssumed:false,passGranted:false,perFunctionUnion:false,wholeProgramOracleStillRequired:true}};
}

import {canonicalDeadLocalLiteralStores} from './dead-local-literal-stores.mjs';
import {canonicalIndependentNullArrayFillOrder} from './independent-null-array-fill-order.mjs';
import {refineClosedCaptureEntryPair} from './closed-capture-entry-pair.mjs';
import {refinePrivateEntryRangePair} from './private-entry-range-pair.mjs';
// A complete pair of program views. Independent dead-cell and fill-order rules
// compose with existing bound capture/frame proofs; no function-wise union.
export function refineObservableLocalFillPair(before,after,options={}){
 const captured=refineClosedCaptureEntryPair(before,after,options),pair={},stages={};
 for(const side of ['before','after']){
  const dead=canonicalDeadLocalLiteralStores(captured[side],options.context??{});
  const fills=canonicalIndependentNullArrayFillOrder(dead.text,options.context??{});
  pair[side]=fills.text;stages[side]={dead:dead.proof,fills:fills.proof};
 }
 const frames=refinePrivateEntryRangePair(pair.before,pair.after,options);
 return{before:frames.before,after:frames.after,proof:{kind:'OBSERVABLE_LOCAL_STORAGE_AND_COMPLETE_NULL_FILL_ORDER',
  captures:captured.proof,stages,frames:frames.proof,sourceOrExportChanged:false,
  defaultsAssumed:false,passGranted:false,perFunctionUnion:false,wholeProgramOracleStillRequired:true}};
}

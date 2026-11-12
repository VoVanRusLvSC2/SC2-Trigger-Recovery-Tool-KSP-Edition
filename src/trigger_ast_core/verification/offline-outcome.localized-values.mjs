// Preserve all existing gates and require one additional independent data gate.
import assert from 'node:assert/strict';
import {requiredOfflineAxes as previousAxes,summarizeOfflineEvidence as previous,
 summarizeQualifiedRow as previousQualified} from './offline-outcome.mjs';
export const requiredOfflineAxes=Object.freeze([...previousAxes,'localizedValues']);
const states=new Set(['PASSED','REVIEW','NOT_RUN','UNAVAILABLE','INVALID']);
export function summarizeOfflineEvidence(input) {
 const base=previous(input),axis=input.axes.localizedValues??{status:'NOT_RUN',reason:'LOCALIZED_VALUES_NOT_AUDITED'};
 assert(states.has(axis.status),'UNKNOWN_LOCALIZED_EVIDENCE_STATUS');
 assert.equal(typeof axis.reason,'string','LOCALIZED_EVIDENCE_REASON_MISSING');
 const pending=[...base.pendingOffline,...(axis.status==='PASSED'?[]:['localizedValues'])];
 const status=axis.status==='INVALID'?'EVIDENCE_INVALID'
  :base.status==='PASSED_OFFLINE_EDITOR_PENDING'&&axis.status!=='PASSED'?'REVIEW':base.status;
 return Object.freeze({...base,status,axes:Object.freeze({...base.axes,localizedValues:Object.freeze({...axis})}),
  pendingOffline:Object.freeze(pending),localizedMapValuesProved:axis.status==='PASSED'});
}
export function summarizeQualifiedRow(row,options={}) {
 const base=previousQualified(row,options);
 return summarizeOfflineEvidence({...base,axes:{...base.axes,localizedValues:options.localizedValues}});
}

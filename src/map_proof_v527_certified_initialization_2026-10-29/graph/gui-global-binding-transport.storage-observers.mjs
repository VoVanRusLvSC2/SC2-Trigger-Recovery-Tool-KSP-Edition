import {createHash} from 'node:crypto';
import {transportGuiGlobalBindings as parent} from './gui-global-binding-transport.isolated-observers.mjs';
import {inspectNamedStorageObservers} from '../analysis/named-storage-observers.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');

export function transportGuiGlobalBindings(before,after,options){
 const result=parent(before,after,options),records=result.proof.records;
 if(!records.length)return result;
 const names=records.flatMap(r=>[r.source,r.target]);
 const guards=[before,after].map(text=>inspectNamedStorageObservers(text,names,options));
 const unknown=guards.some(g=>g.unknownObserverInput),observed=new Set(guards.flatMap(g=>g.observedNames));
 const blocked=records.filter(r=>unknown||observed.has(r.source)||observed.has(r.target)),sources=new Set(blocked.map(r=>r.source));
 const edits=result.proof.edits.filter(e=>!sources.has(e.before)).map(({start,end,before,replacement})=>({start,end,before,replacement}));
 const qualified=applyReversibleSourceEdits(before,edits);
 return {before:qualified.text,after,proof:{...result.proof,records:records.filter(r=>!sources.has(r.source)),edits:qualified.proof.edits,
  refused:[...result.proof.refused,...blocked.map(r=>({...r,reason:unknown?'UNKNOWN_NATIVE_STORAGE_PATH':'NATIVE_STORAGE_NAME_OBSERVED'}))],
  viewBeforeSha256:sha(qualified.text),namedStorageObservers:guards,byteInverseVerified:qualified.proof.byteInverseVerified,
  runtimeStoragePathsNotRewritten:true,unknownNativeStorageObserversRejected:true}};
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSharedStraightLineCallFrames as project} from './shared-straight-line-call-frames.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
const helper='void Shared(){Effect(2);Other(7);}',before=helper+' bool Callback(){Shared();return true;}',after=helper+' bool Callback(){Effect(2);Other(7);return true;}';
test('one unchanged public helper may be inlined at a call site while its body remains available',async()=>{
 const p=project(before,after),o=await openPinnedUserOracle();assert((await o.compare(p.before,p.after)).exact);await o.verify();
 assert.equal(p.proof.records.before.length,1);assert.equal(p.proof.records.after.length,0);assert.match(p.before,/void Shared/);assert.match(p.after,/void Shared/);
});
test('changed effects, missing effect, order, argument and return result remain unequal',async()=>{
 const o=await openPinnedUserOracle();
 for(const changed of [after.replace('Effect(2);Other(7);return','Effect(3);Other(7);return'),after.replace('Other(7);return','return'),after.replace('Effect(2);Other(7);return','Other(7);Effect(2);return'),after.replace('return true','return false'),after.replace('void Shared(){Effect(2)','void Shared(){Effect(3)')]){
  const p=project(before,changed);assert(!(await o.compare(p.before,p.after)).exact);
 }await o.verify();
});
test('formals, storage, early return and ambiguous global names do not become transparent helpers',()=>{
 for(const h of ['void Shared(int p){Effect(p);}','void Shared(){int x;Effect(2);}','void Shared(){return;Effect(2);}','int Shared(){Effect(2);return 0;}','int Shared;void Shared(){Effect(2);}']){
  const p=project(h+' void Caller(){Shared();}',h+' void Caller(){Effect(2);}');assert.equal(p.proof.records.before.length,0);
 }
});
test('direct lexical storage observations and local or formal function-name shadows block expansion',()=>{
 for(const text of [helper+' void Caller(){int Shared;Shared();}',helper+' void Caller(int Shared){Shared();}']){
  const p=project(text,text);assert.equal(p.proof.records.before.length,0);
 }
 const h='void Shared(){UnitRefFromVariable("local");}';
 const p=project(h+'bool Callback(){Shared();return true;}',h+'bool Callback(){UnitRefFromVariable("local");return true;}');
 assert.equal(p.proof.records.before.length,0);assert(p.proof.rejectedHelpers.some(r=>/STORAGE_OBSERVER/.test(r.reason)));
 const unrelated=project(before,after,{externalSources:[{fileName:'Observe.galaxy',text:'void Side(){UnitRefFromVariable("local");}'}]});
 assert.equal(unrelated.proof.records.before.length,1);
 const conflict=project(before,after,{externalSources:[{fileName:'Conflict.galaxy',text:'void Shared(){Different();}'}]});
 assert.equal(conflict.proof.records.before.length,0);assert(conflict.proof.rejectedHelpers.some(r=>/FOREIGN_DECLARATION/.test(r.reason)));
});

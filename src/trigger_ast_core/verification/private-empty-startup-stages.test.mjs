import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePrivateEmptyStartupStages as project} from './private-empty-startup-stages.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
const before='void Stage(){Effect();}void InitMap(){Stage();}',after='void Stage(){Effect();}void Empty(){}void InitMap(){Stage();Empty();}';
test('only a private empty entry stage can disappear from the full comparison view',async()=>{
 const p=project(before,after),o=await openPinnedUserOracle();assert.equal(p.proof.after.length,1);assert((await o.compare(p.before,p.after)).exact);await o.verify();
});
test('a nonempty body, another caller, function reference and name observer remain obligations',()=>{
 for(const changed of [after.replace('Empty(){}','Empty(){Other();}'),after+'void Again(){Empty();}',after+'funcref<SomeType> f=Empty;',after+'void Lookup(){TriggerCreate("Empty");}']){
  const p=project(before,changed);assert.equal(p.proof.after.length,0);
 }
});
test('unknown dynamic names in either side or a preserved source prevent private-stage removal',()=>{
 const d='native string Input();void Dynamic(){TriggerCreate(Input());}';
 for(const [a,b,e] of [[before+d,after,[]],[before,after+d,[]],[before,after,[{fileName:'Owned.galaxy',text:d}]]]){
  const p=project(a,b,e);assert.equal(p.proof.after.length,0);assert(p.proof.refused.length);
 }
});
test('missing or reordered nonempty stages cannot be accepted by empty-stage projection',async()=>{
 const o=await openPinnedUserOracle();
 for(const changed of [after.replace('Stage();Empty();','Empty();'),after.replace('Effect();','Other();')]){
  const p=project(before,changed);assert(!(await o.compare(p.before,p.after)).exact);
 }await o.verify();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectUnusedConstantMirrors as inspect} from './source-global-unused-constant-mirrors.mjs';
const c={id:'10000001',type:'Variable',library:'Map',name:'enum_Test',identifier:'enum_Test',isConstant:true,variableType:{type:'int'}};
const category={id:'10000002',type:'Category',library:'Map',name:'Constants',items:[{type:'Variable',id:c.id}]};
const libraries=(extras=[])=>new Map([['Map',{id:'Map',items:[category],elements:Object.fromEntries([c,category,...extras].map(e=>[e.id,e]))}]]);
const original='const int enum_Test=1;void InitMap(){}',exported='const int gv_enum_Test=1;void InitMap(){}';
test('discovers an unused exact source constant while requiring later full proof',()=>{
 const r=inspect({original,exported,guiLibraries:libraries()});assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].sourceName,'enum_Test');assert(!r.guiPatchAuthorized&&!r.wholeMapAccepted);
});
test('source, native or GUI uses and differing values refuse the candidate',()=>{
 assert.equal(inspect({original:original+'int F(){return enum_Test;}',exported,guiLibraries:libraries()}).candidates.length,0);
 assert.equal(inspect({original,exported:exported+'int F(){return gv_enum_Test;}',guiLibraries:libraries()}).candidates.length,0);
 assert.equal(inspect({original,exported:exported.replace('=1','=2'),guiLibraries:libraries()}).candidates.length,0);
 const p={library:'Map',type:'Param',id:'10000003',variable:{type:'Variable',id:c.id}};assert.equal(inspect({original,exported,guiLibraries:libraries([p])}).candidates.length,0);
});
test('an unclosed source include and existing GUI never authorize candidates',()=>{
 assert.equal(inspect({original:'include "missing"\n'+original,exported,guiLibraries:libraries()}).reason,'INCOMPLETE_INCLUDE_CLOSURE');
 assert.equal(inspect({original,exported,guiLibraries:libraries(),existingTriggerData:true}).reason,'PRESERVE_EXISTING_GUI_STRUCTURE');
});

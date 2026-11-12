import test from 'node:test';
import assert from 'node:assert/strict';
import {planRetainedNominalDeclarations as plan,verifyRetainedNominalDeclaration as verify,verifyRetainedNominalGui as gui} from './retained-nominal-declarations.mjs';
const input={libraryId:'Map',script:'include "types"\nstruct gs_Box{gs_External lv_x;};gs_Box gv_box;void Work(){gv_box.lv_x.value=2;}',additionalScripts:[{fileName:'types.galaxy',text:'struct gs_External{int value;};'}]};
test('source units have exact numeric AST declaration kinds for independent lowering',()=>{
 const r=plan(input);assert.equal(r.length,1);assert.equal(r[0].declarations.length,2);assert(r[0].declarations.every(d=>Number.isInteger(d.kind)));
 assert.deepEqual(r[0].privateDeclarations.map(d=>d.kind),r[0].declarations.map(d=>d.kind));assert.equal(verify(input,r[0]).declarations,2);
});
test('a fresh replay rejects injected bodies, altered ranges and wrong owners',()=>{
 const r=plan(input)[0];for(const change of [{code:r.code+'void Inject(){}'},{end:r.end+1},{library:'Other'}])assert.throws(()=>verify(input,{...r,...change}));
});
test('GUI replay requires exactly one passive original section with no init hook',()=>{
 const r=plan(input)[0],e={library:'Map',type:'CustomScript',id:'12345678',scriptCode:r.code},libs=new Map([['Map',{elements:{one:e}}]]);
 assert.equal(gui(input,r,libs).id,e.id);assert.throws(()=>gui(input,r,new Map([['Map',{elements:{one:{...e,initFunc:'Run'}}}]])));
 assert.throws(()=>gui(input,r,new Map([['Map',{elements:{one:e,two:{...e,id:'22222222'}}}]])));
});
test('existing GUI and source-free input do not select a new passive unit',()=>{
 assert.deepEqual(plan({...input,existingTriggerData:'<TriggerData/>'}),[]);assert.deepEqual(plan({...input,additionalScripts:[]}),[]);
});

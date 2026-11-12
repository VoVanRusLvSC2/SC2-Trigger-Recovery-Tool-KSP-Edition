import test from 'node:test';
import assert from 'node:assert/strict';
import {transportGuiGlobalBindings as transport} from './gui-global-binding-transport.array-storage-observers.mjs';
const variable={id:'10101010',type:'Variable',library:'Map',identifier:'cells',name:'cells',variableType:{type:'bool'},isArray:true,arraySizes:[{dim:0,value:'2'}]};
const options={libraries:new Map([['Map',{id:'Map',elements:{'Variable:10101010':variable}}]])};
const a='bool[3] cells;void Main(){cells[1]=true;}',b='bool[3] gv_cells;void Main(){gv_cells[1]=true;}';
test('array alpha changes only references to the verified GUI global',()=>{
  const r=transport(a,b,options);assert.equal(r.before,b);assert.equal(r.proof.records.length,1);
  assert(r.proof.byteInverseVerified);assert.equal(r.proof.records[0].storageShape.rank,1);
});
test('emitted shape mismatch, lexical capture and altered GUI extent refuse',()=>{
  for(const [source,target,opts]of [[a,b.replace('[3]','[4]'),options],
    [a.replace('cells[1]=true;','bool gv_cells;cells[1]=true;'),b,options],
    [a,b,{libraries:new Map([['Map',{id:'Map',elements:{'Variable:10101010':{...variable,arraySizes:[{dim:0,value:'3'}]}}}]])}]]){
    const r=transport(source,target,opts);assert.equal(r.before,source);assert.equal(r.proof.records.length,0);
  }
});
test('literal and external source observers block that storage identity',()=>{
  const source=a+'string path="cells[1]";';assert.equal(transport(source,b,options).before,source);
  const r=transport(a,b,{...options,externalSources:[{fileName:'Observed.galaxy',text:'bool[3] cells;void Observer(){cells[0]=false;}'}]});assert.equal(r.before,a);
});
test('constant concatenated native storage paths cannot evade observation',()=>{
  const abi='native unitref UnitRefFromVariable(string path);';
  const source=abi+'bool[3] cells;void Main(){UnitRefFromVariable("ce"+"lls[1]");cells[1]=true;}';
  const target=source.replaceAll('bool[3] cells','bool[3] gv_cells').replace('cells[1]=true','gv_cells[1]=true');
  const r=transport(source,target,options);assert.equal(r.before,source);assert.equal(r.proof.records.length,0);
});
test('a different local with the source spelling never becomes the global',()=>{
  const source=a+'void Other(){bool cells;cells=false;}',target=b+'void Other(){bool cells;cells=false;}';
  const r=transport(source,target,options);assert.equal(r.before,target);assert(r.before.includes('bool cells;cells=false;'));
});

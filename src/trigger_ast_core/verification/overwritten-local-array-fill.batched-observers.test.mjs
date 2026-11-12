import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalOverwrittenLocalInitializations as old} from './overwritten-local-array-fill.mjs';
import {canonicalOverwrittenLocalInitializations as batched} from './overwritten-local-array-fill.batched-observers.mjs';
const header='native unitref UnitRefFromVariable(string path);';
const functions='int F(){int a;a=0;a=1;return a;} int G(){int b;b=0;b=2;return b;}';
function parity(source,context={}){const a=old(source,context),b=batched(source,context);assert.equal(b.text,a.text);assert.deepEqual(b.proof.records,a.proof.records);assert.deepEqual(b.proof.refused,a.proof.refused);assert.deepEqual(b.proof.edits,a.proof.edits);return b;}
test('Many eligible locals share one observer scan with identical edit and refusal decisions',()=>{
 const source=header+'int F(){int a;int b;a=0;b=0;a=1;b=2;return a+b;}'+functions.replace('int F()','int H()');
 const r=parity(source);assert(r.proof.records.length>=3);assert.equal(r.proof.observerAnalysis.queries,1);
});
test('Named references block only their old per-function name sets, including case folding',()=>{
 for(const path of ['F','f','G','b','other']){
  const r=parity(header+functions+'void Observe(){UnitRefFromVariable("'+path+'");}');
  if(path.toLowerCase()==='f')assert.deepEqual(r.proof.records.map(n=>n.function),['G']);
 }
 const collision=functions.replace('int b;b=0;b=2;return b','int a;a=0;a=2;return a');
 assert.equal(parity(header+collision+'void Observe(){UnitRefFromVariable("F.a");}').proof.records.length,0);
});
test('Unknown input, nonnative shadow and foreign observers retain the original vetoes',()=>{
 for(const source of [header+functions+'void Observe(string path){UnitRefFromVariable(path);}',
  'unitref UnitRefFromVariable(string path){return null;}'+functions+'void Observe(){UnitRefFromVariable("F");}']){
  assert.equal(parity(source).proof.records.length,0);
 }
 const r=parity(header+functions,{externalSources:[{fileName:'foreign.galaxy',text:'void Observe(){UnitRefFromVariable("F");}'}]});assert.deepEqual(r.proof.records.map(n=>n.function),['G']);
});
test('Must-write, flow bounds and no-default assumptions remain unchanged',()=>{
 for(const source of ['int F(){int a;a=0;if(Unknown()){a=1;}return a;}',
  'int F(){int a;a=0;while(true){}return a;}',
  'native void ObserveText(string s);void F(){string s;int i;s=null;for(i=1;i<=2;i+=1){s="new";ObserveText(s);}}'])parity(source);
});

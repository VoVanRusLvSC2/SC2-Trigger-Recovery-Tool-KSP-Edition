import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalDeadLocalLiteralStores as proof} from './dead-local-literal-stores.mjs';
const run=body=>proof('native void Use(int value);void Main(){'+body+'}');
test('never read scalar and its literal store are absent only in proof view',()=>{
 const r=run('int x;x=0;');assert.equal(r.proof.records.length,2);assert(!r.text.includes('int x'));assert(r.proof.edits.byteInverseVerified);
});
test('overwritten text literal drops without relying on null default semantics',()=>{
 const r=proof('native void UseText(text value);native text MakeText();void Main(){text value;value=null;value=MakeText();UseText(value);}');assert.equal(r.proof.records.length,1);assert(r.text.includes('MakeText()'));assert(r.text.includes('UseText(value)'));
});
test('a read, self update or escape retains the first store',()=>{
 for(const tail of ['Use(x);x=9;','x=x+1;','Capture(x);x=9;'])assert(run('int x;x=0;'+tail).text.includes('x=0;'));
});
test('conditional writes do not dominate the original store',()=>{
 assert.equal(run('int x;x=0;if(Check()){x=7;}Use(x);').proof.records.length,0);
});
test('a for initializer dominates the next counter reference; while condition does not',()=>{
 assert.equal(run('int x;x=0;for(x=1;x<5;x=x+1){Use(x);}').proof.records.length,1);
 assert.equal(run('int x;x=0;while(x<5){Use(x);x=x+1;}').proof.records.length,0);
});
test('parameters, globals, aggregates and effectful stores remain',()=>{
 for(const source of ['void Main(int x){x=0;}', 'int x;void Main(){x=0;}', 'void Main(){int[2] x;x[0]=0;}', 'void Main(){int x;x=Effect();}'])assert.equal(proof(source).proof.records.length,0);
});
test('nested shadowed storage refuses',()=>assert.equal(run('int x;x=0;{int x;Use(x);}').proof.records.length,0));
test('named storage lookup prevents eliminating its observed cell',()=>{
 assert.throws(()=>proof('native unitref UnitRefFromVariable(string name);void Main(){unit x;x=null;UnitRefFromVariable("Main.x");}'),/DEAD_LOCAL_NAMED_STORAGE_OBSERVER/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEntryLocalDefaultPair as proof} from './entry-local-default-pair.late.mjs';
const pair=(a,b)=>proof('void Main(){'+a+'}','void Main(){'+b+'}');
for(const[type,zero]of[['int','0'],['fixed','0.0'],['bool','false'],['unit','null'],['point','null'],['region','null']])test('fresh '+type+' default store has the same implicit entry value',()=>{
 const r=pair(`${type} value; value=${zero}; Use(value);`,`${type} value; Use(value);`);assert.equal(r.proof.records.length,1);assert(!r.before.includes('value ='));assert(r.before.includes('Use(value)'));
});
test('a default already present on both sides is retained',()=>assert.equal(pair('int x;x=0;Use(x);','int x;x=0;Use(x);').proof.records.length,0));
test('non-default values and allocating constructors remain',()=>{
 for(const[type,value]of[['int','1'],['fixed','0.25'],['bool','true'],['unit','UnitCreate()'],['unitgroup','UnitGroupEmpty()'],['string','""']])assert.equal(pair(`${type} x;x=${value};Use(x);`,`${type} x;Use(x);`).proof.records.length,0);
});
test('parameters cannot borrow fresh-local defaults',()=>assert.equal(proof('void Main(int x){x=0;Use(x);}','void Main(int x){Use(x);}').proof.records.length,0));
test('global state is never erased',()=>assert.equal(proof('int x;void Main(){x=0;Use(x);}','int x;void Main(){Use(x);}').proof.records.length,0));
test('an earlier write, read or reference-taking call refuses',()=>{
 for(const prefix of ['x=7;','Use(x);','Capture(x);'])assert.equal(pair('int x;'+prefix+'x=0;Use(x);','int x;'+prefix+'Use(x);').proof.records.length,0);
});
test('repeated runtime resets and stores after control flow stay intact',()=>{
 for(const body of ['while(true){x=0;Use(x);}','if(Check()){x=0;}Use(x);','if(Check()){}x=0;Use(x);'])assert.equal(pair('int x;'+body,'int x;Use(x);').proof.records.length,0);
});
test('an explicit declaration initializer does not count as an implicit default',()=>assert.equal(pair('int x=7;x=0;Use(x);','int x;Use(x);').proof.records.length,0));
test('arrays, fields and nominal aliases remain outside this rule',()=>{
 for(const a of ['int[2] x;x[0]=0;','Box x;x.value=0;','Alias x;x=0;'])assert.equal(pair(a+'Use(x);',a.split(';')[0]+';Use(x);').proof.records.length,0);
});
test('different opposite carrier or missing local refuses',()=>{
 assert.equal(pair('int x;x=0;Use(x);','fixed x;Use(x);').proof.records.length,0);
 assert.equal(pair('int x;x=0;Use(x);','Use(0);').proof.records.length,0);
});
test('a changed non-default on the other side is preserved for the final oracle',()=>{
 const r=pair('int x;x=0;Use(x);','int x;x=9;Use(x);');assert.equal(r.proof.records.length,1);assert(r.after.includes('x=9;'));assert.notEqual(r.before,r.after);
});

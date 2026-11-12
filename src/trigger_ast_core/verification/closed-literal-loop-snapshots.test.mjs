import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalClosedLiteralLoopSnapshots as canonical} from './closed-literal-loop-snapshots.mjs';
const wrap=body=>'native void Use(int value);void F(){'+body+'}',run=body=>canonical(wrap(body));
test('a single closed integer reset immediately before its only loop and a const snapshot have the same value view',()=>{
 const a=run('int n;int i;if(true){n=2;for(i=0;i<n;i+=1){Use(i);}}'),b=run('const int n=2;int i;if(true){for(i=0;i<n;i+=1){Use(i);}}');
 assert.equal(a.proof.records.length,1);assert.equal(b.proof.records.length,1);assert(a.text.includes('i<(2)'));assert(!a.text.includes('int n'));assert(a.proof.byteInverseVerified&&a.proof.exactPlannedStructureVerified);
});
test('different literal values remain different, including signed values',()=>{
 const a=run('int n;int i;n=-2;for(i=0;i<n;i+=1){}'),b=run('const int n=3;int i;for(i=0;i<n;i+=1){}');
 assert.equal(a.proof.records.length,1);assert(a.text.includes('(-2)'));assert(b.text.includes('(3)'));
});
test('a branch-only write does not dominate a later loop and old-value reads refuse substitution',()=>{
 for(const body of ['int n;int i;if(true){n=2;}for(i=0;i<n;i+=1){}','int n;int i;Use(n);n=2;for(i=0;i<n;i+=1){}','int n;int i;n=2;Use(9);for(i=0;i<n;i+=1){}'])assert.equal(run(body).proof.records.length,0);
});
test('writes in the loop, another lifetime, unknown by-reference effects, and dynamic values refuse',()=>{
 for(const body of ['int n;int i;n=2;for(i=0;i<n;i+=1){n+=1;}','int n;int i;n=2;for(i=0;i<n;i+=1){}Use(n);','int n;int i;n=2;for(i=0;i<n;i+=1){Unknown(n);}','int n;int i;n=Produce();for(i=0;i<n;i+=1){}'])assert.equal(run(body).proof.records.length,0);
});
test('only private integer cells qualify; globals, fixed coercions, arrays and shadowed names stay',()=>{
 for(const source of ['int n;void F(){int i;n=2;for(i=0;i<n;i+=1){}}','void F(){fixed n;int i;n=2;for(i=0;i<n;i+=1){}}','void F(){int[2] n;int i;n[0]=2;for(i=0;i<n[0];i+=1){}}','void F(){int n;int i;n=2;for(i=0;i<n;i+=1){{int n;}}}'])assert.equal(canonical(source).proof.records.length,0);
});
test('named and unknown standard storage observers veto the local transformation',()=>{
 for(const argument of ['"F.n"','name']){
  const r=canonical('native unitref UnitRefFromVariable(string value);void F(string name){int n;int i;n=2;for(i=0;i<n;i+=1){UnitRefFromVariable('+argument+');}}');
  assert.equal(r.proof.records.length,0);assert(r.proof.refused.some(r=>r.reason==='NAMED_STORAGE_OBSERVER'));
 }
});
test('the loop and external side effects remain; a typed by-value integer argument is closed',()=>{
 const r=run('int n;int i;n=2;for(i=0;i<n;i+=1){Use(n);Use(i);}');assert.equal(r.proof.records.length,1);assert(r.text.includes('Use((2))'));assert(r.text.includes('Use(i)'));assert(r.text.includes('i+=1'));
});
test('array-size/type uses are exhaustive even when the SDK child visitor omits ArrayType.size',()=>{
 for(const body of ['const int n=2;int[n] a;int i;for(i=0;i<n;i+=1){}','const int n=2;int i;for(i=0;i<n;i+=1){int[n] a;}'])assert.equal(run(body).proof.records.length,0);
});

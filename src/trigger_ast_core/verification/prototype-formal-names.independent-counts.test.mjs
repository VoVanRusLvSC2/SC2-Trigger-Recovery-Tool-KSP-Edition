import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePrototypeFormalNamesPair as view} from './prototype-formal-names.independent-counts.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
test('one generated header and no source header retain counts and exact ABI',async()=>{
  const a='int F(int left){return left+1;}',b='int F(int old);int F(int right){return right+1;}';
  const r=view(a,b);assert.equal(r.records.length,1);assert.equal(r.before,a);assert(r.after.includes('int F(int right);'));
  const oracle=await openPinnedUserOracle();assert((await oracle.compare(r.before,r.after)).exact);
});
test('two compatible headers remain two headers rather than being erased',()=>{
  const r=view('int F(int a){return a;}','int F(int x);int F(int y);int F(int b){return b;}');
  assert.equal((r.after.match(/int F\(/gu)??[]).length,3);assert.equal(r.records[0].prototypes,2);
});
test('conflicting ABI, missing body, dependent type and duplicate bodies refuse',()=>{
  const a='int F(int a){return a;}';
  for(const b of ['fixed F(int x);int F(int b){return b;}','int F(int b);',
    'int F(int b){return b;}int F(int c){return c;}']){
    const r=view(a,b);assert.equal(r.after,b);assert.equal(r.records.length,0);
  }
});
test('static and parameter carrier differences stay visible to the oracle',async()=>{
  const oracle=await openPinnedUserOracle();
  for(const b of ['int F(int old);int F(int b){return b;}','fixed F(fixed old);fixed F(fixed b){return b;}']){
    const r=view('static int F(int a){return a;}',b);assert(!(await oracle.compare(r.before,r.after)).exact);
  }
});

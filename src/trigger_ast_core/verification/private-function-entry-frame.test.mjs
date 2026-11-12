import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalPrivateFunctionEntryFrame as view} from './private-function-entry-frame.mjs';
import {canonicalBoundPrivateLexicalNames as alpha} from './bound-private-lexical-alpha.mjs';
import {normalizePrototypeFormalNamesPair} from './prototype-formal-names.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
const oracle=await openPinnedUserOracle();
async function compare(a,b){const x=view(a),y=view(b),p=normalizePrototypeFormalNamesPair(x.text,y.text);return oracle.compare(p.before,p.after);}
test('formals follow positional bound ABI rather than shared spelling',async()=>{
  assert((await compare('int F(int a,int b){return a-b;}','int F(int b,int a){return b-a;}')).exact);
  assert(!(await compare('int F(int a,int b){return a-b;}','int F(int b,int a){return a-b;}')).exact);
});
test('prototypes with independent names bind to actual body formals',async()=>{
  assert((await compare('int F(int old);int F(int a){return a+1;}','int F(int old);int F(int p){return p+1;}')).exact);
});
test('ordered scalar captures move past passive fixed arrays without changing effects',async()=>{
  const a='int shared;int F(){int x=shared;int[4] values;int y=shared+1;values[0]=x;return values[0]+y;}';
  const b='int shared;int F(){int[4] slots;int a;int b;a=shared;b=shared+1;slots[0]=a;return slots[0]+b;}';
  assert((await compare(a,b)).exact);
  assert(!(await compare(a,b.replace('b=shared+1','b=shared+2'))).exact);
});
test('call and global-read initializer order cannot be exchanged',async()=>{
  const a='int G;int Bump(){G+=1;return G;}int F(){int a=Bump();int b=G;return a-b;}';
  const b='int G;int Bump(){G+=1;return G;}int F(){int x;int y;y=G;x=Bump();return x-y;}';
  assert(!(await compare(a,b)).exact);
});
test('global and member names remain outside lexical renaming',()=>{
  const r=alpha('struct Box{int value;};int value;int F(int p){Box b;int x; x=value+p;b.value=x;return b.value;}');
  assert(r.text.includes('int value;'));assert(r.text.includes('b.value')||r.text.includes('.value'));
  assert(!r.proof.reason);assert(r.proof.byteInverseVerified&&r.proof.exactPlannedStructureVerified);
});
test('different member, carrier, bound and storage mode remain different',async()=>{
  for(const [a,b]of [
    ['int F(int p){int[2] a;a[0]=p;return a[0];}','int F(int q){int[3] b;b[0]=q;return b[0];}'],
    ['int F(int p){return p;}','fixed F(fixed q){return q;}'],
    ['int F(){int x=1;return x;}','int F(){static int y=1;return y;}']
  ])assert(!(await compare(a,b)).exact);
});
test('invalid or ambiguous nested declarations cannot authorize an alpha plan',()=>{
  const a='int F(int p){int x;x=p;if(p>0){int x;x=2;}return x;}';
  const r=alpha(a);assert.equal(r.text,a);assert(r.proof.reason==='INCOMPLETE_INCLUDE_CLOSURE'||r.proof.refused.some(x=>x.reason==='AMBIGUOUS_LOCAL_SCOPE'));
});
test('incomplete include closure cannot authorize local/formal binding',()=>{
  const a='include "Missing"\nint F(int p){return p;}';const r=alpha(a);
  assert.equal(r.text,a);assert.equal(r.proof.reason,'INCOMPLETE_INCLUDE_CLOSURE');
});
test('reference mode and parameter argument positions stay exact',async()=>{
  const a='struct Pair{int a;int b;};int F(structref<Pair> p,int n){p.a=n;return p.b;}';
  assert((await compare(a,'struct Pair{int a;int b;};int F(structref<Pair> q,int v){q.a=v;return q.b;}')).exact);
  assert(!(await compare(a,'struct Pair{int a;int b;};int F(structref<Pair> q,int v){q.b=v;return q.a;}')).exact);
});

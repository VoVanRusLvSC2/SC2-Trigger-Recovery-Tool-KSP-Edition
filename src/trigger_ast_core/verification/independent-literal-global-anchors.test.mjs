import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalIndependentLiteralGlobalAnchors as normalize} from './independent-literal-global-anchors.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
test('independent guard store crosses unrelated constant-bound passive storage; complete oracle becomes exact',async()=>{
 const a='bool ready=false;const int limit=4;int[limit] values;void F(){ready=true;}',b='const int limit=4;int[limit] values;bool ready=false;void F(){ready=true;}';
 const oracle=await openPinnedUserOracle();assert(!(await oracle.compare(a,b)).exact);
 const x=normalize(a),y=normalize(b);assert((await oracle.compare(x.text,y.text)).exact);assert.equal(y.proof.newWrites,0);await oracle.verify();
});
test('computed initializers and includes remain barriers even when the final bodies match',async()=>{
 const oracle=await openPinnedUserOracle();
 for(const barrier of ['native int Effect();int observed=Effect();']){
  const a='bool ready=false;'+barrier+'void F(){}',b=barrier+'bool ready=false;void F(){}';
  assert(!(await oracle.compare(normalize(a).text,normalize(b).text)).exact);
 }await oracle.verify();
 const a='bool ready=false;include "UnknownLibrary"\nvoid F(){}',b='include "UnknownLibrary"\nbool ready=false;void F(){}';
 assert.equal(normalize(a).text,a);assert.equal(normalize(b).text,b);
});
test('a header type reading the initialized name prevents its relocation',()=>{
 const text='const int count=2;int length=2;int[length] values;bool ready=false;';
 const r=normalize(text);assert(!r.proof.records.flatMap(n=>n.moved).includes('length'));assert(r.text.indexOf('int length')<r.text.indexOf('int[length]'));
});
test('nonmoving declaration order, literal values, function bodies and idempotency survive',()=>{
 const text='const int count=2;int[count] storage;int z=7;bool a=true;void F(){z=9;}';const r=normalize(text);
 assert.equal(normalize(r.text).text,r.text);assert(r.text.indexOf('const int count')<r.text.indexOf('int[count] storage'));assert(r.text.includes('void F(){z=9;}'));assert(r.text.includes('int z=7;'));
});
test('explicit intrinsic handle null stores commute, but allocating calls and nominal types remain opaque',async()=>{
 const oracle=await openPinnedUserOracle(),a='unitgroup group=null;trigger callback=null;void F(){}',b='trigger callback=null;unitgroup group=null;void F(){}';
 assert((await oracle.compare(normalize(a).text,normalize(b).text)).exact);
 const ctor='native unitgroup UnitGroupEmpty();unitgroup group=UnitGroupEmpty();bool ready=false;';assert.equal(normalize(ctor).text,ctor);
 const nominal='struct S{int x;};S data;bool ready=false;';assert(!normalize(nominal).proof.records.flatMap(r=>r.moved).includes('data'));await oracle.verify();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalBranchLiteralCallCaptures as view} from './branch-literal-call-captures.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
const header='native void Consume(int a,int b);native bool Choose();';
const body='int x;int y;if(Choose()){x=0;y=3;}else{x=1;y=2;}Consume(x,y);';
const source=body=>header+'void Main(){'+body+'}';
test('closed literal cells become the exact original branch calls',async()=>{
  const r=view(source(body));assert.equal(r.proof.records.length,1);assert(r.proof.byteInverseVerified&&r.proof.allOtherAstExact);
  const oracle=await openPinnedUserOracle();assert((await oracle.compare(r.text,source('if(Choose()){Consume(0,3);}else{Consume(1,2);}'))).exact);
});
test('the condition, other arguments and call schedule remain once and ordered',()=>{
  const r=view(source(body));assert.equal((r.text.match(/Choose\(\)/gu)??[]).length,2);
  assert.equal(r.proof.records[0].callEvaluatedOnce,true);
});
test('read or write outside the private join prevents capture elimination',()=>{
  for(const extra of ['x=9;','Consume(x,0);']){const a=source(body+extra),r=view(a);assert.equal(r.text,a);assert.equal(r.proof.records.length,0);}
});
test('nonliteral RHS, missing assignments and branch effects refuse',()=>{
  for(const changed of [body.replace('x=0','x=Read()'),body.replace('y=2;',''),body.replace('x=0;','x=0;Consume(1,2);')]){
    const a=source(changed),r=view(a);assert.equal(r.text,a);assert.equal(r.proof.records.length,0);
  }
});
test('unknown and reference-taking ABI cannot borrow by-value permission',()=>{
  const a=source(body).replace('native void Consume(int a,int b);','');assert.equal(view(a).text,a);
  const b=source(body).replace('Consume(int a,int b)','Consume(fixed a,int b)');assert.equal(view(b).text,b);
});
test('changed literal and changed condition remain different for the final oracle',async()=>{
  const oracle=await openPinnedUserOracle(),r=view(source(body));
  for(const b of [source(body.replace('y=2','y=4')),source(body.replace('if(Choose())','if(!Choose())'))])assert(!(await oracle.compare(r.text,view(b).text)).exact);
});

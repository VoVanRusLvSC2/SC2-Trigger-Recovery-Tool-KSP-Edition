import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {proveClosedFiniteProgramEquivalence as prove} from './finite-program-proof-pipeline.closed-storage-loop-captures.mjs';

const sha=s=>createHash('sha256').update(s).digest('hex');
const api='native unitgroup Make(int n);native void Add(unitgroup g,int value);';
const before=api+'int F(){unitgroup g;int i;g=Make(1);i=0;while(i<3){Add(g,i);i=i+1;}g=Make(2);i=0;while(i<2){Add(g,i);i=i+1;}return 1;}';
const after=api+'int F(){unitgroup a;int ai;unitgroup b;int bi;a=Make(1);ai=0;while(ai<3){Add(a,ai);ai=ai+1;}b=Make(2);bi=0;while(bi<2){Add(b,bi);bi=bi+1;}return 1;}';

test('one complete pair proves private capture splitting while retaining raw oracle',async()=>{
 const pairs=[];const r=await prove(before,after,{observeComparisonPair:p=>pairs.push(p)});
 assert.equal(pairs.length,1);assert.equal(sha(pairs[0].before),r.viewSha256.before);assert.equal(sha(pairs[0].after),r.viewSha256.after);
 assert(r.finiteProgramEquivalent&&r.comparison.exact&&r.comparison.syntaxValid);assert.equal(r.rawVerdict,'REVIEW');
 assert.equal(r.oracleFilesVerified,304);assert.equal(r.rawOracleReplaced,false);assert.equal(r.perFunctionProofUnion,false);assert.equal(r.wholeMapAccepted,false);
});
test('a changed loop effect or another changed function cannot be accepted',async()=>{
 for(const [source,candidate]of [[before,after.replace('Add(b,bi)','Add(b,bi+1)')],[before+'int Other(){return 1;}',after+'int Other(){return 2;}']]){
  const r=await prove(source,candidate);assert.equal(r.finiteProgramEquivalent,false);assert.equal(r.rawOracleReplaced,false);
 }
});
test('already identical programs still publish one hash-bound comparison pair',async()=>{
 const pairs=[],r=await prove(before,before,{observeComparisonPair:p=>pairs.push(p)});
 assert(r.finiteProgramEquivalent);assert.equal(pairs.length,1);assert.equal(sha(pairs[0].before),r.viewSha256.before);assert.equal(sha(pairs[0].after),r.viewSha256.after);
});

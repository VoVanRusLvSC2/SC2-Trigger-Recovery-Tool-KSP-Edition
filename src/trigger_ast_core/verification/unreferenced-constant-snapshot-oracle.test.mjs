import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalUnusedConstantSnapshotLocals as project} from './unreferenced-constant-snapshot-locals.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
const left='const int gv_Limit=15;int gv_Value;void InitMap(){gv_Value=1;}';
const right='const int gv_Limit=15;int gv_Value;void InitMap(){const int local=gv_Limit;gv_Value=1;}';
test('full pinned oracle accepts only the proven unused snapshot view',async()=>{
 const oracle=await openPinnedUserOracle();assert.equal(oracle.assets,304);
 const raw=await oracle.compare(left,right);assert(!raw.exact);
 const l=project(left),r=project(right);assert.equal(r.proof.edits.length,1);
 const checked=await oracle.compare(l.text,r.text);assert(checked.syntaxValid&&checked.exact);
 await oracle.verify();
});
test('the full pinned oracle still detects an altered business assignment',async()=>{
 const oracle=await openPinnedUserOracle(),changed=right.replace('gv_Value=1','gv_Value=2');
 const checked=await oracle.compare(project(left).text,project(changed).text);assert(checked.syntaxValid&&!checked.exact);
 await oracle.verify();
});
test('an effectful or used initializer remains visible to the oracle',async()=>{
 const oracle=await openPinnedUserOracle(),used=right.replace('gv_Value=1','gv_Value=local');
 assert.equal(project(used).proof.edits.length,0);
 const checked=await oracle.compare(project(left).text,project(used).text);assert(!checked.exact);
 await oracle.verify();
});

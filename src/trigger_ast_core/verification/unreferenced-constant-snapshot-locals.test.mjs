import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalUnusedConstantSnapshotLocals as run} from './unreferenced-constant-snapshot-locals.mjs';
const program='const int gv_Bound=15;void Init(){const int capture=gv_Bound;int x;x=1;}';
test('unused literal-backed integer snapshot is removed only from the reversible view',()=>{
 const r=run(program);assert.equal(r.proof.edits.length,1);assert(r.proof.byteInverseVerified);assert(!r.text.includes('capture'));assert(r.text.includes('const int gv_Bound=15;'));assert.equal(r.proof.wholeMapAccepted,false);
});
test('an observed local is retained',()=>{const s=program.replace('x=1','x=capture');assert.equal(run(s).proof.edits.length,0)});
test('mutable global, nonliteral initializer, function call and reference are not removed',()=>{
 for(const s of [program.replace('const int gv_Bound','int gv_Bound'),program.replace('gv_Bound=15','gv_Bound=Other()'),program.replace('capture=gv_Bound','capture=Other()'),program.replace('capture=gv_Bound','capture=Missing')])assert.equal(run(s).proof.edits.length,0);
});
test('two declarations using the same global are separately removed',()=>{const s=program.replace('int x;','const int other=gv_Bound;int x;');assert.equal(run(s).proof.edits.length,2)});
test('a global with an ambiguous declaration never authorizes a removal',()=>{const s=program+'const int gv_Bound=15;';assert.equal(run(s).proof.edits.length,0)});
test('local snapshot referenced in another initializer remains intact',()=>{const s=program.replace('int x;','int x=capture;');assert.equal(run(s).proof.edits.length,0)});

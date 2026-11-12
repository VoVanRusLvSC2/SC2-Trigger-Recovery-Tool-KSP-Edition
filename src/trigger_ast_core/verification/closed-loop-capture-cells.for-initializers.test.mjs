import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalClosedLoopCaptureCells as normalize} from './closed-loop-capture-cells.for-initializers.mjs';
import {canonicalIndependentLocalDeclarations as order} from './local-declaration-order.passive-storage.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';

const api='native void Emit(int n);';
const split=api+'int F(){int a;int b;for(a=0;a<2;a=a+1){Emit(a);}for(b=0;b<3;b=b+1){Emit(b);}return 5;}';
const reused=api+'int F(){int i;for(i=0;i<2;i=i+1){Emit(i);}for(i=0;i<3;i=i+1){Emit(i);}return 5;}';
const view=s=>order(normalize(s).text).text;

test('separate reset-for counters and one reused counter get the same whole-program view',async()=>{
 const r=normalize(reused);assert.equal(r.proof.records.filter(x=>x.from==='i').length,2);
 assert(r.proof.byteInverseVerified&&r.proof.exactPlannedStructureVerified);assert.equal((r.text.match(/\bfor\s*\(/gu)??[]).length,2);
 const oracle=await openPinnedUserOracle();assert((await oracle.compare(view(reused),view(split))).exact);assert.equal(oracle.assets,304);await oracle.verify();
});
test('live-out counter, old-value initializer and unknown call each refuse renaming',()=>{
 for(const source of [
  api+'int F(){int i;for(i=0;i<2;i=i+1){Emit(i);}return i;}',
  api+'int F(){int i;for(i=i+1;i<2;i=i+1){Emit(i);}return 0;}',
  'int F(){int i;for(i=0;i<2;i=i+1){Observe(i);}return 0;}'
 ]){const r=normalize(source);assert(!r.proof.records.some(x=>x.from==='i'));assert(r.proof.refused.some(x=>x.name==='i'));}
});
test('changed bounds, increments, effects and external functions remain unequal',async()=>{
 const oracle=await openPinnedUserOracle(),source=view(reused);
 for(const changed of [split.replace('b<3','b<4'),split.replace('b=b+1','b=b+2'),split.replace('Emit(b)','Emit(b+1)'),split+'int Other(){return 1;}'])
  assert.equal((await oracle.compare(source,view(changed))).exact,false);
 await oracle.verify();
});
test('a counter referenced in overlapping nested loops is never treated as private',()=>{
 const source=api+'int F(){int i;for(i=0;i<3;i=i+1){for(i=0;i<2;i=i+1){Emit(i);}}return 0;}';
 const r=normalize(source);assert(!r.proof.records.some(x=>x.from==='i'));assert(r.proof.refused.some(x=>x.name==='i'));
});

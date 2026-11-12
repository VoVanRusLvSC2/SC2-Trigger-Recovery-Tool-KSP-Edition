import test from'node:test';import assert from'node:assert/strict';import{discoverBoundConstantForCandidates as discover}from'./bound-constant-for-candidates.mjs';
const run=(bound='const int Limit=7;',header='i=0;i<=Limit;i+=1',body='Use(i);')=>discover(bound+'void Work(){int i;for('+header+'){'+body+'}}');
test('closed immutable int candidate keeps source and requires separate GUI and whole-program proof',()=>{const r=run();assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].boundValue,'7');assert.equal(r.sourceChanged,false);assert.equal(r.guiBindingAuthorized,false);assert.equal(r.wholeMapAccepted,false)});
test('mutable, unknown, non-integer and expression constants refuse',()=>{for(const bound of ['int Limit=7;','fixed Limit=7.0;','const int Limit=External();','const int Limit=1+6;',''])assert.equal(run(bound).candidates.length,0,bound)});
test('original while is never reclassified',()=>{const r=discover('const int Limit=7;void Work(){int i;i=0;while(i<=Limit){Use(i);i+=1;}}');assert.equal(r.candidates.length,0)});
test('bad direction, mutable step, shadowed counter and continue refuse',()=>{for(const [h,b]of [['i=0;i<=Limit;i+=-1','Use(i);'],['i=0;i<=Limit;i+=Next()','Use(i);'],['i=0;i<=Limit;i+=1','continue;'],['i=0;i<=Limit;i+=1','int i;Use(i);']])assert.equal(run('const int Limit=7;',h,b).candidates.length,0,h)});
test('unresolved include refuses rather than guessing a constant',()=>{const r=discover('include "Missing"\nconst int Limit=7;void Work(){int i;for(i=0;i<=Limit;i+=1){Use(i);}}');assert.equal(r.candidates.length,0);assert.equal(r.reason,'INCOMPLETE_INCLUDE_CLOSURE')});

test('counter capture, out-of-scope counter and argument counter are not candidates',()=>{
 for(const source of ['const int Limit=7;int i;void Work(){for(i=0;i<=Limit;i+=1){Use(i);}}','const int Limit=7;void Work(int i){for(i=0;i<=Limit;i+=1){Use(i);}}','const int Limit=7;void Work(){ {int i;}for(i=0;i<=Limit;i+=1){Use(i);}}'])assert.equal(discover(source).candidates.length,0,source);
});
test('multiple same-spelled source constants are never selected by spelling alone',()=>{
 const source='const int Limit=7;const int Limit=9;void Work(){int i;for(i=0;i<=Limit;i+=1){Use(i);}}';assert.equal(discover(source).candidates.length,0);
});
test('non-inclusive strict comparison overflow is rejected',()=>{
 assert.equal(run('const int Limit=-2147483648;','i=0;i<Limit;i+=1').candidates.length,0);
});

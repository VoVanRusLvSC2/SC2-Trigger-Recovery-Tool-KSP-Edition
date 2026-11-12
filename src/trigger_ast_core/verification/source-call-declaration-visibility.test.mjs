import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifySourceCallDeclarationVisibility as verify} from './source-call-declaration-visibility.mjs';
const context=dep=>({ownedSources:[{fileName:'dep.galaxy',text:dep}],externalSources:[],includeEvidence:[{from:'MapScript.galaxy',include:'dep',path:'dep.galaxy',layerId:'own'}]});
test('a resolvable body elsewhere does not supply a missing forward declaration',()=>{
 const c=context('void first(){later(1);}\nvoid later(int x){}'),p=verify('include "dep"',c);
 assert.equal(p.passed,false);assert.equal(p.failures.length,1);assert.equal(p.failures[0].callee,'later');assert.equal(p.failures[0].reason,'FORWARD_DECLARATION_MISSING_AT_CALL');
 assert(verify('void later(int original);\ninclude "dep"',c).passed);
});
test('prototype after a call does not repair its previous visibility',()=>{
 const c=context('void first(){later();}\nvoid later(){}');assert.equal(verify('include "dep"\nvoid later();',c).passed,false);
});
test('self recursion is visible at its own function header',()=>{
 const p=verify('void f(){f();}',{ownedSources:[],externalSources:[],includeEvidence:[]});assert(p.passed);assert.equal(p.checkedCalls,1);
});
test('mutual recursion requires the original declaration before the first call',()=>{
 const c=context('void a(){b();}\nvoid b(){a();}');assert.equal(verify('include "dep"',c).passed,false);assert(verify('void b();\ninclude "dep"',c).passed);
});
test('ABI disagreement remains a refusal despite earlier spelling match',()=>{
 const p=verify('void later(fixed x);\ninclude "dep"',context('void first(){later(1);}\nvoid later(int x){}'));assert.equal(p.passed,false);assert.equal(p.failures[0].reason,'ABI_MISMATCH');
});
test('native and unknown API availability is explicitly not certified',()=>{
 const p=verify('native int Api();\nvoid f(){Api();UnknownApi();}',{ownedSources:[],externalSources:[],includeEvidence:[]});
 assert(p.passed);assert.equal(p.checkedCalls,0);assert.equal(p.unqualifiedCalls,2);assert.equal(p.completeGalaxyCompiler,false);
});
test('a local homonym is not the global function family',()=>{
 const p=verify('void later(){}\nvoid f(){int later;later();}',{ownedSources:[],externalSources:[],includeEvidence:[]});
 assert.equal(p.checkedCalls,0);assert.equal(p.unqualifiedCalls,1);
});
test('unresolved include cannot be guessed from an available basename',()=>{
 const c=context('void f(){}');c.includeEvidence=[];assert.throws(()=>verify('include "dep"',c),/CALL_VISIBILITY_COMPLETE_BINDINGS_REQUIRED/);
});

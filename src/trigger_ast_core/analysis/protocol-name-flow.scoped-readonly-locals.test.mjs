import test from 'node:test';
import assert from 'node:assert/strict';
import {Parser} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {proveClosedProtocolNameAbsence as prove} from './protocol-name-flow.scoped-readonly-locals.mjs';
const check=text=>{const ast=new Parser().parseFile('scope.galaxy',text);assert.equal(ast.parseDiagnostics.length,0);return prove([ast],['PrivateCallback']);};

test('Readonly function-level string resolves independently of a same-name global',()=>{
 const result=check('const string label = "PrivateCallback"; void f() { string label = "SafeCallback"; TriggerCreate(label); }');
 assert.equal(result.observerCalls,1);assert.equal(result.readonlyLocals.length,1);
 assert.equal(result.readonlyLocals[0].globalOfSameNameNotRead,true);
});
test('A forbidden name reached through a local initializer is still observed',()=>{
 assert.throws(()=>check('void f() { string label = "PrivateCallback"; TriggerCreate(label); }'),/PROTOCOL_FLOW_NAME_OBSERVED/);
 assert.throws(()=>check('void f() { string label = "\\x50rivateCallback"; TriggerCreate(label); }'),/PROTOCOL_FLOW_NAME_OBSERVED/);
});
test('Local chains retain initializer order and exact strings',()=>{
 const result=check('void f() { string first = "Safe"; string second = first + "Callback"; TriggerCreate(second); }');
 assert.equal(result.readonlyLocals.length,2);
 assert.throws(()=>check('void f() { string second = first; string first = "Safe"; TriggerCreate(second); }'),/BEFORE_INITIALIZATION/);
});
test('Mutation and missing initializers refuse',()=>{
 assert.throws(()=>check('void f() { string label = "Safe"; label = "PrivateCallback"; TriggerCreate(label); }'),/LOCAL_WRITTEN/);
 assert.throws(()=>check('void f() { string label; TriggerCreate(label); }'),/INITIALIZER_REQUIRED/);
});
test('Unknown calls receiving a local cannot certify readonly storage',()=>{
 assert.throws(()=>check('void f() { string label = "Safe"; Unknown(label); TriggerCreate(label); }'),/REFERENCE_OR_UNKNOWN_CALL/);
});
test('Computed values remain unknown, rather than borrowing the global constant',()=>{
 assert.throws(()=>check('const string label = "Safe"; void f() { string label = Dynamic(); TriggerCreate(label); }'),/UNKNOWN_STRING_EXPRESSION/);
});

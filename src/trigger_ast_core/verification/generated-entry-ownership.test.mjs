import test from 'node:test';
import assert from 'node:assert/strict';
import {assertGeneratedEntryOwnership as check} from './generated-entry-ownership.mjs';
const library=(definition,implicit=true)=>({id:'Map',implicit,elements:{F:{type:'FunctionDef',library:'Map',id:'F',identifier:'InitMap',flags:['Action','NoScriptPrefix'],...definition}}});
test('Ordinary runtime entry with suppressed prefix is rejected before packing',()=>{
 assert.throws(()=>check(library(),['InitMap']),/GENERATED_ENTRY_GUI_OWNERSHIP_CONFLICT/);
});
test('Naming policy, prefix and implicit-library scope determine ownership',()=>{
 check(library(),['DifferentEntry']);check(library({flags:['Action']}),['InitMap']);check(library({},false),['InitMap']);
});
test('Disabled functions and non-runtime event/operator grammars do not collide',()=>{
 check(library({disabled:true}),['InitMap']);check(library({flags:['Event','NoScriptPrefix']}),['InitMap']);check(library({flags:['Operator','NoScriptPrefix']}),['InitMap']);
});

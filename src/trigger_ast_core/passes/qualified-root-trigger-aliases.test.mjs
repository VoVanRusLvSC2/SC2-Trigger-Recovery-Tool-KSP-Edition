import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalizeSourceBoundTriggerAliases as run} from './qualified-root-trigger-aliases.mjs';
import {Parser} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
const source='trigger gt_One; bool Callback(bool conditions, bool actions){if(!actions){return true;}return true;} void Build(){gt_One=TriggerCreate("Callback");} void Stage(){Build();} void InitMap(){Stage();}';
const native='native trigger TriggerCreate(string inFunction); native trigger TriggerFind(string inFunction); native string TriggerGetFunction(trigger t); native string EventChatMessage(bool full);';
const input=(text=source,extra='')=>({text,parse:(t,n)=>new Parser().parseFile(n,t),typeName:getTypeName,preserveSourceIdentities:true,sourceEligibility:{existingTriggerData:undefined,ownedSources:[]},otherSources:[{name:'natives.galaxy',text:native+extra}]});
test('private noncanonical roles can be alpha-bound without renamed storage or new runtime bodies',()=>{
 const r=run(input());assert.notEqual(r.text,source);assert.equal(r.proof.kind,'BOUND_PRIVATE_ROOT_TRIGGER_ALPHA');assert.equal(r.proof.storageIdentifiersUnchanged,true);assert.equal(r.proof.newRuntimeFunctions,0);assert.equal(r.proof.newNative,0);assert.match(r.text,/TriggerCreate\("gt_One_Func"\)/);assert.match(r.text,/void gt_One_Init/);
});
test('existing GUI or preserved source includes keep original identities',()=>{
 for(const scope of [{existingTriggerData:'<TriggerData/>',ownedSources:[]},{existingTriggerData:undefined,ownedSources:[{fileName:'Owned.galaxy',text:''}]}]){
  const r=run({...input(),sourceEligibility:scope});assert.equal(r.text,source);assert.match(r.proof.privateRootAlphaRefused,/PROTECTED_SOURCE_SCOPE/);
 }
});
test('callback-name getter blocks alpha permission',()=>{
 const text=source+' void Debug(){TriggerGetFunction(gt_One);}';const r=run(input(text));assert.equal(r.text,text);assert.match(r.proof.privateRootAlphaRefused,/CALLBACK_NAME_GETTER/);
});
test('arbitrary dynamic callback names remain unknown',()=>{
 const text=source+' void Dynamic(){TriggerCreate(EventChatMessage(false));}';const r=run(input(text));assert.equal(r.text,text);assert.match(r.proof.privateRootAlphaRefused,/PROTOCOL_FLOW_UNKNOWN_STRING_EXPRESSION/);
});
test('new callback name and new standard lifecycle names are protected too',()=>{
 for(const name of ['gt_One_Func','InitTriggers','InitGlobals']){
  const text=source+` void Lookup(){TriggerFind("${name}");}`;const r=run(input(text));assert.equal(r.text,text);assert.match(r.proof.privateRootAlphaRefused,/PROTOCOL_FLOW_NAME_OBSERVED/);
 }
});
test('foreign direct references and escaping function identities refuse',()=>{
 const r=run(input(source,' void External(){Build();}'));assert.equal(r.text,source);assert(r.proof.privateRootAlphaRefused);
 const text=source+' funcref<CallbackType> slot=Build;';const escaped=run(input(text));assert.equal(escaped.text,text);assert.match(escaped.proof.privateRootAlphaRefused,/ESCAPING_FUNCTION_REFERENCE|shadowed by variable/);
});
test('storage renaming and forged native declarations refuse',()=>{
 const text=source.replaceAll('gt_One','privateHandle');const r=run(input(text));assert.equal(r.text,text);assert.match(r.proof.privateRootAlphaRefused,/STORAGE_RENAME/);
 const i=input();i.otherSources=[{name:'forged.galaxy',text:'trigger TriggerCreate(string inFunction){return null;}'}];const forged=run(i);assert.equal(forged.text,source);assert.match(forged.proof.privateRootAlphaRefused,/NATIVE_CREATE_ABI_REQUIRED/);
});

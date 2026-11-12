import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeTriggerLibraryCanonical as serialize} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/trigger-xml.js';
import {readOwnedGuiLibraries} from '../verification/read-owned-gui-libraries.mjs';
import {buildRootSourceGlobalMirrors as build} from './root-source-global-mirrors.constants-preview.mjs';
const ref=e=>({library:e.library,type:e.type,id:e.id});
function fixture(){
 const owner='Map',tr={library:owner,type:'Variable',id:'10000001',name:'gt_Probe',identifier:'gt_Probe',variableType:{type:'trigger'}};
 const unit={library:owner,type:'Variable',id:'10000002',name:'Hero',identifier:'Hero',variableType:{type:'unit'},initialValue:{library:owner,type:'Param',id:'10000003'}};
 const init={library:owner,type:'Param',id:'10000003',valueType:{type:'int'},value:'1'};
 const p={library:owner,type:'Param',id:'10000004',parameterDef:{library:'Ntve',type:'ParamDef',id:'20000001'},variable:ref(tr)};
 const call={library:owner,type:'FunctionCall',id:'10000005',functionDef:{library:'Ntve',type:'FunctionDef',id:'20000002'},parameters:[ref(p)]};
 const constantValue={library:owner,type:'Param',id:'10000009',valueType:{type:'int'},value:'7'};
 const constant={library:owner,type:'Variable',id:'10000008',name:'enum_Test',identifier:'enum_Test',variableType:{type:'int'},isConstant:true,initialValue:ref(constantValue)};
 const category={library:owner,type:'Category',id:'10000006',name:'Fixture',items:[ref(tr),ref(unit),ref(constant)]};
 const script={library:owner,type:'CustomScript',id:'10000007',scriptCode:'include "OwnedDummy"'};
 const elements=[tr,unit,init,p,call,constant,constantValue,category,script],xml=serialize({id:owner,implicit:true,items:[script,category],elements:Object.fromEntries(elements.map(e=>[e.id,e]))});
 const nativeGui=new Map([['Ntve',{id:'Ntve',elements:{'ParamDef:20000001':{library:'Ntve',type:'ParamDef',id:'20000001',paramType:{type:'trigger'}}}}]]);
 const original='include "TriggerLibs/natives"\ninclude "OwnedDummy"\nconst int enum_Test=7;\ntrigger gt_Probe;\nunit gv_Hero=FromId(1);\n';
 const nativeExport='include "TriggerLibs/natives"\nconst int gv_enum_Test=7;\ntrigger gv_gt_Probe;\nunit gv_Hero;\nvoid InitGlobals(){gv_Hero=FromId(1);}\ninclude "OwnedDummy"\n';
 const closedContext={ownedSources:[{fileName:'OwnedDummy.galaxy',text:'// empty'}],externalSources:[{fileName:'TriggerLibs/natives.galaxy',text:'// native'}],includeEvidence:[{from:'MapScript.galaxy',include:'TriggerLibs/natives',path:'TriggerLibs/natives.galaxy',layerId:'ext'},{from:'MapScript.galaxy',include:'OwnedDummy',path:'OwnedDummy.galaxy',layerId:'own'}]};
 return {original,xml,nativeExport,nativeGui,closedContext};
}
test('reuses source include section, keeps typed GUI identities and prunes detached initial values',()=>{
 const f=fixture(),r=build(f),out=readOwnedGuiLibraries(r.triggerData,'Map').get('Map');
 assert.equal(r.proof.candidates.length,3);assert.equal(r.proof.newNativeDescriptions,0);assert.equal(r.proof.newCustomScriptSections,0);assert(!r.proof.wholeMapAccepted);
 assert(out.elements['Trigger:10000001'].disabled);assert(out.elements['Variable:10000002'].disabled);assert(!out.elements['Param:10000003']);
 assert.equal(out.elements['Param:10000004'].valueElement.id,'10000001');assert.equal(out.elements['Param:10000004'].parameterDef.id,'20000001');
 assert(out.elements['Variable:10000008'].disabled&&out.elements['Variable:10000008'].isConstant);assert(out.elements['Variable:10000008'].initialValue);
});
test('a used constant stays untouched and missing include evidence refuses the whole preview',()=>{
 const f=fixture(),r=build({...f,original:f.original+'int F(){return enum_Test;}'});
 assert(!r.proof.candidates.some(c=>c.sourceName==='enum_Test'));
 assert.throws(()=>build({...f,closedContext:{}}),/CONSTANT_CLOSURE_NOT_VERIFIED/u);
});
test('refuses existing GUI, changed includes, early observation and unselected side effects',()=>{
 const f=fixture();assert.throws(()=>build({...f,existingTriggerData:true}),/EXISTING_GUI/u);
 assert.throws(()=>build({...f,nativeExport:f.nativeExport.replace('OwnedDummy','OtherFile')}),/INCLUDE_ORDER/u);
 assert.throws(()=>build({...f,nativeExport:f.nativeExport.replace('gv_Hero=FromId(1);','Observe(gv_Hero);gv_Hero=FromId(1);')}),/USED_BEFORE/u);
 assert.throws(()=>build({...f,original:f.original+'int gv_Other=SideEffect();'}),/UNSELECTED_COMPUTED_INITIALIZER/u);
});
test('refuses unqualified reference formals and unsupported GUI references',()=>{
 const f=fixture(),nativeGui=structuredClone(f.nativeGui);nativeGui.get('Ntve').elements['ParamDef:20000001'].isReference=true;
 assert.throws(()=>build({...f,nativeGui}),/REFERENCE_OR_MULTIPLE_FORMAL/u);
 const g=readOwnedGuiLibraries(f.xml,'Map').get('Map');g.elements['Category:10000006'].items.push({type:'Variable',id:'10000001',library:'Map'});
 // A second category reference remains legal; non-category foreign uses do not.
 const bad={library:'Map',type:'Structure',id:'10000008',name:'Bad',variables:[{library:'Map',type:'Variable',id:'10000001'}]};g.elements['Structure:10000008']=bad;
 assert.throws(()=>build({...f,xml:serialize(g)}),/UNSUPPORTED_GUI_REFERENCE/u);
});

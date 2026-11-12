import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSourceGlobalMirrorCandidates as inspect} from './source-global-mirror-candidates.mjs';
const trigger={type:'Variable',library:'Map',id:'00000001',identifier:'gt_Test',name:'gt_Test',variableType:{type:'trigger'}};
const unit={type:'Variable',library:'Map',id:'00000002',identifier:'Hero',name:'Hero',variableType:{type:'unit'}};
const p={type:'Param',library:'Map',id:'00000003',variable:{library:'Map',type:'Variable',id:trigger.id},parameterDef:{library:'Ntve',type:'ParamDef',id:'00000004'}};
const original='native unit FromId(int i); trigger gt_Test; unit gv_Hero=FromId(1);';
const exported='native unit FromId(int i); trigger gv_gt_Test; unit gv_Hero; void InitGlobals(){gv_Hero=FromId(1);}';
const libraries=elements=>new Map([['Map',{id:'Map',items:elements.filter(x=>['Variable','Trigger'].includes(x.type)),elements:Object.fromEntries(elements.map(x=>[x.id,x]))}]]);
test('discovers exact typed storage and preserves GUI identity without authorizing edits',()=>{
 const r=inspect({original,exported,guiLibraries:libraries([trigger,unit,p])});assert.equal(r.candidates.length,2);assert(!r.guiPatchAuthorized&&!r.wholeMapAccepted);
 const t=r.candidates.find(x=>x.sourceName==='gt_Test');assert.equal(t.nativeEmittedName,'gv_gt_Test');assert.equal(t.references[0].parameterDef.id,'00000004');
 assert.equal(r.candidates.find(x=>x.sourceName==='gv_Hero').representation,'DISABLED_TYPED_VARIABLE_REFERENCE_ONLY');
});
test('changed initializer, a wrong GUI type, collisions and existing GUI are refused',()=>{
 assert.equal(inspect({original,exported:exported.replace('FromId(1);}','FromId(2);}'),guiLibraries:libraries([trigger,unit,p])}).candidates.length,1);
 const wrong={...trigger,variableType:{type:'unit'}};assert(!inspect({original,exported,guiLibraries:libraries([wrong,unit,p])}).candidates.some(x=>x.sourceName==='gt_Test'));
 const collision={type:'Trigger',library:'Map',id:'00000005',identifier:'Test'};assert(!inspect({original,exported,guiLibraries:libraries([trigger,unit,p,collision])}).candidates.some(x=>x.sourceName==='gt_Test'));
 assert.equal(inspect({original,exported,guiLibraries:libraries([trigger,unit,p]),existingTriggerData:true}).reason,'PRESERVE_EXISTING_GUI_STRUCTURE');
});
test('a matching local-only element cannot impersonate a global variable',()=>{
 const gui=libraries([trigger,unit,p]);gui.get('Map').items=[unit];const r=inspect({original,exported,guiLibraries:gui});
 assert(!r.candidates.some(x=>x.sourceName==='gt_Test'));assert(r.candidates.some(x=>x.sourceName==='gv_Hero'));
});

import {retainedNominalKind,verifyRetainedNominalDeclaration} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/bindings/retained-nominal-declarations.mjs';
import {excludeVerifiedSourcePrototypes} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/separate-source-prototypes.mjs';
import {passivePrimaryStorageKind,verifyPassivePrimarySourceStorage} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v490_retained_nominal_storage_2026-10-27/graph/872b2de8e963-34a636d18-cebb439d878b-82e195c30778-edcd5cff34b0-c7747b94dc78-retained-primary-storage.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGalaxyDocument} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e735afc2fd5b-galaxy-document.collections.mjs';
import {indexAuthoredScriptSections} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/c66c7d47c2a2-authored-script-sections.typedef-initializer-anchors.mjs';
import {indexAuthoredInitializerSchedule} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/34a5ff60e955-authored-initializer-schedule.indexed.mjs';
import {indexSourceFunctionDeclarations} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/b30dc84db5cf-source-function-declarations.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');

// Recompute from original source, not converter JSON. A phase is indivisible:
// every target's entire authored section must be in the selected source plan.
export function planAuthoredInitializerMetadata(input,sections){
 for(const section of sections)if(section.kind===passivePrimaryStorageKind)verifyPassivePrimarySourceStorage(input,section);
 for(const section of sections)if(section.kind===retainedNominalKind)verifyRetainedNominalDeclaration(input,section);
 sections=excludeVerifiedSourcePrototypes(input,sections).filter(s=>s.kind!==passivePrimaryStorageKind&&s.kind!==retainedNominalKind);
 if(!sections.length)return [];
 const documents=new Map(),indexes=new Map(),sources=new Map(),result=[];
 try{
  for(const [fileName,text]of [['primary.galaxy',input.script??''],['header.galaxy',input.header??'']]){
   if(!text.trim())continue;
   const doc=createGalaxyDocument({fileName,text});documents.set(fileName,doc);sources.set(fileName,text);
   if(sections.some(s=>s.fileName===fileName))indexes.set(fileName,indexAuthoredScriptSections({fileName,text,expectedSha256:sha(text)}));
  }
  const groups=indexSourceFunctionDeclarations(new Map([...documents].map(([name,doc])=>[name,doc.ast])));
  for(const [fileName,index]of indexes){
   const text=sources.get(fileName),selected=sections.filter(s=>s.fileName===fileName),selectedHashes=new Set();
   assert(!index.rejected.length,'AUTHORED_METADATA_SOURCE_SECTION_REJECTED');
   for(const section of selected){
    assert.equal(section.sourceSha256,index.sourceSha256,'AUTHORED_METADATA_SELECTED_SOURCE_CHANGED');
    const matches=index.sections.filter(s=>s.library===section.library&&s.sha256===section.sha256&&text.slice(s.start,s.end)===section.code);
    assert.equal(matches.length,1,'AUTHORED_METADATA_SELECTED_SECTION_CHANGED');selectedHashes.add(section.sha256);
   }
   const schedules=indexAuthoredInitializerSchedule({ast:documents.get(fileName).ast,text,index});
   for(const phase of schedules.phases){
    if(phase.status!=='EXACT_SOURCE_CALL_SCHEDULE'||!phase.calls.length)continue;
    const group=groups.get(phase.name);
    if(group?.status!=='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES'||group.body.fileName!==fileName||group.body.node.pos!==phase.start)continue;
    if(!phase.calls.every(call=>{
     const target=groups.get(call.name);
     return selectedHashes.has(call.sectionSha256)&&target?.status==='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES'&&target.body.fileName===fileName&&target.body.node.pos===call.targetStart;
    }))continue;
    result.push(phase);
   }
  }
  return result;
 }finally{for(const doc of documents.values())doc.dispose();}
}

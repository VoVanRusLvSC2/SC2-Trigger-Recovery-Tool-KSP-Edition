import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGalaxyDocument} from '../model/galaxy-document.collections.mjs';
import {indexAuthoredScriptSections} from '../model/authored-script-sections.typedef-initializer-anchors.mjs';
import {indexAuthoredInitializerSchedule} from '../model/authored-initializer-schedule.indexed.mjs';
import {indexSourceFunctionDeclarations} from '../model/source-function-declarations.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');

// Recompute from original source, not converter JSON. A phase is indivisible:
// every target's entire authored section must be in the selected source plan.
export function planAuthoredInitializerMetadata(input,sections){
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

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from "../model/galaxy-program-context.lexical-parameters.mjs";
import {partitionDeclarationViews} from "../model/source-ownership.mjs";
import {planSourceNominalPassiveDeclarations} from "../model/source-nominal-passive-declarations.typed.mjs";
const sha=s=>createHash('sha256').update(s).digest('hex');
export const retainedNominalKind='ORIGINAL_PASSIVE_NOMINAL_SOURCE_DECLARATIONS';

export function planRetainedNominalDeclarations(input){
 if(input.existingTriggerData?.trim()||!input.additionalScripts?.length)return [];
 const primaryFiles=[['header.galaxy',input.header??''],['primary.galaxy',input.script??'']].filter(([,text])=>text.trim()).map(([fileName,text])=>({fileName,text,sha256:sha(text)}));
 const ownedFiles=input.additionalScripts.map(f=>({fileName:f.originalPath??f.fileName,text:f.text,sha256:sha(f.text)}));
 const views=partitionDeclarationViews(ownedFiles,input.galaxyDeclarations??[]);assert.equal(views.conflicts.length,0,'RETAINED_NOMINAL_DECLARATION_REVISION_CONFLICT');
 const files=[...[...primaryFiles,...ownedFiles].map((f,i)=>({...f,sourceId:'nominal-owned:'+i,owned:true,contentSha256:f.sha256})),
  ...views.external.map((f,i)=>({...f,sourceId:'nominal-external:'+i,owned:false,contentSha256:sha(f.text)}))];
 const program=new GalaxyProgramContext(files,{files},sha,{checks:'binding'});let plan;
 try{plan=planSourceNominalPassiveDeclarations({program,primaryFiles,ownedFiles});}finally{program.dispose();}
 if(!plan.selectedDeclarations)return [];
 assert.equal(plan.status,'CANDIDATE_PASSIVE_DECLARATIONS_BOUND','RETAINED_NOMINAL_PASSIVE_PLAN_REFUSED: '+JSON.stringify([...plan.failures,...plan.headerConsumers]));
 return plan.units.map(unit=>({...unit,kind:retainedNominalKind,library:input.libraryId??'Map',label:unit.declarations.map(d=>d.name).join(', '),
  functions:[],allFunctionNames:[],privateDeclarations:unit.declarations.map(d=>({kind:d.kind,name:d.name})),
  declarations:unit.declarations.map(d=>({kind:d.kind,name:d.name,start:d.start,end:d.end,sha256:d.declarationSha256})),
  passiveDeclarationOnly:true,sourceNominalDeclarations:true,closedMixedUnit:true,newRuntimeFunctions:0,newRuntimeInitializationActions:0}));
}

/** A fresh input-bound replay authorizes original declaration bytes only. */
export function verifyRetainedNominalDeclaration(input,section){
 assert.equal(section.kind,retainedNominalKind);
 const expected=planRetainedNominalDeclarations(input).filter(s=>s.fileName===section.fileName&&s.start===section.start&&s.end===section.end);
 assert.equal(expected.length,1,'RETAINED_NOMINAL_ORIGINAL_UNIT_REQUIRED');
 assert.deepEqual(section,expected[0],'RETAINED_NOMINAL_UNIT_CHANGED');
 return {sourceSha256:section.sourceSha256,sha256:section.sha256,fileName:section.fileName,start:section.start,end:section.end,declarations:section.declarations.length,newRuntimeFunctions:0,newInitializationActions:0};
}
export function verifyRetainedNominalGui(input,section,libraries){
 const proof=verifyRetainedNominalDeclaration(input,section),library=libraries.get(section.library);assert(library,'RETAINED_NOMINAL_GUI_LIBRARY');
 const lf=s=>s.replace(/\r\n?/gu,'\n'),matches=[...new Set(Object.values(library.elements))].filter(e=>e.type==='CustomScript'&&typeof e.scriptCode==='string'&&lf(e.scriptCode)===lf(section.code));
 assert.equal(matches.length,1,'RETAINED_NOMINAL_GUI_UNIT_MISSING_OR_DUPLICATED');
 const e=matches[0];assert(e.library===section.library&&!e.disabled&&!e.flags?.length&&!e.initFunc&&e.expressionCode===undefined,'RETAINED_NOMINAL_GUI_EXECUTABLE_METADATA');
 return {...proof,library:e.library,type:e.type,id:e.id};
}

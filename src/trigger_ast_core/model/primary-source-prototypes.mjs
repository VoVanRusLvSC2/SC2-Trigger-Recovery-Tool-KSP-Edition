import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openVerifiedSourceBindingProgram} from './verified-source-binding-program.lexical-parameters.mjs';
import {logicalSourcePath} from './source-ownership.mjs';
import {indexSourceFunctionFamilies,requireRetainedSourceFunctionFamily} from './source-function-families.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
export const primarySourcePrototypeKind='ORIGINAL_PRIMARY_SOURCE_PROTOTYPES';

/** Retain exact ORIGINAL forward declarations for unchanged included bodies.
 * No declaration for a primary GUI body, inferred API, native or new callable
 * is synthesized. Source files and runtime bodies remain unchanged. */
export function planPrimarySourcePrototypes(input){
 if(input.existingTriggerData?.trim()||!input.additionalScripts?.length)return [];
 const header=input.header??'',script=input.script??'',text=[header,script].filter(Boolean).join('\n');
 const opened=openVerifiedSourceBindingProgram(text,{ownedSources:input.additionalScripts,externalSources:input.galaxyDeclarations??[],includeEvidence:input.includeEvidence});
 assert(opened.program,'SOURCE_PROTOTYPE_COMPLETE_BINDINGS_REQUIRED: '+opened.reason);
 try{
  const {program}=opened,root=program.documents.get('mapscript.galaxy');assert(root,'SOURCE_PROTOTYPE_ROOT_REQUIRED');
  const index=indexSourceFunctionFamilies(program),owned=new Set(input.additionalScripts.map(f=>logicalSourcePath(f.originalPath??f.fileName))),selected=new Map(),result=[];
  for(const node of root.statements){
   if(node.kind!==K.FunctionDeclaration||node.body||node.modifiers?.some(m=>m.kind===K.NativeKeyword))continue;
   const {family}=index.at(node)??{};assert(family,'SOURCE_PROTOTYPE_FAMILY_REQUIRED');
   // A normal GUI function owns its own native-generated declaration. This
   // path applies only to families whose actual body stays in an owned file.
   if(!family.declarations.some(r=>r.node.body&&owned.has(r.location.sourceFile))){
    const otherOwnedBody=[...index.families.values()].some(f=>f.name===family.name&&f.declarations.some(r=>r.node.body&&owned.has(r.location.sourceFile)));
    assert(!otherOwnedBody||family.declarations.some(r=>r.node.body),'SOURCE_PROTOTYPE_STATIC_OWNER_MISMATCH');
    continue;
   }
   selected.set(node,requireRetainedSourceFunctionFamily(family,owned));
  }
  for(const [fileName,source,offset]of [['header.galaxy',header,0],['primary.galaxy',script,header?header.length+1:0]]){
   if(!source)continue;let group=[];
   const flush=()=>{
    if(!group.length)return;const start=group[0].pos-offset,end=group.at(-1).end-offset,code=source.slice(start,end);
    result.push({kind:primarySourcePrototypeKind,library:input.libraryId??'Map',fileName,start,end,sourceSha256:sha(source),sha256:sha(code),code,label:'Source declarations',
     declarations:group.map(n=>({kind:n.kind,name:n.name.name,start:n.pos-offset,end:n.end-offset,sha256:sha(source.slice(n.pos-offset,n.end-offset))})),
     functions:[],allFunctionNames:[],privateDeclarations:[],closedMixedUnit:false,passiveDeclarationOnly:true,sourcePrototypeDeclarations:true,
     families:group.map(n=>selected.get(n)),newRuntimeFunctions:0,newRuntimeInitializationActions:0});group=[];
   };
   for(const node of root.statements.filter(n=>n.pos>=offset&&n.end<=offset+source.length)){if(selected.has(node))group.push(node);else flush();}flush();
  }
  return result;
 }finally{opened.dispose();}
}

// Reconstruct origin/ABI/owner from the sealed source, not serialized receipts.
// Actual GUI may contain only those exact bodyless declarations, without any
// flags, expression code, disabled state or initialization hook.
export function verifyPrimarySourcePrototypeGui(input,sections,libraries){
 const selected=sections.filter(s=>s.kind===primarySourcePrototypeKind);if(!selected.length)return [];
 const original=planPrimarySourcePrototypes(input),xml=s=>s.replace(/\r\n?/gu,'\n'),records=[];
 for(const section of selected){
  const candidates=original.filter(s=>s.library===section.library&&s.fileName===section.fileName&&s.start===section.start&&s.end===section.end);
  assert.equal(candidates.length,1,'SOURCE_PROTOTYPE_ORIGIN_REQUIRED');assert.deepEqual(section,candidates[0],'SOURCE_PROTOTYPE_ORIGIN_CHANGED');
  const library=libraries.get(section.library);assert(library,'SOURCE_PROTOTYPE_GUI_LIBRARY');
  const matches=[...new Set(Object.values(library.elements))].filter(e=>e.type==='CustomScript'&&typeof e.scriptCode==='string'&&xml(e.scriptCode)===xml(section.code));
  assert.equal(matches.length,1,'SOURCE_PROTOTYPE_GUI_MISSING_OR_DUPLICATED');const e=matches[0];
  assert(e.library===section.library&&!e.disabled&&!e.flags?.length&&!e.initFunc&&e.expressionCode===undefined,'SOURCE_PROTOTYPE_GUI_EXECUTABLE_METADATA');
  records.push({library:e.library,type:e.type,id:e.id,sourceSha256:section.sourceSha256,sectionSha256:section.sha256,declarations:section.declarations.length,families:section.families,newRuntimeFunctions:0,newInitializationActions:0});
 }
 return records;
}

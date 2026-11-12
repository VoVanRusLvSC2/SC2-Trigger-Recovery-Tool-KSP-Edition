// GUI preparation must not rewrite original authored runtime bodies. Replay
// entire closed source components before the GUI stage, with the same qualified
// binding proof before and after. This is not oracle normalization or fallback.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {analyzeClosedAuthoredUnits} from '../analysis/closed-authored-units.qualified.mjs';
import {indexAuthoredScriptSections} from '../model/authored-script-sections.typedef-initializer-anchors.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

const sha=s=>createHash('sha256').update(s).digest('hex');
const key=u=>JSON.stringify([u.fileName,u.library,u.label]);
const simple=t=>/^[_A-Za-z]\w*$/u.test(t);
const abi=d=>({name:d.name,kind:d.kind,...(d.kind===K.FunctionDeclaration?
 {returnType:d.returnType,parameters:d.parameters,hasBody:d.hasBody}:{type:d.type})});
const supported=u=>u.declarations.filter(d=>u.publicCalls.some(c=>c.name===d.name))
 .every(d=>d.kind===K.FunctionDeclaration&&d.hasBody&&simple(d.returnType)&&d.parameters.every(p=>simple(p.type)));

export function restoreClosedAuthoredUnits({sources,processedSources,declarationSources=[],libraryId='Map',preserveAuthoredCode=true,existingTriggerData=''}){
 const initial={kind:'RESTORE_ORIGINAL_CLOSED_AUTHORED_COMPONENTS',restored:[],benchmarkChanged:false,
  newNative:0,newRuntimeFunctions:0,semanticEquivalenceProved:false,sourceArchiveChanged:false};
 if(!preserveAuthoredCode||existingTriggerData.trim()||!sources.some(s=>/^\/\/ Custom Script: \S/mu.test(s.text)))
  return {files:processedSources,proof:{...initial,applicable:false}};
 for(const s of sources){assert.equal(typeof s.sha256,'string','AUTHORED_ORIGINAL_SHA_REQUIRED');assert.equal(sha(s.text),s.sha256,'AUTHORED_ORIGINAL_SHA_CHANGED');}
 assert.equal(new Set(sources.map(s=>s.fileName)).size,sources.length,'AUTHORED_SOURCE_FILE_AMBIGUOUS');
 assert.deepEqual(processedSources.map(s=>s.fileName),sources.map(s=>s.fileName),'AUTHORED_SOURCE_FILE_COVERAGE');
 const original=analyzeClosedAuthoredUnits({sources,declarationSources,libraryId});
 const selected=original.components.filter(c=>c.closurePassed&&c.units.every(id=>supported(original.units[id])));
 const units=selected.flatMap(c=>c.units.map(id=>original.units[id]));
 if(!units.length)return {files:processedSources,proof:{...initial,applicable:true,originalComponents:0,exactOriginalBodies:false}};
 const originalByKey=new Map();
 for(const u of original.units){const rows=originalByKey.get(key(u))??[];rows.push(u);originalByKey.set(key(u),rows);}
 const edits=new Map(),records=[];
 for(const source of processedSources){
  const index=indexAuthoredScriptSections({fileName:source.fileName,text:source.text,expectedSha256:sha(source.text)});
  assert(!index.rejected.length,'AUTHORED_PREPARED_SECTION_INDEX_REJECTED');
  const currentByKey=new Map();
  for(const s of index.sections){const k=key({...s,fileName:source.fileName}),rows=currentByKey.get(k)??[];rows.push(s);currentByKey.set(k,rows);}
  for(const u of units.filter(u=>u.fileName===source.fileName)){
   assert.equal(originalByKey.get(key(u)).length,1,'AUTHORED_ORIGINAL_SECTION_AMBIGUOUS');
   const matches=currentByKey.get(key(u))??[];
   assert.equal(matches.length,1,'AUTHORED_PREPARED_SECTION_MISSING_OR_AMBIGUOUS');
   const s=matches[0];
   assert.deepEqual(s.declarations.map(d=>[d.kind,d.name]),u.declarations.map(d=>[d.kind,d.name]),'AUTHORED_PREPARED_MEMBER_IDENTITY_CHANGED');
   const rows=edits.get(source.fileName)??[];rows.push({start:s.start,end:s.end,text:u.sourceCode});edits.set(source.fileName,rows);
   records.push({fileName:source.fileName,library:u.library,label:u.label,originalSourceSha256:u.sourceSha256,
    originalSectionSha256:u.sectionSha256,preparedSectionSha256:s.sha256,changed:s.sha256!==u.sectionSha256});
  }
 }
 const files=processedSources.map(s=>{
  let text=s.text,previous=s.text.length;
  for(const e of (edits.get(s.fileName)??[]).sort((a,b)=>b.start-a.start)){
   assert(e.end<=previous&&e.start<=e.end,'AUTHORED_SECTION_EDIT_OVERLAP');previous=e.start;
   text=text.slice(0,e.start)+e.text+text.slice(e.end);
  }
  return {...s,text,sha256:sha(text)};
 });
 const replay=analyzeClosedAuthoredUnits({sources:files,declarationSources,libraryId});
 for(const component of selected){
  const expected=component.units.map(id=>original.units[id]),actual=expected.map(u=>{
   const found=replay.units.filter(r=>key(r)===key(u));assert.equal(found.length,1,'AUTHORED_REPLAY_SECTION_IDENTITY');
   const r=found[0];assert.equal(r.sectionSha256,u.sectionSha256,'AUTHORED_ORIGINAL_SECTION_NOT_EXACT');
   assert.deepEqual(r.declarations.map(abi),u.declarations.map(abi),'AUTHORED_REPLAY_DECLARATION_ABI');return r;
  });
  const actualIds=new Set(actual.map(u=>u.id));
  const joined=replay.components.filter(c=>c.units.some(id=>actualIds.has(id)));
  assert(joined.length===1&&joined[0].closurePassed&&joined[0].units.length===actualIds.size&&joined[0].units.every(id=>actualIds.has(id)),
   'AUTHORED_REPLAY_COMPONENT_INTERFACE_NOT_CLOSED');
 }
 return {files,proof:{...initial,applicable:true,restored:records,originalComponents:selected.length,
  originalSources:sources.map(s=>({fileName:s.fileName,sha256:s.sha256})),
  preparedSources:processedSources.map(s=>({fileName:s.fileName,sha256:sha(s.text)})),
  outputSources:files.map(s=>({fileName:s.fileName,sha256:s.sha256})),
  exactOriginalBodies:true,qualifiedExternalInterfaces:true}};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {qualifySourceNominalReturnRoles as qualify} from './retained-nominal-gui-interfaces.roles.mjs';
import {readOwnedGuiLibraries} from '../verification/read-owned-gui-libraries.mjs';
import {serializeTriggerLibraryCanonical} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/trigger-xml.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),d=new URL('../../sdk_gui_closure_20261019/',import.meta.url);
const descriptor=JSON.parse(readFileSync(new URL('NOMINAL_CONVERTER_NATIVE_PROBES_R2777.json',d),'utf8'));
const audit=JSON.parse(readFileSync(new URL('NOMINAL_INLINE_NATIVE_AUDIT_R2782.json',d),'utf8'));
const config=JSON.parse(readFileSync(new URL('PROBES_SOURCE_CONFIG_R2717.json',d),'utf8')),prep=JSON.parse(readFileSync(config.preparationResult,'utf8'));
const declarations=prep.declarationInputs.map(f=>{const text=readFileSync(f.path,'utf8');assert.equal(sha(text),f.sha256);return {fileName:f.sourceLabel,text};});
const nativeXml=readFileSync(audit.metadata.path,'utf8');assert.equal(sha(nativeXml),audit.metadata.sha256);
function fixture(i=0){const row=descriptor.rows[i],script=readFileSync(row.original.path,'utf8'),text=readFileSync(row.phase.path,'utf8'),xml=readFileSync(row.xml.path,'utf8');
 return {xml,input:{libraryId:'Map',script,header:'',guiRecoveryMode:'preserve-source',additionalScripts:[{fileName:'Types.galaxy',originalPath:'Types.galaxy',text}],galaxyDeclarations:declarations,dependencyLibraries:[{triggerData:nativeXml}],includeEvidence:[...prep.includeEvidence,{from:'MapScript.galaxy',include:'Types',path:'Types.galaxy',layerId:'fixture-original'}]}};}
function change(f,edit){const lib=readOwnedGuiLibraries(f.xml,'Map').get('Map');edit(lib);return serializeTriggerLibraryCanonical(lib);}
const nominal=lib=>Object.values(lib.elements).find(e=>e.type==='FunctionDef'&&e.returnType?.type==='struct');
test('both real Editor-qualified nominal projection shapes are reconstructed from original sources and the final GUI',()=>{
 for(const i of [0,1]){const f=fixture(i),r=qualify({...f,library:'Map'});assert.equal(r.qualified.length,1);assert.equal(r.refused.length,0);assert.equal(r.constructorReceiptsUsed,false);}
});
test('a normal function returning a struct is never admitted as an inline source path',()=>{
 const f=fixture(),xml=change(f,lib=>{const e=nominal(lib);e.flags=['Call'];delete e.scriptCode;e.actions=[];});const r=qualify({input:f.input,xml,library:'Map'});assert.equal(r.qualified.length,0);
});
test('an arbitrary statement or wrong nominal result owner cannot acquire the source role',()=>{
 for(const mutate of [e=>{e.scriptCode+='; Evil();';},e=>{e.returnType.typeElement={...e.returnType.typeElement,library:'Foreign'};}]){
  const f=fixture(),xml=change(f,lib=>mutate(nominal(lib))),r=qualify({input:f.input,xml,library:'Map'});assert.equal(r.qualified.length,0);assert.equal(r.refused.length,1);
 }
});
test('a reference-only source nominal type must stay disabled and cannot emit a duplicate runtime declaration',()=>{
 const f=fixture(),xml=change(f,lib=>{const e=nominal(lib),type=Object.values(lib.elements).find(n=>n.type==='Structure'&&n.id===e.returnType.typeElement.id);type.disabled=false;});
 assert.equal(qualify({input:f.input,xml,library:'Map'}).qualified.length,0);
});
test('full-gui mode and changed loaded metadata do not inherit this preserve-source capability',()=>{
 const f=fixture();assert.equal(qualify({input:{...f.input,guiRecoveryMode:'full-gui'},xml:f.xml,library:'Map'}).qualified.length,0);
 const r=qualify({input:{...f.input,dependencyLibraries:[{triggerData:nativeXml+'\n'}]},xml:f.xml,library:'Map'});assert.equal(r.qualified.length,0);assert.equal(r.reason,'NATIVE_METADATA_NOT_QUALIFIED');
});

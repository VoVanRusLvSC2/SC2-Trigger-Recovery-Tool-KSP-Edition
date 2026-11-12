import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lexical-parameters.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const w=path.resolve(import.meta.dirname,'../..'),base=path.join(w,'map_global_repair_v499_source_nominal_return_roles_2026-10-27/graph/841773ffea1c-31-763456b262001c-7b86947b52c4c7-84fba1511aa5-c37b48b69f98-ae402a97576c-g2t-structured.mjs');
const manifest=process.env.SC2_TEST_RUNTIME&&JSON.parse(readFileSync(path.join(process.env.SC2_TEST_RUNTIME,'FORK_MANIFEST.json'),'utf8'));
const selected=manifest?.changedImportAncestors.find(r=>r.source.toLowerCase()===base.toLowerCase())?.path??base;
const moduleText=readFileSync(selected,'utf8'),helperUri=moduleText.match(/from '(file:[^']+retained-nominal-gui-interfaces[^']+)'/u)?.[1];assert(helperUri);
const {structuredNode}=await import(pathToFileURL(selected));
const {withRetainedNominalInterfaces,withNominalGenerationProgram,primeRetainedNominalInterfaces,isRetainedNominalInterfaceElement}=await import(helperUri);
const sha=s=>createHash('sha256').update(s).digest('hex');
const source='struct gs_External{fixed raw;};void Build(structref<gs_External> target,fixed value){target.raw=value;}';
const root='include "owned"\nstruct gs_Box{gs_External lv_value;};gs_Box gv_box;void Run(){Build(gv_box.lv_value,1);}';
async function run(operation){
 const owned=[{fileName:'owned.galaxy',text:source}],files=[{fileName:'primary.galaxy',text:root},...owned].map(f=>({...f,sourceId:f.fileName,contentSha256:sha(f.text),owned:true}));
 const p=new GalaxyProgramContext(files,{files},sha,{checks:'binding'});for(const ast of p.documents.values())p.attachOriginal(ast);
 const input={libraryId:'Map',script:root,additionalScripts:owned,galaxyDeclarations:owned,includeEvidence:[{from:'MapScript.galaxy',include:'owned',path:'owned.galaxy',layerId:'fixture-original'}]};
 const ctx={libId:'Map',elements:{},funcNameToFuncDef:new Map(),structureByGalaxyTypeName:new Map(),localVarByGalaxyName:new Map(),globalVarByGalaxyName:new Map(),paramRefByGalaxyName:new Map(),galaxyConstToPreset:new Map(),structureMemberByKey:new Map(),roleToSubFuncType:new Map(),templateDefinitions:[],structuredTemplates:new Map(),nativeLibrary:{id:'Ntve',elements:{},elementsByType:{FunctionDef:{},ParamDef:{}}}};
 let id=0xD4000000;const allocate=()=>((id++).toString(16).toUpperCase());
 try{return await withRetainedNominalInterfaces(input,{preserveAuthoredCode:true},owned,()=>withNominalGenerationProgram(p,['primary.galaxy'],()=>{
  primeRetainedNominalInterfaces({program:p,libraryId:'Map',elements:ctx.elements,structuresByName:ctx.structureByGalaxyTypeName,functionDefsByName:ctx.funcNameToFuncDef,allocate});
  let call;const walk=n=>{if(n.kind===K.CallExpression&&n.expression.name==='Build')call=n;forEachChild(n,walk);};walk(p.documents.get('primary.galaxy'));assert(call);
  return operation({ctx,call,definition:ctx.funcNameToFuncDef.get('Build')});
 }));}finally{p.dispose();}
}
test('a typed source call wins even when the template snapshot predates its materialization',()=>run(({ctx,call,definition})=>{
 assert(isRetainedNominalInterfaceElement(definition));assert.equal(ctx.templateDefinitions.length,0);
 const ref=structuredNode(call.parent,false,ctx),actual=ctx.elements[ref.id];
 assert.equal(actual.functionDef.id,definition.id,'retain the original structref/fixed ABI instead of synthesizing argument types');
 assert.equal(Object.values(ctx.elements).filter(e=>e.type==='FunctionDef'&&e.scriptCode?.startsWith('Build(')).length,1);
 const formal=ctx.elements[definition.parameters[0].id];assert.equal(formal.isReference,true);assert.equal(formal.paramType.type,'struct');
 assert.equal(ctx.elements[definition.parameters[1].id].paramType.type,'fixed');
}));
test('a changed source reference formal cannot acquire precedence from an old receipt',()=>run(({ctx,definition})=>{
 ctx.elements[definition.parameters[0].id].isReference=false;assert.equal(isRetainedNominalInterfaceElement(definition),false);
}));
test('a foreign owner cannot acquire the original source-call authority',()=>run(({definition})=>{
 definition.library='Foreign';assert.equal(isRetainedNominalInterfaceElement(definition),false);
}));

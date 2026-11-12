import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lexical-parameters.mjs';
import {readOwnedGuiLibraries} from '../verification/read-owned-gui-libraries.mjs';
import {serializeTriggerLibraryCanonical} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/trigger-xml.js';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {withRetainedNominalInterfaces as originalScope,withNominalGenerationProgram as generationScope,primeRetainedNominalInterfaces as prime,
 lowerRetainedNominalRead as lower,registerRetainedNominalInterfaces as register,isRetainedNominalInterfaceElement as qualified} from './retained-nominal-gui-interfaces.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const source='struct gs_External{fixed raw;};void Build(structref<gs_External> target,fixed value){target.raw=value;}';
const root='include "owned"\nstruct gs_Box{gs_External lv_value;};gs_Box gv_box;void Read(fixed value){}void Run(){Build(gv_box.lv_value,1.0);Read(gv_box.lv_value.raw);}';
const input={libraryId:'Map',script:root,additionalScripts:[{fileName:'owned.galaxy',text:source}],galaxyDeclarations:[{fileName:'owned.galaxy',text:source}],includeEvidence:[{from:'MapScript.galaxy',include:'owned',path:'owned.galaxy',layerId:'fixture-original'}]};
function createContext(text=root,owned=source){
 const files=[{fileName:'primary.galaxy',text},{fileName:'owned.galaxy',text:owned}].map((f,i)=>({...f,sourceId:String(i),contentSha256:sha(f.text),owned:true}));
 const program=new GalaxyProgramContext(files,{files},sha,{checks:'binding'});for(const ast of program.documents.values())program.attachOriginal(ast);
 let id=0xD3000000;const allocated=new Map(),allocate=()=>((id++).toString(16).toUpperCase()),ref=e=>({type:e.type,id:e.id,library:e.library});
 const ctx={libId:'Map',elements:{},funcNameToFuncDef:new Map(),structureByGalaxyTypeName:new Map()};
 const make=(type,data)=>{const e={type,id:allocate(),library:'Map',...data};ctx.elements[e.id]=e;return ref(e);};
 const helpers={idFromKey:key=>{if(!allocated.has(key))allocated.set(key,allocate());return allocated.get(key);},mkFCRef:data=>make('FunctionCall',data),mkParamRef:data=>make('Param',data),exprToParamRef:()=>{throw Error('INDEX_TRANSLATION_NOT_USED_BY_THIS_UNIT');}};
 const ast=program.documents.get('primary.galaxy'),matches=predicate=>{const found=[];const walk=n=>{if(predicate(n))found.push(n);forEachChild(n,walk);};walk(ast);return found;};
 return {program,ctx,helpers,allocate,matches};
}
async function run(operation,text=root,owned=source){const c=createContext(text,owned),files=[{fileName:'owned.galaxy',text:owned}];try{return await originalScope({...input,script:text,additionalScripts:files,galaxyDeclarations:files},{preserveAuthoredCode:true},files,()=>generationScope(c.program,['primary.galaxy'],()=>operation(c)));}finally{c.program.dispose();}}
test('the actual source structref ABI becomes a body-free typed invocation template',()=>run(c=>{
 prime({program:c.program,primaryNames:['primary.galaxy'],libraryId:'Map',elements:c.ctx.elements,structuresByName:c.ctx.structureByGalaxyTypeName,functionDefsByName:c.ctx.funcNameToFuncDef,allocate:c.allocate});
 const fn=c.ctx.funcNameToFuncDef.get('Build');assert(fn);assert(qualified(fn));assert.deepEqual(fn.flags,['Action','Operator','NoScriptPrefix']);
 const p=c.ctx.elements[fn.parameters[0].id];assert.equal(p.isReference,true);assert.equal(p.paramType.type,'struct');
 const type=c.ctx.elements[p.paramType.typeElement.id];assert(type.disabled);assert.equal(type.identifier,'External');assert.equal(fn.actions,undefined);assert(!fn.flags.includes('Native'));
}));
test('a reference operand preserves its complete original lvalue and its nominal GUI return type',()=>run(c=>{
 const arg=c.matches(n=>n.kind===K.CallExpression&&n.expression.name==='Build')[0].arguments[0];
 const param=lower(arg,c.ctx,undefined,c.helpers),call=c.ctx.elements[c.ctx.elements[param.id].functionCall.id],fn=c.ctx.elements[call.functionDef.id];
 assert.equal(fn.scriptCode,'gv_box.lv_value');assert.equal(fn.returnType.type,'struct');assert(qualified(fn));assert.equal(c.ctx.elements[fn.returnType.typeElement.id].identifier,'External');
}));
test('a scalar field keeps its declared fixed type instead of a guessed integer carrier',()=>run(c=>{
 const expression=c.matches(n=>n.kind===K.PropertyAccessExpression&&n.name.name==='raw')[0],param=lower(expression,c.ctx,undefined,c.helpers);
 const call=c.ctx.elements[c.ctx.elements[param.id].functionCall.id],fn=c.ctx.elements[call.functionDef.id];assert.equal(fn.returnType.type,'fixed');assert.equal(fn.scriptCode,'gv_box.lv_value.raw');assert(qualified(fn));
}));
test('whole original storage is a nominal operand and cannot become an integer getter',()=>run(c=>{
 const variable=c.matches(n=>n.kind===K.Identifier&&n.name==='gv_box'&&n.parent?.kind===K.PropertyAccessExpression)[0],param=lower(variable,c.ctx,undefined,c.helpers);
 const call=c.ctx.elements[c.ctx.elements[param.id].functionCall.id],fn=c.ctx.elements[call.functionDef.id];assert.equal(fn.returnType.type,'struct');assert.equal(c.ctx.elements[fn.returnType.typeElement.id].identifier,'Box');
 fn.returnType={type:'int'};register(c.ctx.elements,'Map');assert.equal(qualified(fn),false);
}));
test('a local variable with the same name never receives the global source binding',()=>run(c=>{
 const local=c.matches(n=>n.kind===K.Identifier&&n.name==='gv_box'&&n.parent?.kind===K.CallExpression&&n.parent.expression.name==='ReadInt')[0];assert(local);assert.equal(lower(local,c.ctx,undefined,c.helpers),undefined);
},'include "owned"\nstruct gs_Box{gs_External lv_value;};gs_Box gv_box;void ReadInt(int value){}void Run(){int gv_box;ReadInt(gv_box);}'));
test('fresh XML replay uses exact implicit owner/type/id and rejects changed reference formals',()=>run(async c=>{
 prime({program:c.program,primaryNames:['primary.galaxy'],libraryId:'Map',elements:c.ctx.elements,structuresByName:c.ctx.structureByGalaxyTypeName,functionDefsByName:c.ctx.funcNameToFuncDef,allocate:c.allocate});
 const xml=serializeTriggerLibraryCanonical({id:'Map',implicit:true,items:Object.values(c.ctx.elements).filter(e=>['Structure','FunctionDef'].includes(e.type)),elements:c.ctx.elements});
 const parsed=readOwnedGuiLibraries(xml,'Map').get('Map'),fn=Object.values(parsed.elements).find(e=>e.type==='FunctionDef');register(parsed.elements,'Map');assert(qualified(fn));
 const p=Object.values(parsed.elements).find(e=>e.type==='ParamDef'&&e.isReference);p.isReference=false;register(parsed.elements,'Map');assert.equal(qualified(fn),false);
}));
test('new Native/body metadata is never accepted as a source invocation',()=>run(c=>{
 prime({program:c.program,primaryNames:['primary.galaxy'],libraryId:'Map',elements:c.ctx.elements,structuresByName:c.ctx.structureByGalaxyTypeName,functionDefsByName:c.ctx.funcNameToFuncDef,allocate:c.allocate});
 const fn=c.ctx.funcNameToFuncDef.get('Build');fn.flags.push('Native');assert.equal(qualified(fn),false);fn.flags.pop();fn.actions=[{library:'Map',type:'FunctionCall',id:'FFFFFFFF'}];assert.equal(qualified(fn),false);
}));
test('source typedefs preserve scalar and structref ABI rather than losing their underlying types',()=>run(c=>{
 prime({program:c.program,primaryNames:['primary.galaxy'],libraryId:'Map',elements:c.ctx.elements,structuresByName:c.ctx.structureByGalaxyTypeName,functionDefsByName:c.ctx.funcNameToFuncDef,allocate:c.allocate});
 const fn=c.ctx.funcNameToFuncDef.get('Build');assert(qualified(fn));assert.equal(c.ctx.elements[fn.parameters[0].id].isReference,true);assert.equal(c.ctx.elements[fn.parameters[1].id].paramType.type,'fixed');
},root,'struct gs_External{fixed raw;};typedef fixed Amount;typedef structref<gs_External> Target;void Build(Target target,Amount value){target.raw=value;}'));
test('a dynamic index is forwarded once as the same semantic AST node',()=>run(c=>{
 const call=c.matches(n=>n.kind===K.CallExpression&&n.expression.name==='Build')[0],index=call.arguments[0].argumentExpression;let forwarded=0;
 c.helpers.exprToParamRef=(actual,ctx,pd)=>{assert.equal(actual,index);forwarded++;return c.helpers.mkParamRef({parameterDef:pd,valueType:{type:'int'},value:'0'});};
 const result=lower(call.arguments[0],c.ctx,undefined,c.helpers);assert(result);assert.equal(forwarded,1);
 const fc=c.ctx.elements[c.ctx.elements[result.id].functionCall.id],fn=c.ctx.elements[fc.functionDef.id];assert.equal(fn.scriptCode,'gv_box.lv_items[#PARAM(index0)]');assert(qualified(fn));
},'include "owned"\nstruct gs_Box{gs_External[4] lv_items;};gs_Box gv_box;int Next(){return 0;}void Run(){Build(gv_box.lv_items[Next()],1.0);}'));
test('a source interface proof expires when its original source operation closes',async()=>{
 let fn;await run(c=>{prime({program:c.program,primaryNames:['primary.galaxy'],libraryId:'Map',elements:c.ctx.elements,structuresByName:c.ctx.structureByGalaxyTypeName,functionDefsByName:c.ctx.funcNameToFuncDef,allocate:c.allocate});fn=c.ctx.funcNameToFuncDef.get('Build');assert(qualified(fn));});assert.equal(qualified(fn),false);
});

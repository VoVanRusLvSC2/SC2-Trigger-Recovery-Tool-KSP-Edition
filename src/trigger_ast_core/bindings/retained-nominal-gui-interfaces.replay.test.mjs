import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lexical-parameters.mjs';
import {readOwnedGuiLibraries} from '../verification/read-owned-gui-libraries.mjs';
import {serializeTriggerLibraryCanonical} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/trigger-xml.js';
import {parseTriggerXmlSync} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/sax-reader.js';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {withRetainedNominalInterfaces as originalScope,withNominalGenerationProgram as generationScope,primeRetainedNominalInterfaces as prime,
 lowerRetainedNominalRead as lower,lowerRetainedNominalWrite as write,registerRetainedNominalInterfaces as register,isRetainedNominalInterfaceElement as qualified,replayRetainedNominalInterfaces as replay} from './retained-nominal-gui-interfaces.replay.mjs';
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

const arraySource='struct gs_External{fixed[2] values;};void Build(structref<gs_External> target,fixed value){target.values[0]=value;}';
const localRoot='include "owned"\nint Next(){return 0;}fixed Amount(){return 1.0;}void Read(fixed value){}void Run(){gs_External lv_local;lv_local.values[Next()]+=Amount();Read(lv_local.values[Next()]);}';
test('a local source record array read retains its original field name, fixed leaf and single index evaluation',()=>run(c=>{
 const expression=c.matches(n=>n.kind===K.CallExpression&&n.expression.name==='Read')[0].arguments[0],seen=[];
 c.helpers.exprToParamRef=(node,ctx,formal)=>{seen.push(node);return c.helpers.mkParamRef({parameterDef:formal,value:'fixture',valueType:{type:'string'}});};
 const param=lower(expression,c.ctx,undefined,c.helpers),fc=c.ctx.elements[c.ctx.elements[param.id].functionCall.id],fn=c.ctx.elements[fc.functionDef.id];
 assert(qualified(fn));assert.equal(fn.returnType.type,'fixed');assert.equal(fn.scriptCode,'#PARAM(target).values[#PARAM(index0)]');
 assert.equal(seen.length,2);assert.equal(seen[0],expression.expression.expression);assert.equal(seen[1],expression.argumentExpression);
},localRoot,arraySource));

test('a source field assignment emits one inline typed GUI action and forwards each original operand once',()=>run(c=>{
 const expression=c.matches(n=>n.kind===K.BinaryExpression&&n.operatorToken?.kind===K.PlusEqualsToken)[0],seen=[];assert(expression);
 c.helpers.exprToParamRef=(node,ctx,formal)=>{seen.push(node);return c.helpers.mkParamRef({parameterDef:formal,value:'fixture',valueType:{type:'string'}});};
 const call=write(expression,c.ctx,undefined,c.helpers),fc=c.ctx.elements[call.id],fn=c.ctx.elements[fc.functionDef.id];assert(qualified(fn));
 assert.equal(fn.scriptCode,'#PARAM(target).values[#PARAM(index0)] += #PARAM(value);');assert.equal(fn.returnType.type,'void');assert(!fn.flags.includes('Native')&&!fn.actions);
 assert.deepEqual(seen,[expression.left.expression.expression,expression.left.argumentExpression,expression.right]);
 const value=c.ctx.elements[fn.parameters.at(-1).id];value.paramType={type:'int'};register(c.ctx.elements,'Map');assert.equal(qualified(fn),false);
},localRoot,arraySource));

test('owned nominal globals keep the exact original library storage and are never recreated in the primary',()=>run(c=>{
 const expression=c.matches(n=>n.kind===K.PropertyAccessExpression&&n.expression.name==='shared')[0],param=lower(expression,c.ctx,undefined,c.helpers);
 const fn=c.ctx.elements[c.ctx.elements[c.ctx.elements[param.id].functionCall.id].functionDef.id];assert(qualified(fn));assert.equal(fn.scriptCode,'shared.raw');assert.equal(fn.returnType.type,'fixed');
 assert(!Object.values(c.ctx.elements).some(e=>e.type==='Variable'));
},'include "owned"\nvoid Read(fixed value){}void Run(){Read(shared.raw);}',source+'\ngs_External shared;'));

test('an original structref parameter supports the same exact member path without treating it as global storage',()=>run(c=>{
 const expression=c.matches(n=>n.kind===K.PropertyAccessExpression&&n.expression.name==='value')[0],seen=[];
 c.helpers.exprToParamRef=(node,ctx,formal)=>{seen.push(node);return c.helpers.mkParamRef({parameterDef:formal,value:'fixture',valueType:{type:'string'}});};
 const param=lower(expression,c.ctx,undefined,c.helpers),fn=c.ctx.elements[c.ctx.elements[c.ctx.elements[param.id].functionCall.id].functionDef.id];assert(qualified(fn));assert.equal(seen.length,1);assert.equal(fn.scriptCode,'#PARAM(target).raw');
},'include "owned"\nvoid Read(fixed value){}void Run(structref<gs_External> value){Read(value.raw);}',source));

test('an isolated serialized FunctionDef fragment retains exact implicit-library identity and cannot acquire a foreign owner',()=>run(c=>{
 const expression=c.matches(n=>n.kind===K.PropertyAccessExpression&&n.name.name==='raw')[0];lower(expression,c.ctx,undefined,c.helpers);
 const fn=Object.values(c.ctx.elements).find(e=>e.type==='FunctionDef');assert(qualified(fn));
 const xml=serializeTriggerLibraryCanonical({id:'Map',implicit:true,items:[],elements:c.ctx.elements});
 const fragment=xml.match(new RegExp('<Element Type="FunctionDef" Id="'+fn.id+'">[\\s\\S]*?</Element>'))?.[0];assert(fragment);
 const fresh=parseTriggerXmlSync('<TriggerData Version="2"><Library Id="Map">'+fragment+'</Library></TriggerData>').get('Map');
 const actual=Object.values(fresh.elements).find(e=>e.type==='FunctionDef');assert(qualified(actual));
 actual.library='Foreign';assert.equal(qualified(actual),false);
}));

test('fragment replay of nominal return types and reference parameters ignores JSON key order but preserves typed owners',()=>run(c=>{
 prime({program:c.program,primaryNames:['primary.galaxy'],libraryId:'Map',elements:c.ctx.elements,structuresByName:c.ctx.structureByGalaxyTypeName,functionDefsByName:c.ctx.funcNameToFuncDef,allocate:c.allocate});
 const expression=c.matches(n=>n.kind===K.CallExpression&&n.expression.name==='Build')[0].arguments[0];lower(expression,c.ctx,undefined,c.helpers);
 const xml=serializeTriggerLibraryCanonical({id:'Map',implicit:true,items:[],elements:c.ctx.elements});
 for(const fn of Object.values(c.ctx.elements).filter(e=>e.type==='FunctionDef')){
  const fragment=xml.match(new RegExp('<Element Type="FunctionDef" Id="'+fn.id+'">[\\s\\S]*?</Element>'))?.[0];assert(fragment);
  const fresh=parseTriggerXmlSync('<TriggerData Version="2"><Library Id="Map">'+fragment+'</Library></TriggerData>').get('Map');
  const actual=Object.values(fresh.elements).find(e=>e.type==='FunctionDef');assert(qualified(actual),fn.scriptCode);
  if(actual.parameters.length){actual.parameters[0].library='Foreign';assert.equal(qualified(actual),false);}
  else {actual.returnType.typeElement.library='Foreign';assert.equal(qualified(actual),false);}
 }
}));

test('final GUI replay replaces constructor receipts and validates referenced source formals from the same XML',()=>run(c=>{
 prime({program:c.program,primaryNames:['primary.galaxy'],libraryId:'Map',elements:c.ctx.elements,structuresByName:c.ctx.structureByGalaxyTypeName,functionDefsByName:c.ctx.funcNameToFuncDef,allocate:c.allocate});
 const fn=c.ctx.funcNameToFuncDef.get('Build');assert(qualified(fn));
 const xml=serializeTriggerLibraryCanonical({id:'Map',implicit:true,items:[],elements:c.ctx.elements}),good=replay(xml,'Map');assert.equal(good.qualifiedDefinitions,1);assert.equal(good.refused.length,0);assert.equal(good.constructorReceiptsUsed,false);
 const parsed=readOwnedGuiLibraries(xml,'Map').get('Map'),parameter=Object.values(parsed.elements).find(e=>e.type==='ParamDef'&&e.isReference);parameter.isReference=false;
 const invalid=serializeTriggerLibraryCanonical(parsed),bad=replay(invalid,'Map');assert.equal(bad.qualifiedDefinitions,0);assert(bad.refused.some(r=>r.reason.includes('REFERENCE_FORMAL')));assert.equal(qualified(fn),false);
}));

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {withGalaxyDocument} from '../model/galaxy-program.collections.mjs';
import {SyntaxKind as K,tokenToString} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const identifier=s=>typeof s==='string'&&/^[_A-Za-z]\w*$/u.test(s);
const scalar=type=>type?.kind>=K.BoolKeyword&&type.kind<=K.WavetargetKeyword?tokenToString(type.kind):undefined;

/** A GUI call interface to an existing, unchanged Galaxy body, not a rebuilt
 * function or a Native. Source reachability, call binding and archive retention
 * remain mandatory separate gates; this factory grants no bypass permission. */
export function createSourceProvidedFunctionDescription({source,symbol,library,allocate,existingIdentities=new Set(),program}){
 assert(source?.fileName&&typeof source.text==='string'&&source.sha256===sha(source.text),'SOURCE_CALL_SOURCE_SHA_REQUIRED');
 assert(identifier(symbol)&&identifier(library)&&typeof allocate==='function','SOURCE_CALL_TYPED_OWNER_REQUIRED');
 return withGalaxyDocument(source,program,document=>{
  assert.equal(document.ast.parseDiagnostics.length,0,'SOURCE_CALL_INVALID_SYNTAX');
  const declarations=document.ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name===symbol);
  const bodies=declarations.filter(n=>n.body);assert.equal(bodies.length,1,'SOURCE_CALL_UNIQUE_BODY_REQUIRED');
  const fn=bodies[0];assert(declarations.every(n=>!n.modifiers?.length),'SOURCE_CALL_NONNATIVE_NONSTATIC_BODY_REQUIRED');
  const returned=scalar(fn.type),parameterTypes=fn.parameters.map(p=>scalar(p.type));
  assert(returned&&parameterTypes.every(t=>t&&t!=='void'),'SOURCE_CALL_SIGNATURE_REQUIRES_TYPED_GUI_MODEL');
  assert(fn.parameters.every(p=>!p.modifiers?.length&&!p.initializer),'SOURCE_CALL_EXPLICIT_VALUE_PARAMETERS_REQUIRED');
  for(const declaration of declarations)assert.equal(JSON.stringify([scalar(declaration.type),declaration.parameters.map(p=>scalar(p.type))]),
   JSON.stringify([returned,parameterTypes]),'SOURCE_CALL_CONFLICTING_DECLARATION_ABI');
  const used=new Set();
  const id=(type,key)=>{
   const value=allocate(type,key);assert(typeof value==='string'&&/^[0-9A-Fa-f]{8}$/u.test(value),'SOURCE_CALL_EDITOR_ID_REQUIRED');
   const identity=JSON.stringify([library,type,value]);assert(!used.has(identity)&&!existingIdentities.has(identity),'SOURCE_CALL_GUI_ID_COLLISION');used.add(identity);return value;
  };
  const functionId=id('FunctionDef',symbol),parameters=parameterTypes.map((type,i)=>({type:'ParamDef',library,id:id('ParamDef',symbol+':'+i),
   identifier:'argument'+i,name:'argument'+i,paramType:{type}}));
  const code=symbol+'('+parameters.map(p=>'#PARAM('+p.identifier+')').join(', ')+')'+(returned==='void'?';':'');
  const definition={type:'FunctionDef',library,id:functionId,identifier:symbol,name:symbol,displayName:symbol,
   flags:[returned==='void'?'Action':'Call','Operator','NoScriptPrefix'],returnType:{type:returned},parameters:parameters.map(p=>({type:'ParamDef',library,id:p.id})),
   isFuncAction:returned==='void',isFuncCall:returned!=='void',scriptCode:code};
  return {definition,parameters,proof:{kind:'UNCHANGED_SOURCE_PROVIDED_FUNCTION_GUI_CALL_DESCRIPTION',source:{fileName:source.fileName,sha256:source.sha256},
   declaration:{symbol,start:fn.pos,end:fn.end,sha256:sha(source.text.slice(fn.pos,fn.end))},abi:{returnType:returned,parameters:parameterTypes},
   gui:{library,type:'FunctionDef',id:functionId},exactInvocationTemplate:code,sharedAst:!!program,
   noRuntimeBodyInGui:true,newNativeDescriptions:0,newCustomScriptSections:0,newRuntimeFunctions:0,
   sourceOrArchiveChanged:false,candidateConstructionOnly:true,bindingAuthorized:false,reachabilityProved:false,archiveRetentionProved:false,
   wholeProgramOracleStillRequired:true,wholeMapAccepted:false}};
 });
}

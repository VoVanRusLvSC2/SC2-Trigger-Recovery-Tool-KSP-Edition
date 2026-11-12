import {AsyncLocalStorage} from 'node:async_hooks';
import {logicalSourcePath,partitionDeclarationViews} from '../model/source-ownership.mjs';
import {indexPreservedSourceFunctions,checkPreservedSourceFunctionInterface,checkPreservedSourceValueInterface} from './preserved-source-member-contract.mjs';
import {parseTriggerXmlSync} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/sax-reader.js';
const scope=new AsyncLocalStorage();
const key=e=>JSON.stringify([e.library,e.type,e.id]);
const code=s=>s?.replace(/\r\n?/gu,'\n');
const signature=e=>JSON.stringify({
 parameters:(e.parameters??[]).map(r=>({type:r.type??'ParamDef',library:r.library??e.library,id:r.id})),
 returnType:e.returnType?.type==='void'?undefined:e.returnType,
 flags:[...new Set([...(e.flags??[]),...(e.isFuncAction?['Action']:[]),...(e.isFuncCall?['Call']:[])])].sort(),
 scriptCode:code(e.scriptCode),subFunctionTypes:e.subFunctionTypes?.length?e.subFunctionTypes:undefined,
 isSubFunction:e.isSubFunction===true,disabled:e.disabled===true,
});

export async function withPreservedSourceCallInterfaces(input,policy,files,operation){
 const context={records:new Map(),refused:new Map(),active:true,index:undefined,reason:'NOT_APPLICABLE'};
 if(policy.preserveAuthoredCode&&files.length){
  try{
   const declarations=partitionDeclarationViews(files,input.galaxyDeclarations??[]);
   if(declarations.conflicts.length)throw Error('PRESERVED_INTERFACE_DECLARATION_VIEW_CONFLICT');
   context.index=indexPreservedSourceFunctions({root:{fileName:'MapScript.galaxy',text:[input.header,input.script].filter(Boolean).join('\n')},
    ownedSources:files,externalSources:declarations.external,includeEvidence:input.includeEvidence});
   context.reason='CLOSED_ORIGINAL_FUNCTION_ABI';
  }catch(error){context.reason=String(error.message);}
 }
 return scope.run(context,async()=>{try{return await operation();}finally{context.active=false;}});
}

// Register only metadata for a call to a body already present in a closed,
// preserved source file. This creates neither a body nor a Native definition.
export function registerPreservedSourceCallInterfaces(elements,library,carrier){
 const context=scope.getStore();if(!context?.active||!context.index)return;
 for(const e of new Set(Object.values(elements))){
  if(e.type!=='FunctionDef'||typeof e.scriptCode!=='string'||!e.scriptCode.trim())continue;
  const name=e.scriptCode.match(/^\s*([A-Za-z_]\w*)/u)?.[1];
  const isCall=/^\s*[A-Za-z_]\w*\s*\(/u.test(e.scriptCode);
  if(!name||(isCall?context.index.resolve(name).status!=='UNIQUE_SIMPLE_ABI':context.index.resolveGlobal(name).status!=='UNIQUE_GLOBAL_VALUE'))continue;
  try{
   const proof=(isCall?checkPreservedSourceFunctionInterface:checkPreservedSourceValueInterface)(context.index,e,elements,library,carrier);
   const flags=new Set(e.flags??[]);
   if(!flags.has('Operator')||[...flags].some(f=>!['Operator','Action','Call','NoScriptPrefix'].includes(f)))throw Error('PRESERVED_INTERFACE_INLINE_OPERATOR_REQUIRED');
   context.records.set(key(e),{signature:signature(e),proof});
  }catch(error){context.refused.set(key(e),{library,type:e.type,id:e.id,name,reason:String(error.message)});}
 }
}
export function isPreservedSourceCallInterfaceElement(e){
 const context=scope.getStore(),record=context?.active&&context.records.get(key(e));
 return !!record&&record.signature===signature(e)&&!e.actions?.length&&!e.localVariables?.length&&e.expressionCode===undefined;
}
export function isPreservedSourceCallInterfaceXml(fragment,library){
 const context=scope.getStore();if(!context?.active||!context.records.size)return false;
 try{
  // Re-read serialized metadata; a receipt or a matching function name is not
  // permission to change the call's type, role, parameter identities or code.
  if((fragment.match(/<ScriptCode(?:\s|>)/gu)??[]).length!==1||/<(?:ExpressionCode|FlagNative)(?:\s|>|\/)/u.test(fragment))return false;
  const result=parseTriggerXmlSync(`<TriggerData Version="2"><Library Id="${library}">${fragment}</Library></TriggerData>`);
  const lib=result.get(library);if(!lib)return false;
  return Object.values(lib.elements).some(isPreservedSourceCallInterfaceElement);
 }catch{return false;}
}
export function preservedSourceCallInterfaceProof(){
 const context=scope.getStore();
 return {kind:'CLOSED_PRESERVED_GALAXY_MEMBER_INTERFACES',reason:context?.reason??'NO_SCOPE',
  closure:context?.index?.closure,records:[...(context?.records.values()??[])].map(r=>r.proof),
  refused:[...(context?.refused.values()??[])],newNative:0,newRuntimeFunctions:0,
  fullGuiClaimed:false,semanticEquivalenceProved:false,accepted:false};
}

export function resolvePreservedSourceValue(binding){
 const context=scope.getStore();if(!context?.active||!context.index||!binding)return undefined;
 const result=context.index.resolveGlobal(binding.name);if(result.status!=='UNIQUE_GLOBAL_VALUE')return undefined;
 const source=result.declaration;
 if(source.owner!==logicalSourcePath(binding.sourceFile)||source.sourceSha256!==binding.contentSha256||
  source.elementType!==binding.elementType||source.rank!==binding.rank||JSON.stringify(source.dimensions)!==JSON.stringify(binding.dimensions))return undefined;
 return source;
}

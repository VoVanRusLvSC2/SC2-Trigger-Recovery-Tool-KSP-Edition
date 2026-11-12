import {registerRetainedNominalInterfaces,isRetainedNominalInterfaceElement,hasRetainedNominalInterfaces} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v499_source_nominal_return_roles_2026-10-27/graph/7e4380349d93-retained-nominal-gui-interfaces.replay.mjs';
import {canonicalScopedGuiIdentity} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/scoped-gui-signature.mjs';
import {openVerifiedSourceBindingProgram} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/verified-source-binding-program.mjs';
import {planSourceLibraryInitialization} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/source-library-initialization-schedule.paths.mjs';
import {reifySourceScheduledDependencyCalls} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v489_scheduled_preset_custom_mode_2026-10-27/graph/e9ea492a2c05-6f6613cff123-24d4c2811ad2-03f5a9b48a5a-4f47d3d15ea0-source-scheduled-dependency-calls.mjs';
import {withIncludedOrdinaryFunctions} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/32864db82fae-included-ordinary-function-interfaces.mjs';
import {indexOriginalFunctionPrototypes,restorePreservedPrototypeInterfaces} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v513_qualified_macro_binding_2026-10-28/graph/dacfddd6968f-5edfedaca32a-df0d25998d11-preserved-prototype-interfaces.roles.mjs';
import {sourceInlineRoleFlags} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/bindings/source-inline-role-flags.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {logicalSourcePath,partitionDeclarationViews} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/source-ownership.mjs';
import {indexPreservedSourceFunctions,checkPreservedSourceFunctionInterface,checkPreservedSourceValueInterface,checkPreservedSourceAggregateInterface} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v513_qualified_macro_binding_2026-10-28/graph/3b0b505785b3-c1b3367ecc26-e496f3bffc0d-preserved-source-aggregate-contract.boolean-conditions.mjs';
import {parseTriggerXmlSync} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/64abc5b7821f-4e81e70a964b-be1ffe491b9d-2bec201047f2-738aa3fd7188-sax-reader.js';
const scope=new AsyncLocalStorage();
const key=e=>JSON.stringify([e.library,e.type,e.id]);
const code=s=>s?.replace(/\r\n?/gu,'\n');
const signature=e=>JSON.stringify({
 parameters:(e.parameters??[]).map(r=>({type:r.type??'ParamDef',library:r.library??e.library,id:r.id})),
 returnType:e.returnType?.type==='void'?undefined:canonicalScopedGuiIdentity(e.returnType,e.library),
 flags:[...new Set([...(e.flags??[]),...(e.isFuncAction?['Action']:[]),...(e.isFuncCall?['Call']:[])])].sort(),
 scriptCode:code(e.scriptCode),subFunctionTypes:e.subFunctionTypes?.length?e.subFunctionTypes:undefined,
 isSubFunction:e.isSubFunction===true,disabled:e.disabled===true,
});

export async function withPreservedSourceCallInterfaces(input,policy,files,operation){
 const context={records:new Map(),refused:new Map(),active:true,prototypeRecords:[],prototypes:new Map(),index:undefined,reason:'NOT_APPLICABLE',library:input.libraryId??'Map',sourceInput:undefined,scheduledDependencies:[]};
 if(policy.preserveAuthoredCode){
  try{
   const declarations=partitionDeclarationViews(files,input.galaxyDeclarations??[]);
   if(declarations.conflicts.length)throw Error('PRESERVED_INTERFACE_DECLARATION_VIEW_CONFLICT');
   const root={fileName:'MapScript.galaxy',text:[input.header,input.script].filter(Boolean).join('\n')};
   context.prototypes=indexOriginalFunctionPrototypes(root);
   const sourceInput={root,ownedSources:files,externalSources:declarations.external,includeEvidence:input.includeEvidence};
   context.index=withIncludedOrdinaryFunctions(indexPreservedSourceFunctions(sourceInput),sourceInput);context.sourceInput=sourceInput;
   context.reason='CLOSED_ORIGINAL_FUNCTION_ABI';
  }catch(error){context.reason=String(error.message);}
 }
 return scope.run(context,async()=>{try{return await operation();}finally{context.active=false;}});
}

// Register only metadata for a call to a body already present in a closed,
// preserved source file. This creates neither a body nor a Native definition.
export function registerPreservedSourceCallInterfaces(elements,library,carrier){
 registerRetainedNominalInterfaces(elements,library);
 const context=scope.getStore();if(!context?.active||!context.index)return;
 context.prototypeRecords.push(...restorePreservedPrototypeInterfaces({elements,library,index:context.index,prototypes:context.prototypes,carrier}));
 for(const e of new Set(Object.values(elements))){
  if(e.type!=='FunctionDef'||typeof e.scriptCode!=='string'||!e.scriptCode.trim())continue;
  if(isRetainedNominalInterfaceElement(e))continue;
  const name=e.scriptCode.match(/^\s*([A-Za-z_]\w*)/u)?.[1];
  const isCall=/^\s*[A-Za-z_]\w*\s*\(/u.test(e.scriptCode);
  if(!name||(isCall?context.index.resolve(name).status!=='UNIQUE_SIMPLE_ABI':context.index.resolveGlobal(name).status!=='UNIQUE_GLOBAL_VALUE'))continue;
  try{
   const aggregate=!isCall&&(e.scriptCode.includes('.')||e.isFuncAction||(e.flags??[]).includes('Action'));
   const proof=(isCall?checkPreservedSourceFunctionInterface:aggregate?checkPreservedSourceAggregateInterface:checkPreservedSourceValueInterface)(context.index,e,elements,library,carrier);
   const flags=sourceInlineRoleFlags(e);
   if(!flags.has('Operator')||[...flags].some(f=>!['Operator','Action','Call','NoScriptPrefix'].includes(f)))throw Error('PRESERVED_INTERFACE_INLINE_OPERATOR_REQUIRED');
   context.records.set(key(e),{signature:signature(e),proof});
  }catch(error){context.refused.set(key(e),{library,type:e.type,id:e.id,name,reason:String(error.message)});}
 }
}
export function isPreservedSourceCallInterfaceElement(e){
 if(isRetainedNominalInterfaceElement(e))return true;
 const context=scope.getStore(),record=context?.active&&context.records.get(key(e));
 return !!record&&record.signature===signature(e)&&!e.actions?.length&&!e.localVariables?.length&&e.expressionCode===undefined;
}
export function isPreservedSourceCallInterfaceXml(fragment,library){
 const context=scope.getStore();if((!context?.active||!context.records.size)&&!hasRetainedNominalInterfaces(library))return false;
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
  closure:context?.index?.closure,scheduledDependencies:context?.scheduledDependencies??[],prototypeInterfaces:context?.prototypeRecords??[],records:[...(context?.records.values()??[])].map(r=>r.proof),
  refused:[...(context?.refused.values()??[])],newNative:0,newRuntimeFunctions:0,
  fullGuiClaimed:false,semanticEquivalenceProved:false,accepted:false};
}

export function resolvePreservedSourceValue(binding){
 const context=scope.getStore();if(!context?.active||!context.index||!binding)return undefined;
 const result=context.index.resolveGlobal(binding.name);if(result.status!=='UNIQUE_GLOBAL_VALUE')return undefined;
 const source=result.declaration;
 if(context.index.isStructType(source.elementType))return undefined;
 if(source.owner!==logicalSourcePath(binding.sourceFile)||source.sourceSha256!==binding.contentSha256||
  source.elementType!==binding.elementType||source.rank!==binding.rank||JSON.stringify(source.dimensions)!==JSON.stringify(binding.dimensions))return undefined;
 return source;
}

export function resolvePreservedSourceAggregate(binding){
 const context=scope.getStore();if(!context?.active||!context.index||!binding)return undefined;
 const result=context.index.resolveAccess(binding.name,binding.steps,binding.mode);if(result.status!=='UNIQUE_SCALAR_ACCESS')return undefined;
 const access=result.access,root=access.root;
 if(root.owner!==logicalSourcePath(binding.sourceFile)||root.sourceSha256!==binding.contentSha256||root.declarationStart!==binding.declarationStart||root.declarationEnd!==binding.declarationEnd||access.elementType!==binding.elementType)return undefined;
 const members=binding.steps.filter(s=>s.kind==='member');
 if(members.length!==access.members.length)return undefined;
 for(let i=0;i<members.length;i++){
  const actual=members[i],expected=access.members[i];
  if(actual.name!==expected.name||actual.struct!==expected.struct||logicalSourcePath(actual.sourceFile)!==expected.owner||actual.contentSha256!==expected.sourceSha256||actual.declarationStart!==expected.declarationStart||actual.declarationEnd!==expected.declarationEnd)return undefined;
 }
 return access;
}

// The source's library availability and initialization time are independent.
// Only unchanged, bound dependency bodies may receive inline call metadata.
// Unsupported schedules keep the old fail-closed startup checks in force.
export function reifyPreservedSourceDependencyCalls(elements,library,nativeLibrary,dependencies,rootRefs,allocateId){
 const context=scope.getStore();
 if(!context?.active||!context.index||!context.sourceInput||context.library!=='Map'||library!==context.library)return;
 let opened,planned;
 try{
  opened=openVerifiedSourceBindingProgram(context.sourceInput.root.text,context.sourceInput);
  if(!opened.program){context.scheduledDependencies.push({applicable:false,reason:opened.reason});return;}
  try{planned=planSourceLibraryInitialization({program:opened.program,fileName:context.sourceInput.root.fileName,nativeLibraryId:nativeLibrary.id});}
  catch(error){context.scheduledDependencies.push({applicable:false,reason:String(error.message)});return;}
  // ABI, domain and ownership failures after applicability must propagate.
  const proof=reifySourceScheduledDependencyCalls({program:opened.program,scheduleCapability:planned.capability,
   elements,libraryId:library,nativeLibrary,dependencies,rootRefs,allocateId});
  context.scheduledDependencies.push({applicable:true,sourceSchedule:planned.proof,...proof});
  return proof;
 }finally{opened?.dispose?.();}
}

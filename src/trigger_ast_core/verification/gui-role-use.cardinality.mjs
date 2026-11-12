import {parseTriggerXmlSync} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/sax-reader.js';
import {createGuiRoleCatalog} from '../bindings/gui-role-catalog.mjs';
const read=(xml,owner)=>parseTriggerXmlSync('<TriggerData><Library Id="'+owner+'">'+xml.replace(/^<\?xml[^>]*>/u,'').replace(/<\/?TriggerData[^>]*>/gu,'')+'</Library></TriggerData>');

/** Validate newly emitted return carriers through the same role catalog used
 * for formal/event queries. Unchanged authored GUI remains source-owned. */
export function auditGuiRoleUse({xml,existingXml='',implicitLibraryId='Map',dependencyLibraries=[]}) {
 const libs=new Map(),trustedOwners=[];
 for(const dependency of dependencyLibraries){
  const parsed=parseTriggerXmlSync(dependency.triggerData??'');
  for(const [id,lib]of parsed){if(libs.has(id))throw Error('AMBIGUOUS_GUI_ROLE_DEPENDENCY');libs.set(id,lib);trustedOwners.push(id);}
 }
 const authored=read(xml,implicitLibraryId),old=existingXml?read(existingXml,implicitLibraryId):new Map();
 for(const [id,lib]of authored){if(libs.has(id))throw Error('GUI_ROLE_AUTHORED_OWNER_COLLISION');libs.set(id,lib);}
 const catalog=createGuiRoleCatalog(libs,{trustedOwners}),issues=[],eventSites=new Set();let checked=0,preserved=0,callsChecked=0;
 const key=(ref,owner)=>JSON.stringify([ref.library??owner,ref.type,ref.id]);
 for(const [owner,lib]of authored)for(const e of Object.values(lib.elements??{})){
  if(e.type==='Trigger')for(const ref of e.events??[])eventSites.add(key(ref,owner));
  if(e.type==='FunctionCall'&&e.subFunctionType){const role=catalog.resolve(e.subFunctionType,owner,'SubFuncType');if(role?.isEvent)eventSites.add(key(e,owner));}
 }
 for(const [owner,lib]of authored)for(const e of Object.values(lib.elements??{})){
  if(e.type!=='FunctionCall')continue;callsChecked++;
  const definition=catalog.resolve(e.functionDef,owner,'FunctionDef');
  if(!definition){issues.push({library:owner,id:e.id,reason:'FUNCTION_DEFINITION_OWNER_UNRESOLVED'});continue;}
  const functionOwner=definition.library??e.functionDef.library??owner,formals=new Set((definition.parameters??[]).map(r=>key(r,functionOwner))),counts=new Map();
  for(const ref of e.parameters??[]){
   const param=catalog.resolve(ref,owner,'Param');
   if(!param?.parameterDef){issues.push({library:owner,id:e.id,param:ref,reason:'CALL_PARAMETER_FORMAL_REQUIRED'});continue;}
   const formalKey=key(param.parameterDef,param.library??owner);counts.set(formalKey,(counts.get(formalKey)??0)+1);
   if(!formals.has(formalKey))issues.push({library:owner,id:e.id,param:ref,formal:param.parameterDef,reason:'CALL_PARAMETER_OWNER_MISMATCH'});
  }
  for(const ref of definition.parameters??[]){
   const formal=catalog.resolve(ref,functionOwner,'ParamDef'),count=counts.get(key(ref,functionOwner))??0;
   if(!formal){issues.push({library:owner,id:e.id,formal:ref,reason:'CALL_FORMAL_DEFINITION_UNRESOLVED'});continue;}
   if(!count&&!formal.default&&!formal.isMultiple)issues.push({library:owner,id:e.id,formal:ref,reason:'CALL_REQUIRED_PARAMETER_MISSING'});
   if(count>1&&!formal.isMultiple)issues.push({library:owner,id:e.id,formal:ref,count,reason:'CALL_PARAMETER_DUPLICATED'});
  }
  if(definition.flags?.includes('Event')&&definition.flags?.includes('Native')&&!eventSites.has(key(e,owner)))issues.push({library:owner,id:e.id,definition:e.functionDef,reason:'EVENT_OUTSIDE_QUALIFIED_GUI_CONTEXT'});
 }
 for(const [owner,lib]of authored)for(const e of Object.values(lib.elements??{})){
  if(e.type!=='FunctionDef'||e.flags?.includes('Native'))continue;
  const same=old.get(owner)?.elementsByType?.FunctionDef?.[e.id]??Object.values(old.get(owner)?.elements??{}).find(x=>x.type==='FunctionDef'&&x.id===e.id);
  if(same&&JSON.stringify(same.returnType)===JSON.stringify(e.returnType)){preserved++;continue;}
  const type=e.returnType??{type:'void'},result=catalog.typeUse(type,'return',owner);checked++;
  if(result.status!=='RESOLVED')issues.push({library:owner,type:e.type,id:e.id,identifier:e.identifier,contract:result});
 }
 return {kind:'GUI_ROLE_USE_PREFLIGHT',passed:!issues.length&&!catalog.issues.length,checked,preserved,callsChecked,issues,catalogIssues:catalog.issues,
  trustedOwners,sourceOrGuiChanged:false,newNative:0,newCustomScript:0,abiProved:false};
}

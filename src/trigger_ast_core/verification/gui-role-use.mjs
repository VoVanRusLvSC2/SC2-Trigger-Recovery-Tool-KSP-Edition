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
 const catalog=createGuiRoleCatalog(libs,{trustedOwners}),issues=[];let checked=0,preserved=0;
 for(const [owner,lib]of authored)for(const e of Object.values(lib.elements??{})){
  if(e.type!=='FunctionDef'||e.flags?.includes('Native'))continue;
  const same=old.get(owner)?.elementsByType?.FunctionDef?.[e.id]??Object.values(old.get(owner)?.elements??{}).find(x=>x.type==='FunctionDef'&&x.id===e.id);
  if(same&&JSON.stringify(same.returnType)===JSON.stringify(e.returnType)){preserved++;continue;}
  const type=e.returnType??{type:'void'},result=catalog.typeUse(type,'return',owner);checked++;
  if(result.status!=='RESOLVED')issues.push({library:owner,type:e.type,id:e.id,identifier:e.identifier,contract:result});
 }
 return {kind:'GUI_ROLE_USE_PREFLIGHT',passed:!issues.length&&!catalog.issues.length,checked,preserved,issues,catalogIssues:catalog.issues,
  trustedOwners,sourceOrGuiChanged:false,newNative:0,newCustomScript:0,abiProved:false};
}

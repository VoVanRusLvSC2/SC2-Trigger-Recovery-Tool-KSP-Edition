/** Resolve only explicit source-owned struct fields for raw-text ABI binding.
 * Imported types, unknown paths, calls and ambiguous fields are left untouched.
 */
import {memberVarName} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v258_bound_typedef_abi_2026-10-20/types/189652cc1dc7-core.mjs';
const unparen=n=>n?.kind===126?unparen(n.expression):n;
function owned(ref,ctx){return ref&&(ref.library??ctx.libId)===ctx.libId?ctx.elements[ref.id]:undefined;}
function typeOf(expression,ctx){
 const n=unparen(expression);if(!n)return undefined;
 if(n.kind===113){
  const local=ctx.elements[ctx.localVarByGalaxyName.get(n.name)];
  if(local?.type==='Variable')return local.variableType;
  const rawRef=ctx.rawLocalStructureByGalaxyName?.get(n.name);
  if(owned(rawRef,ctx)?.type==='Structure')return {type:'struct',typeElement:rawRef};
  const param=owned(ctx.paramRefByGalaxyName?.get(n.name),ctx);
  if(param?.type==='ParamDef')return param.paramType;
  const global=owned(ctx.globalVarByGalaxyName.get(n.name),ctx);
  return global?.type==='Variable'?global.variableType:undefined;
 }
 if(n.kind===119)return typeOf(n.expression,ctx); // Array element retains its structure owner.
 if(n.kind===120)return resolveMember(n,ctx)?.variable.variableType;
 return undefined;
}
function resolveMember(expression,ctx){
 const n=unparen(expression);if(n?.kind!==120||n.name?.kind!==113)return undefined;
 const type=typeOf(n.expression,ctx),structure=owned(type?.typeElement,ctx);
 if(structure?.type!=='Structure')return undefined;
 const mapped=ctx.structureMemberByKey?.get(`${structure.id}:${n.name.name}`);
 const members=(structure.variables??[]).filter(ref=>{
  const variable=owned(ref,ctx);return variable?.type==='Variable'&&
   (mapped?ref.id===mapped.id&&(ref.library??ctx.libId)===(mapped.library??ctx.libId):
    variable.identifier===n.name.name||variable.name===n.name.name);
 });
 if(members.length!==1)return undefined;
 return {variable:owned(members[0],ctx),node:n.name};
}
export function ownedRawStructMember(expression,ctx){
 const resolved=resolveMember(expression,ctx);if(!resolved)return undefined;
 return {node:resolved.node,name:memberVarName(resolved.variable,ctx.libId)};
}

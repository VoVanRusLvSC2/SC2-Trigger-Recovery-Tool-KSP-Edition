/** A complete inline contract, never merely the first call of a macro.
 * Argument names/order/arity must reproduce exactly this definition's formals.
 * This is derived from the live loaded TriggerLib, with no API catalog.
 */
import {templateMacros,replaceTemplateMacros,parseTemplateFragment} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/438d1ed6777b-cdbf9317cf44-298f67ce7553275e-script-template.mjs';
export function singleCallTemplateAlias(definition,library) {
 const code=definition.scriptCode;
 if(!code||!/^([A-Za-z_]\w*)\s*\(/.test(code))return undefined;
 const refs=definition.parameters??[],names=[];
 for(const ref of refs){
  if(ref.library&&ref.library!==(library.id??'Ntve'))return undefined;
  const p=library.elementsByType?.ParamDef?.[ref.id]??library.elements?.[ref.id];
  const name=p?.identifier??p?.name;
  if(p?.type!=='ParamDef'||!name||names.includes(name))return undefined;
  names.push(name);
 }
 const macros=templateMacros(code);
 if(macros.length!==names.length||names.some(name=>macros.filter(m=>m.name==='PARAM'&&m.args[0]===name).length!==1))return undefined;
 if(macros.some(m=>m.name!=='PARAM'||m.args.length!==1||!names.includes(m.args[0])))return undefined;
 const substituted=replaceTemplateMacros(code,m=>'mkCallAliasSlot'+names.indexOf(m.args[0]));
 let nodes=parseTemplateFragment(substituted,false)?.filter(n=>n.kind!==139);
 let call=nodes?.length===1&&nodes[0].kind===138?nodes[0].expression:undefined;
 if(!call){nodes=parseTemplateFragment(substituted,true);call=nodes?.length===1?nodes[0]:undefined;}
 const unwrap=n=>n?.kind===126?unwrap(n.expression):n;
 call=unwrap(call);
 if(call?.kind!==121||call.expression?.kind!==113||call.arguments.length!==refs.length)return undefined;
 if(call.arguments.some((a,i)=>unwrap(a)?.kind!==113||unwrap(a).name!=='mkCallAliasSlot'+i))return undefined;
 return call.expression.name;
}

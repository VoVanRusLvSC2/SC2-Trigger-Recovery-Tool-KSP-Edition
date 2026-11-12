import {cloneGalaxySyntax} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/94c0098c9dbc-dd2fe52ec855-3af1c1fe9330da63-semantic_forms.mjs';
/** A bodyless prototype's parameter labels have no executable binding.
 * Use the unique definition's labels only when its full ABI matches exactly.
 */
export function normalizePrototypeParameterNames(source,K){
 const result={...source,statements:source.statements.map(cloneGalaxySyntax)},notes=[],bodies=new Map(),duplicate=new Set();
 for(const f of result.statements)if(f.kind===K.FunctionDeclaration&&f.body){
  if(bodies.has(f.name.name))duplicate.add(f.name.name);bodies.set(f.name.name,f);
 }
 const abi=f=>JSON.stringify({type:f.type,modifiers:f.modifiers??[],parameters:f.parameters.map(p=>({type:p.type,modifiers:p.modifiers??[]}))});
 for(const f of result.statements)if(f.kind===K.FunctionDeclaration&&!f.body&&!duplicate.has(f.name.name)){
  const body=bodies.get(f.name.name);if(!body||abi(f)!==abi(body))continue;
  if(f.parameters.some((p,i)=>p.name.name!==body.parameters[i].name.name)){
   notes.push({rule:'BODYLESS_PROTOTYPE_PARAMETER_LABELS',function:f.name.name});
   f.parameters.forEach((p,i)=>{p.name.name=body.parameters[i].name.name;});
  }
 }
 return {source:result,notes};
}

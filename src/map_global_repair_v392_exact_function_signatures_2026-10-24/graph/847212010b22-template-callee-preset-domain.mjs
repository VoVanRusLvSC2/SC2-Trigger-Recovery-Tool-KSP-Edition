import {formalPresetRefs,resolveFormalPresetScalar} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/bindings/formal-preset-domain.mjs';
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;

/** A #PARAM used as a callee is not an unconstrained expression hole. When
 * its formal declares a preset domain, the matched symbol must be a unique
 * member of that exact qualified domain. This runs before graph allocation;
 * an unrelated native call cannot instantiate a user-data dispatch template. */
export function templateCalleePresetBindings(template,bindings,{resolve,isShadowed=()=>false}){
 let valid=true;
 const visit=n=>{
  if(!valid)return;
  if(n.kind===K.CallExpression){
   const callee=unwrap(n.expression),hole=callee?.kind===K.Identifier?template.holes.get(callee.name):undefined;
   if(hole?.kind==='parameter'&&!template.fixedParameters?.has(hole.name)){
    const ref=template.parameters.get(hole.name),owner=ref?.library??template.definition.library;
    const formal=ref&&resolve(ref,owner,'ParamDef');
    if(!formal){valid=false;return;}
    if(formalPresetRefs(formal,formal.library??owner).length){
     const value=unwrap(bindings.parameters.get(hole.name));
     if(value?.kind!==K.Identifier||isShadowed(value.name)||!resolveFormalPresetScalar(formal,value.name,formal.library??owner,resolve)){valid=false;return;}
    }
   }
  }
  forEachChild(n,visit);
 };
 for(const n of template.nodes)visit(n);
 return valid;
}

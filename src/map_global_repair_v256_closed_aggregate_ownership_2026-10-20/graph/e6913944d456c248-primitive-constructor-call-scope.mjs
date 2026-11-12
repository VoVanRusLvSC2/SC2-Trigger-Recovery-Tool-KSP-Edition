import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {unwrapParens} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v256_closed_aggregate_ownership_2026-10-20/graph/d14d4b948618471b-g2t-core.mjs';
import {element} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v256_closed_aggregate_ownership_2026-10-20/graph/debb1194e3d04817-expression-type.mjs';
// A known primitive constructor must not consume a call through authored
// storage or a conflicting declaration. This check adds no bindings or names.
export function isUnshadowedPrimitiveConstructor(call,ctx,contract){
 const callee=unwrapParens(call?.expression);
 if(call?.kind!==K.CallExpression||callee?.kind!==K.Identifier||callee.name!==contract.name||call.arguments?.length!==contract.parameters.length)return false;
 for(const map of [ctx.localVarByGalaxyName,ctx.paramRefByGalaxyName,ctx.globalVarByGalaxyName])if(map?.has(callee.name))return false;
 const definition=ctx.funcNameToFuncDef?.get(callee.name);if(!definition)return true;
 if((definition.library??ctx.libId)===ctx.libId&&!definition.flags?.includes('Native')&&!definition.nativeDeclarationOnly&&!definition.unresolvedGuiBinding)return false;
 if(definition.returnType?.type!==contract.returnType||definition.parameters?.length!==contract.parameters.length)return false;
 return definition.parameters.every((ref,i)=>{
  const parameter=element(ref,ctx);
  return parameter?.paramType?.type===contract.parameters[i]&&!parameter.isMultiple&&!parameter.isReference;
 });
}

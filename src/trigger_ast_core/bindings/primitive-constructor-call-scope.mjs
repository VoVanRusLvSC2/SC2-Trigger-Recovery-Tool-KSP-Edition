import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {unwrapParens} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
import {element} from '../types/expression-type.mjs';
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

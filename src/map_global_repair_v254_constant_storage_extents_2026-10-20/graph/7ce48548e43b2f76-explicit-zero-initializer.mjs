import {nativeIntegerPresetParam} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v254_constant_storage_extents_2026-10-20/graph/5e70baf63d294277-native-integer-preset.mjs';
import {printNode} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v254_constant_storage_extents_2026-10-20/graph/0facdb3525fc37a5-script-template.mjs';
/** Preserve an explicitly authored mutable int zero initializer.
 * The opaque parameter keeps the Editor from eliding the source write.
 * This is recovery, not a comparison rule assuming implicit zero defaults.
 * Valid TS/JS, kept identical in source and dist.
 */
// @ts-nocheck
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {mkParamRef} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v254_constant_storage_extents_2026-10-20/graph/d14d4b948618471b-g2t-core.mjs';
export function explicitIntegerZero(value,variable,constants,ctx){
 if(variable?.variableType?.type!=='int'||variable.isConstant||!constants)return false;
 let node=value;
 while(node?.kind===K.ParenthesizedExpression)node=node.expression;
 if(node?.kind!==K.Identifier||!node.name.startsWith('ge_')&&!/^lib[A-Za-z0-9]+_ge_/u.test(node.name))return false;
 const preset=ctx?.galaxyConstToPreset?.get(node.name);
 if(preset?.type!=='PresetValue'||(preset.library??ctx.libId)!==ctx.libId)return false;
 let forbidden=false;
 const visit=n=>{if(!n)return;
  if(n.kind===K.NumericLiteral&&!/^(?:0x[0-9a-f]+|\d+)$/iu.test(String(n.text??n.value)))forbidden=true;
  forEachChild(n,visit);
 };visit(value);
 if(forbidden)return false;
 // The constant index rejects mutable/shadowed/ambiguous declarations,
 // calls, overflow, division by zero and unresolved dependencies.
 return constants.evaluate(value)===0;
}
export function explicitIntegerZeroParam(value,variable,ctx,constants){
 if(!explicitIntegerZero(value,variable,constants,ctx))return;
 // Keep the authored preset reference while retaining the explicit write.
 // Constant evaluation proves eligibility only; it never rewrites the value.
 let base=value;while(base?.kind===K.ParenthesizedExpression)base=base.expression;
 const gui=nativeIntegerPresetParam(ctx.galaxyConstToPreset.get(base.name),ctx);
 return gui??mkParamRef({scriptCode:printNode(value),valueType:{type:'int'}},ctx);
}

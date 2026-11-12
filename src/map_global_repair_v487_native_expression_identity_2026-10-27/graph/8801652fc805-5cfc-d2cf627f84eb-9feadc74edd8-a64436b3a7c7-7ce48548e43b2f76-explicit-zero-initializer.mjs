import {nativeIntegerPresetParam} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/843db419ad43-f25d8dfd-59e4475a1842-5e697830fe76-bd9e5ef8d05f-5e70baf63d294277-native-integer-preset.mjs';
import {printNode} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/2ab74ac917ab-1615e5416b91-2f7c29c2e272-0facdb3525fc37a5-script-template.mjs';
/** Preserve an explicitly authored mutable int zero initializer.
 * The opaque parameter keeps the Editor from eliding the source write.
 * This is recovery, not a comparison rule assuming implicit zero defaults.
 * Valid TS/JS, kept identical in source and dist.
 */
// @ts-nocheck
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {mkParamRef} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/39db0c9c9123-ae8e39bac3e6-0131c278e7d7-3449b17ca5f9-174ab517065c-g2t-core.generated-call-provenance.mjs';
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

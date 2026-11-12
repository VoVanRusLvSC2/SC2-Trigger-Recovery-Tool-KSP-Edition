/** Preserve an explicitly authored mutable int zero initializer.
 * The opaque parameter keeps the Editor from eliding the source write.
 * This is recovery, not a comparison rule assuming implicit zero defaults.
 * Valid TS/JS, kept identical in source and dist.
 */
// @ts-nocheck
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d4f4db2b829c-index.js';
import {mkParamRef} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/bce993139bd2-6ec0feb66281-46bd418ac3313d57-g2t-core.mjs';
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
 return mkParamRef({scriptCode:'(0)',valueType:{type:'int'}},ctx);
}

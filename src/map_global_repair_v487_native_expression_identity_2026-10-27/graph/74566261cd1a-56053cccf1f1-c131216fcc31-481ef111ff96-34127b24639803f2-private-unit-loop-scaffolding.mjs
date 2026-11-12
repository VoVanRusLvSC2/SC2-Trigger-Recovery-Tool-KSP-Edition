/** Удалять можно только собственные временные переменные одного native unit-loop.
 * Использования вне этого цикла или внутри пользовательских действий запрещают свёртку.
 * ctx/AST принадлежат одной карте, functionSymbolIndex использует слабые ключи.
 */
// @ts-nocheck
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d4f4db2b829c-index.js';
import {functionSymbolIndex} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/bce993139bd2-6ec0feb66281-46bd418ac3313d57-g2t-core.mjs';
import {privateTemplateLoopScaffolding} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/bindings/private-template-loop-scaffolding.mjs";
import {deriveNativeLoopTemplatePreserver} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/ea5773d84e1a-native-loop-template-shapes.mjs";
import {templateMacros} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/d5734da0691b-56a9139d7536-a7e6f1fe81bc-cf5412e476e04e5a-balanced-script-template.mjs";
export function privateUnitLoopScaffolding(nodes,index,ctx,groupName,indexName,userBody,groupExpression){
 return privateTemplateLoopScaffolding({nodes,index,ctx,names:[groupName,indexName],types:['unitgroup','int'],userBody,input:groupExpression,symbolIndex:functionSymbolIndex,templates:deriveNativeLoopTemplatePreserver(ctx.nativeLibrary,{macros:templateMacros}),K,forEachChild});
}

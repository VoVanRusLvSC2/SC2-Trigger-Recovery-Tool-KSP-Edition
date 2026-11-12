/** Удалять можно только собственные временные переменные одного native unit-loop.
 * Использования вне этого цикла или внутри пользовательских действий запрещают свёртку.
 * ctx/AST принадлежат одной карте, functionSymbolIndex использует слабые ключи.
 */
// @ts-nocheck
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {functionSymbolIndex} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v258_bound_typedef_abi_2026-10-20/graph/d14d4b948618471b-g2t-core.mjs';
import {privateTemplateLoopScaffolding} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C++/trigger_ast_core/bindings/private-template-loop-scaffolding.mjs";
import {deriveNativeLoopTemplatePreserver} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C++/trigger_ast_core/bindings/native-loop-template-shapes.mjs";
import {templateMacros} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v258_bound_typedef_abi_2026-10-20/graph/cf5412e476e04e5a-balanced-script-template.mjs";
export function privateUnitLoopScaffolding(nodes,index,ctx,groupName,indexName,userBody,groupExpression){
 return privateTemplateLoopScaffolding({nodes,index,ctx,names:[groupName,indexName],types:['unitgroup','int'],userBody,input:groupExpression,symbolIndex:functionSymbolIndex,templates:deriveNativeLoopTemplatePreserver(ctx.nativeLibrary,{macros:templateMacros}),K,forEachChild});
}

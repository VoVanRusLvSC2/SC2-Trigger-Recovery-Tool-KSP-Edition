/** Удалять можно только собственные временные переменные одного native unit-loop.
 * Использования вне этого цикла или внутри пользовательских действий запрещают свёртку.
 * ctx/AST принадлежат одной карте, functionSymbolIndex использует слабые ключи.
 */
// @ts-nocheck
import {SyntaxKind as K,forEachChild} from "../exact-function-signatures/index-alternate-5.js";
import {functionSymbolIndex} from "../exact-native-export/g2t-core-alternate.mjs";
import {privateTemplateLoopScaffolding} from "../../bindings/private-template-loop-scaffolding.mjs";
import {deriveNativeLoopTemplatePreserver} from "../exact-function-signatures/native-loop-template-shapes.mjs";
import {templateMacros} from "./balanced-script-template-alternate.mjs";
export function privateUnitLoopScaffolding(nodes,index,ctx,groupName,indexName,userBody,groupExpression){
 return privateTemplateLoopScaffolding({nodes,index,ctx,names:[groupName,indexName],types:['unitgroup','int'],userBody,input:groupExpression,symbolIndex:functionSymbolIndex,templates:deriveNativeLoopTemplatePreserver(ctx.nativeLibrary,{macros:templateMacros}),K,forEachChild});
}

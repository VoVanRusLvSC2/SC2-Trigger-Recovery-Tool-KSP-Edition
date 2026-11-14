/** Удалять можно только собственные временные переменные одного native unit-loop.
 * Uses outside this loop or inside user actions prevent folding.
 * Context and AST belong to one map; functionSymbolIndex uses weak keys.
 */
// @ts-nocheck
import { SyntaxKind as K, forEachChild } from '../exact-function-signatures/index-alternate.js';
import { functionSymbolIndex } from '../exact-native-export/g2t-core-alternate-3.mjs';
import { privateTemplateLoopScaffolding } from '../../bindings/private-template-loop-scaffolding.mjs';
import { deriveNativeLoopTemplatePreserver } from '../exact-function-signatures/native-loop-template-shapes.mjs';
import { templateMacros } from './balanced-script-template-alternate.mjs';
export function privateUnitLoopScaffolding(
  nodes,
  index,
  ctx,
  groupName,
  indexName,
  userBody,
  groupExpression,
) {
  return privateTemplateLoopScaffolding({
    nodes,
    index,
    ctx,
    names: [groupName, indexName],
    types: ['unitgroup', 'int'],
    userBody,
    input: groupExpression,
    symbolIndex: functionSymbolIndex,
    templates: deriveNativeLoopTemplatePreserver(ctx.nativeLibrary, { macros: templateMacros }),
    K,
    forEachChild,
  });
}

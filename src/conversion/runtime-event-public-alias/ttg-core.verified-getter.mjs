export { resolveVariableGalaxyName } from '../native-expression-identity/numeric-global-binding.mjs';
export {
  indexDeclaredGalaxySymbols,
  indexDependencyFunctionNames,
  indexDependencyVariableNames,
} from '../native-expression-identity/sdk-index-alternate.mjs';

export * from '../native-expression-identity/ttg-core.identity.mjs';

export { toGalaxyFunctionName } from './verified-forward-getter.mjs';

export {
  globalVariableName as globalVarName,
  globalVariableNames as buildGlobalVarNamesMap,
} from '../../ast/explicit-numeric-global-model.mjs';

// Override only context-key construction; preserve the existing SDK singleton.
import { expressionKey as legacyKey } from '../native-expression-identity/ttg-core.identity.mjs';
import { syntaxShape } from '../native-expression-identity/balanced-script-template-alternate.mjs';
import { literalByteSyntaxShape } from '../exact-function-signatures/literal-byte-syntax-shape.mjs';
import { conversionError as fail } from '../../ast/explicit-numeric-global-model.mjs';
import { createContextualExpressionMemo } from '../../model/contextual-expression-memo.mjs';
const contextualMemo = createContextualExpressionMemo({
  legacyKey,
  shape: (n) => literalByteSyntaxShape(n, syntaxShape),
  fail,
});
export const expressionKey = contextualMemo.expressionKey,
  memoExpression = contextualMemo.memoExpression;

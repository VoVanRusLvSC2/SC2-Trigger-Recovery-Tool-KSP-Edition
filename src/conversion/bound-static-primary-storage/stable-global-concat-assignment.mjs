import { SyntaxKind as K } from '../exact-function-signatures/index-alternate-3.js';
import { boundSourceStoragePath } from './authored-storage-boundary-path.member-tokens.mjs';

const unwrap = (node) => {
  while (node?.kind === K.ParenthesizedExpression) node = node.expression;
  return node;
};
function stableAddress(node) {
  node = unwrap(node);
  return (
    node?.kind === K.Identifier ||
    (node?.kind === K.PropertyAccessExpression && stableAddress(node.expression))
  );
}
function effectFreeValue(program, node) {
  node = unwrap(node);
  if ([K.StringLiteral, K.NumericLiteral, K.TrueKeyword, K.FalseKeyword].includes(node?.kind))
    return true;
  if (node?.kind === K.PrefixUnaryExpression)
    return (
      [K.PlusToken, K.MinusToken, K.ExclamationToken, K.TildeToken].includes(node.operator?.kind) &&
      effectFreeValue(program, node.operand)
    );
  if (node?.kind === K.BinaryExpression)
    return (
      node.operatorToken?.kind === K.PlusToken &&
      effectFreeValue(program, node.left) &&
      effectFreeValue(program, node.right)
    );
  if (
    node?.kind === K.CallExpression &&
    node.expression?.kind === K.Identifier &&
    node.expression.name === 'IntToString' &&
    node.arguments.length === 1
  ) {
    const declaration = program.declarationAt(node.expression);
    // Recognize the engine conversion, not a same-named user function. Other
    // calls may yield, mutate the target or re-enter this write: retain fallback.
    return (
      program.getBinding(node.expression).status === 'BOUND' &&
      declaration?.kind === K.FunctionDeclaration &&
      !declaration.body &&
      declaration.modifiers?.some((modifier) => modifier.kind === K.NativeKeyword) &&
      declaration.type?.kind === K.StringKeyword &&
      declaration.parameters.length === 1 &&
      declaration.parameters[0].type?.kind === K.IntKeyword &&
      !declaration.parameters[0].isReference &&
      effectFreeValue(program, node.arguments[0])
    );
  }
  return false;
}

// A fixed global/record address and an effect-free RHS need no reference helper.
// Array indexes and unknown calls stay on the existing conservative path.
export function planStableGlobalConcatAssignment(program, statement) {
  const expression = statement?.kind === K.ExpressionStatement && statement.expression;
  if (
    expression?.kind !== K.BinaryExpression ||
    expression.operatorToken?.kind !== K.PlusEqualsToken ||
    !stableAddress(expression.left) ||
    !effectFreeValue(program, expression.right)
  )
    return;
  const storage = boundSourceStoragePath(program, expression.left, { mode: 'readwrite' });
  if (
    storage.status !== 'EXACT_BOUND_SCALAR_STORAGE' ||
    !['string', 'text'].includes(storage.elementType)
  )
    return;
  const add = {
    ...expression,
    operatorToken: { ...expression.operatorToken, kind: K.PlusToken },
    right: { kind: K.ParenthesizedExpression, expression: expression.right },
  };
  return {
    node: {
      ...statement,
      expression: {
        ...expression,
        operatorToken: { ...expression.operatorToken, kind: K.EqualsToken },
        right: add,
      },
    },
    proof: {
      kind: 'STABLE_GLOBAL_CONCAT_APPEND_TO_ASSIGNMENT',
      storage,
      targetAddressEffectFree: true,
      rhsEffectFree: true,
      localCellReadsBefore: 1,
      localCellReadsAfter: 1,
      localCellWritesBefore: 1,
      localCellWritesAfter: 1,
      newNative: 0,
      newRuntimeFunctions: 0,
      newCustomScript: 0,
      wholeProgramEquivalent: false,
    },
  };
}

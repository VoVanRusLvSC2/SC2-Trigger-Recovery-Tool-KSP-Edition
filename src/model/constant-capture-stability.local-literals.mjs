// Relocation is allowed only for immutable context-independent integer values.
// An original local const with a proven literal/const initializer has the same
// lifetime guarantee as a root constant. A const snapshot of mutable state does
// not: it must keep its original evaluation point and GUI variable.
export function stableIntegerCapture(
  expression,
  { kinds, unwrap, constants, locals, declarations },
) {
  const active = new Set();
  const pure = (input, depth = 0) => {
    const node = unwrap(input);
    if (!node || depth > 128) return false;
    if (node.kind === kinds.NumericLiteral) return true;
    if (node.kind === kinds.Identifier) {
      const declaration = declarations?.get(node.name);
      if (!declaration) return !locals?.has(node.name);
      if (
        active.has(node.name) ||
        declaration.kind !== kinds.VariableDeclaration ||
        declaration.type?.kind !== kinds.IntKeyword ||
        declaration.modifiers?.length !== 1 ||
        declaration.modifiers[0].kind !== kinds.ConstKeyword ||
        !declaration.initializer ||
        !Number.isInteger(node.pos) ||
        !Number.isInteger(declaration.end) ||
        declaration.end > node.pos
      )
        return false;
      active.add(node.name);
      const valid = pure(declaration.initializer, depth + 1);
      active.delete(node.name);
      return valid;
    }
    if (node.kind === kinds.PrefixUnaryExpression) return pure(node.operand, depth + 1);
    if (node.kind === kinds.BinaryExpression)
      return pure(node.left, depth + 1) && pure(node.right, depth + 1);
    return false;
  };
  if (!constants || !pure(expression)) return false;
  const value = constants.evaluate(expression);
  return Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
}

// Moving a compiler snapshot into a loop template is safe only for immutable,
// context-independent integer expressions. Keep calls and local snapshots at
// their original evaluation point; scoped constant evaluation never executes code.
export function stableIntegerCapture(expression, { kinds, unwrap, constants, locals, declarations }) {
 const pure = (node, depth = 0) => {
  node = unwrap(node);
  if (!node || depth > 128) return false;
  if (node.kind === kinds.NumericLiteral) return true;
  if (node.kind === kinds.Identifier)
   return !locals?.has(node.name) && !declarations?.has(node.name);
  if (node.kind === kinds.PrefixUnaryExpression) return pure(node.operand, depth + 1);
  if (node.kind === kinds.BinaryExpression) return pure(node.left, depth + 1) && pure(node.right, depth + 1);
  return false;
 };
 if (!constants || !pure(expression)) return false;
 const value = constants.evaluate(expression);
 return Number.isInteger(value) && value >= -2147483648 && value <= 2147483647;
}

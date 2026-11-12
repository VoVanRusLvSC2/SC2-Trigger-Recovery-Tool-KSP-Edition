import {SyntaxKind as K} from "./index-alternate-3.js";

// A variadic GUI operator evaluates its sequence from left to right. Only the
// left spine of the source tree has that grouping; its right subtrees are atoms.
export function collectLeftAssociatedOperands(expression, operator, output) {
  const unwrap = node => {while (node?.kind === K.ParenthesizedExpression) node = node.expression;return node;};
  let left = unwrap(expression);
  const tail = [];
  while (left?.kind === K.BinaryExpression && left.operatorToken?.kind === operator) {
    tail.push(left.right);left = unwrap(left.left);
  }
  output.push(left, ...tail.reverse());
}

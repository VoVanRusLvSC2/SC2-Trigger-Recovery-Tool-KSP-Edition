import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';

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

import { SyntaxKind as K } from './index-alternate-3.js';
const unwrap = (node) => {
  while (node?.kind === K.ParenthesizedExpression) node = node.expression;
  return node;
};
const not = (node) => ({
  kind: K.PrefixUnaryExpression,
  operator: { kind: K.ExclamationToken },
  operand: node,
  pos: node.pos,
  end: node.end,
});
const returnsFalse = (node) => {
  if (node?.kind === K.Block && node.statements.length === 1) node = node.statements[0];
  return node?.kind === K.ReturnStatement && unwrap(node.expression)?.kind === K.FalseKeyword;
};

// A chain of failed predicates is a sequence of negated GUI conditions. Every
// branch must only return false; unknown work stays outside this representation.
// This function is called only after the enclosing test-conditions ABI is checked.
export function triggerRejectionGuards(block) {
  if (block?.kind !== K.Block || !block.statements.length) return;
  const result = [];
  for (const first of block.statements) {
    let statement = first;
    while (statement) {
      if (statement.kind !== K.IfStatement || !returnsFalse(statement.thenStatement)) return;
      const failure = unwrap(statement.expression);
      if (!failure) return;
      const condition =
        failure.kind === K.PrefixUnaryExpression && failure.operator?.kind === K.ExclamationToken
          ? failure.operand
          : not(failure);
      result.push({
        ...statement,
        expression: not(condition),
        elseStatement: undefined,
        conditionOrigin: {
          start: failure.pos,
          end: failure.end,
          failurePredicateEvaluations: 1,
          guardOrderPreserved: true,
          returnsFalseOnly: true,
        },
      });
      const tail = statement.elseStatement;
      if (!tail) break;
      if (tail.kind === K.Block && tail.statements.length === 0) break;
      if (tail.kind !== K.IfStatement) return;
      statement = tail;
    }
  }
  return result;
}

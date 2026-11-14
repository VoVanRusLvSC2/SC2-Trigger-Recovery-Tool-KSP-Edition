// A path-insensitive union of all assignments is an overapproximation. Never
// infer that a dynamic expression is safe merely because one assignment is.
import assert from 'node:assert/strict';
import {
  SyntaxKind as K,
  forEachChild,
} from '../sdk/array-values/modules/galaxy/language-core/index.js';
import {
  getTypeName,
  unwrapArrayType,
} from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
const un = (n) => (n?.kind === K.ParenthesizedExpression ? un(n.expression) : n);
const walk = (n, f) => {
  f(n);
  forEachChild(n, (c) => walk(c, f));
};
const assignments = new Set(
  [
    'EqualsToken',
    'PlusEqualsToken',
    'MinusEqualsToken',
    'AsteriskEqualsToken',
    'SlashEqualsToken',
    'PercentEqualsToken',
    'LessThanLessThanEqualsToken',
    'GreaterThanGreaterThanEqualsToken',
    'AmpersandEqualsToken',
    'BarEqualsToken',
    'CaretEqualsToken',
  ].map((k) => K[k]),
);
export function readFiniteLocalStringSources({
  expression,
  owner,
  functions,
  observers,
  globals = new Map(),
}) {
  if (!owner?.body || expression?.kind !== K.Identifier) return;
  const name = expression.name,
    locals = [];
  walk(owner.body, (n) => {
    if (n.kind === K.VariableDeclaration && n.name.name === name) locals.push(n);
  });
  if (!locals.length) return;
  assert(
    locals.length === 1 && !owner.parameters.some((p) => p.name.name === name),
    'PROTOCOL_FLOW_LOCAL_SCOPE_AMBIGUOUS',
  );
  const d = locals[0];
  assert(owner.body.statements.includes(d), 'PROTOCOL_FLOW_LOCAL_NOT_FUNCTION_SCOPED');
  assert(d.end <= expression.pos, 'PROTOCOL_FLOW_LOCAL_USED_BEFORE_DECLARATION');
  assert(
    getTypeName(d.type) === 'string' && !unwrapArrayType(d.type).sizes.length,
    'PROTOCOL_FLOW_LOCAL_STRING_TYPE_REQUIRED',
  );
  const sources = d.initializer ? [d.initializer] : [],
    writes = [];
  let dominates = !!d.initializer && d.end <= expression.pos;
  for (const statement of owner.body.statements) {
    const n = un(statement.expression);
    if (
      n?.kind === K.BinaryExpression &&
      n.operatorToken?.kind === K.EqualsToken &&
      un(n.left)?.kind === K.Identifier &&
      un(n.left).name === name &&
      statement.end <= expression.pos
    )
      dominates = true;
  }
  assert(dominates, 'PROTOCOL_FLOW_LOCAL_DOMINATING_INITIALIZER_REQUIRED');
  walk(owner.body, (n) => {
    if (n.kind === K.BinaryExpression && assignments.has(n.operatorToken?.kind)) {
      const target = un(n.left);
      if (target?.kind === K.Identifier && target.name === name) {
        assert(n.pos >= d.end, 'PROTOCOL_FLOW_LOCAL_WRITE_BEFORE_DECLARATION');
        assert(n.operatorToken.kind === K.EqualsToken, 'PROTOCOL_FLOW_LOCAL_COMPOUND_WRITE');
        sources.push(n.right);
        writes.push({ pos: n.pos, end: n.end });
      }
    }
    if ([K.PrefixUnaryExpression, K.PostfixUnaryExpression].includes(n.kind)) {
      const target = un(n.operand);
      assert(
        target?.kind !== K.Identifier || target.name !== name,
        'PROTOCOL_FLOW_LOCAL_UNARY_WRITE',
      );
    }
    if (n.kind !== K.CallExpression) return;
    n.arguments.forEach((argument, index) => {
      const a = un(argument);
      if (a?.kind !== K.Identifier || a.name !== name) return;
      const callee = un(n.expression);
      assert(callee?.kind === K.Identifier, 'PROTOCOL_FLOW_LOCAL_INDIRECT_CALL');
      assert(
        !globals.has(callee.name) && !owner.parameters.some((p) => p.name.name === callee.name),
        'PROTOCOL_FLOW_LOCAL_CALLEE_SHADOWED',
      );
      walk(owner.body, (local) => {
        assert(
          local.kind !== K.VariableDeclaration || local.name.name !== callee.name,
          'PROTOCOL_FLOW_LOCAL_CALLEE_SHADOWED',
        );
      });
      const defs = functions.get(callee.name) ?? [];
      if (observers.get(callee.name)?.includes(index)) {
        assert(
          defs.every((d) => d.parameters[index] && !d.parameters[index].isReference),
          'PROTOCOL_FLOW_LOCAL_OBSERVER_REFERENCE',
        );
        return;
      }
      assert(
        defs.length &&
          defs.every(
            (d) =>
              d.parameters.length === n.arguments.length &&
              d.parameters[index] &&
              !d.parameters[index].isReference,
          ),
        'PROTOCOL_FLOW_LOCAL_REFERENCE_OR_UNKNOWN_CALL',
      );
    });
  });
  assert(sources.length && sources.length <= 128, 'PROTOCOL_FLOW_LOCAL_SOURCE_BOUND');
  return {
    sources,
    key: owner.name.name + ':local:' + name,
    proof: {
      owner: owner.name.name,
      name,
      declaration: { pos: d.pos, end: d.end },
      use: expression.pos,
      writes,
      allAssignmentBranchesIncluded: true,
      explicitInitializationDominates: true,
      globalOfSameNameNotRead: true,
    },
  };
}

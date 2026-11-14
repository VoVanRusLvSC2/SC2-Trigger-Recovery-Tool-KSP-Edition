// For a declared signed int32 iterator, x < N iff x <= N-1, and x > N
// iff x >= N+1. Refuse unrepresentable endpoints and ambiguous spellings.
// The caller must establish the actual scalar int declaration separately.
import { Parser, SyntaxKind as K } from '../sdk/array-values/modules/galaxy/language-core/index.js';
const unwrap = (n) => (n?.kind === K.ParenthesizedExpression ? unwrap(n.expression) : n);
export function readCanonicalInt32Literal(n) {
  n = unwrap(n);
  let sign = 1n;
  if (
    n?.kind === K.PrefixUnaryExpression &&
    [K.PlusToken, K.MinusToken].includes(n.operator?.kind)
  ) {
    sign = n.operator.kind === K.MinusToken ? -1n : 1n;
    n = unwrap(n.operand);
  }
  if (n?.kind !== K.NumericLiteral || !/^(?:0[xX][0-9a-fA-F]+|0|[1-9][0-9]*)$/u.test(n.text ?? ''))
    return;
  const magnitude = BigInt(n.text);
  if (n.value !== undefined && String(magnitude) !== String(n.value)) return;
  const value = sign * magnitude;
  return value >= -2147483648n && value <= 2147483647n ? value : undefined;
}
export function inclusiveLiteralIntComparison(condition) {
  condition = unwrap(condition);
  if (condition?.kind !== K.BinaryExpression || unwrap(condition.left)?.kind !== K.Identifier)
    return;
  const op = condition.operatorToken?.kind;
  if (![K.LessThanToken, K.GreaterThanToken].includes(op)) return;
  const source = readCanonicalInt32Literal(condition.right);
  if (source === undefined) return;
  const end = source + (op === K.LessThanToken ? -1n : 1n);
  if (end < -2147483648n || end > 2147483647n) return;
  const ast = new Parser().parseFile('inclusive-literal-bound', 'int Bound=' + end + ';');
  if (ast.parseDiagnostics.length) return;
  const right = ast.statements[0].initializer;
  return {
    condition: {
      ...condition,
      right,
      operatorToken: {
        ...condition.operatorToken,
        kind: op === K.LessThanToken ? K.LessThanEqualsToken : K.GreaterThanEqualsToken,
      },
    },
    proof: {
      sourceRelation: op === K.LessThanToken ? '<' : '>',
      sourceBound: source.toString(),
      inclusiveRelation: op === K.LessThanToken ? '<=' : '>=',
      inclusiveBound: end.toString(),
      int32DomainRequired: true,
      literalOnly: true,
      overflowRefused: true,
      originalAstMutated: false,
    },
  };
}

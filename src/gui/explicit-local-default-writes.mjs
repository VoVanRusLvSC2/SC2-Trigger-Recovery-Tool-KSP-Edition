import { SyntaxKind as K } from '../sdk/array-values/modules/galaxy/language-core/index.js';
const un = (n) => {
  while (n?.kind === K.ParenthesizedExpression) n = n.expression;
  return n;
};

// Editor can omit a numeric zero held only as Variable.initialValue. Preserve
// the complete original scalar write sequence as ordinary GUI assignments.
// Never move just one initializer past the others or assume VM defaults.
export function retainExplicitLocalDefaultWrites(prefix, statements) {
  if (!prefix?.initializers.length || !prefix.declarations.length) return prefix;
  const declarations = new Set(prefix.declarations),
    head = statements.slice(0, prefix.length);
  if (
    prefix.declarations.some(
      (d) =>
        d.initializer ||
        d.modifiers?.length ||
        ![K.IntKeyword, K.FixedKeyword].includes(d.type.kind),
    )
  )
    return prefix;
  const boundary = head.findIndex((n) => !declarations.has(n));
  if (boundary < 0) return prefix;
  if (
    head.slice(boundary).some((n) => n.kind !== K.ExpressionStatement) ||
    head.slice(0, boundary).length !== declarations.size
  )
    return prefix;
  if (
    !prefix.initializers.some(
      (i) => un(i.expression)?.kind === K.NumericLiteral && Number(un(i.expression).value) === 0,
    )
  )
    return prefix;
  return {
    ...prefix,
    length: boundary,
    initializers: [],
    explicitLocalDefaultWriteProof: {
      kind: 'ORIGINAL_NUMERIC_LOCAL_INITIALIZATION_WRITES_RETAINED_AS_GUI_ACTIONS',
      statements: head.slice(boundary).map((n) => ({ start: n.pos, end: n.end })),
      originalWriteOrderPreserved: true,
      newWrites: 0,
      vmDefaultAssumption: false,
    },
  };
}

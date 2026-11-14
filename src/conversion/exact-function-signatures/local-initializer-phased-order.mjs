import { SyntaxKind as K } from './index-alternate-3.js';
const literal = (n) => {
  while (n?.kind === K.ParenthesizedExpression) n = n.expression;
  return (
    [K.NumericLiteral, K.StringLiteral, K.TrueKeyword, K.FalseKeyword, K.NullKeyword].includes(
      n?.kind,
    ) ||
    (n?.kind === K.PrefixUnaryExpression &&
      n.operator?.kind === K.MinusToken &&
      n.operand?.kind === K.NumericLiteral)
  );
};

// Native emits constant declaration initializers before the Variable
// Initialization block, even when mutable declarations precede those constants.
// Do not compare those two phases as one GUI variable-initialization sequence.
export function localInitializerDependencyOrder(declarations, initializers) {
  const names = declarations.map((d) => d.name?.name),
    source = initializers.map((v) => v.name),
    selected = new Set(source);
  if (
    names.some((n) => !n) ||
    source.some((n) => !n) ||
    new Set(names).size !== names.length ||
    selected.size !== source.length
  )
    return;
  const byName = new Map(initializers.map((v) => [v.name, v])),
    inline = new Set();
  for (const declaration of declarations) {
    const value = byName.get(declaration.name.name);
    if (
      value &&
      declaration.initializer &&
      declaration.modifiers?.some((m) => m.kind === K.ConstKeyword)
    ) {
      // A matching name is not evidence that a later explicit store belongs to a
      // declaration. The classifier must retain the exact original AST expression.
      if (value.expression !== declaration.initializer) return;
      inline.add(declaration.name.name);
    }
  }
  const emitted = [
    ...names.filter((n) => selected.has(n) && inline.has(n)),
    ...names.filter((n) => selected.has(n) && !inline.has(n)),
  ];
  if (emitted.length !== source.length) return;
  const positions = new Map(emitted.map((n, i) => [n, i])),
    sourcePositions = new Map(source.map((n, i) => [n, i]));
  for (let i = 0; i < source.length; i++)
    for (let j = i + 1; j < source.length; j++) {
      if (positions.get(source[i]) < positions.get(source[j])) continue;
      if (!literal(initializers[i].expression) && !literal(initializers[j].expression)) return;
    }
  return Object.freeze({
    sameOrder: source.every((name, index) => name === emitted[index]),
    inlineConstantDeclarations: Object.freeze([...inline]),
    preservesRead(index, name) {
      const other = sourcePositions.get(name);
      return (
        other === undefined ||
        other === index ||
        Math.sign(other - index) === Math.sign(positions.get(name) - positions.get(source[index]))
      );
    },
  });
}

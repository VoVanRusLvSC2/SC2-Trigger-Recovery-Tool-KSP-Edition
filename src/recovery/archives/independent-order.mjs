/** Conservative comparison-only normalization. Never writes product Galaxy.
 * Only independent global literal/constant-expression initializers may move; actions/calls/conditions,
 * mutable state, locals and startup order remain subject to the strict comparer.
 */
export function normalizeIndependentOrder(source, kinds, { nativeIncludesNatives = false } = {}) {
  const clone = { ...source, statements: [...source.statements] };
  const notes = [];
  const includes = clone.statements.filter((node) => node.kind === kinds.IncludeStatement);
  const includePath = (node) => node.path.text.replaceAll('"', '');
  if (
    nativeIncludesNatives &&
    includes.some((node) => includePath(node) === 'TriggerLibs/NativeLib') &&
    includes.some((node) => includePath(node) === 'TriggerLibs/natives')
  ) {
    clone.statements = clone.statements.filter(
      (node) =>
        !(node.kind === kinds.IncludeStatement && includePath(node) === 'TriggerLibs/natives'),
    );
    notes.push(
      'Explicit natives include is transitively present through unchanged NativeLib; compiler acceptance remains separate',
    );
  }
  const initialized = clone.statements.filter(
    (node) => node.kind === kinds.VariableDeclaration && node.initializer !== undefined,
  );
  const globals = new Map(
    clone.statements
      .filter((node) => node.kind === kinds.VariableDeclaration)
      .map((node) => [node.name.name, node]),
  );
  const isConst = (node) =>
    node.modifiers?.some((modifier) => modifier.kind === kinds.ConstKeyword);
  const literals = new Set([
    kinds.NumericLiteral,
    kinds.StringLiteral,
    kinds.TrueKeyword,
    kinds.FalseKeyword,
    kinds.NullKeyword,
  ]);
  const unary = new Set([
    kinds.PlusToken,
    kinds.MinusToken,
    kinds.TildeToken,
    kinds.ExclamationToken,
  ]);
  const binary = new Set(
    [
      'PlusToken',
      'MinusToken',
      'AsteriskToken',
      'SlashToken',
      'PercentToken',
      'LessThanLessThanToken',
      'GreaterThanGreaterThanToken',
      'AmpersandToken',
      'BarToken',
      'CaretToken',
      'LessThanToken',
      'LessThanEqualsToken',
      'GreaterThanToken',
      'GreaterThanEqualsToken',
      'EqualsEqualsToken',
      'ExclamationEqualsToken',
      'AmpersandAmpersandToken',
      'BarBarToken',
    ]
      .map((name) => kinds[name])
      .filter((kind) => kind !== undefined),
  );
  const pure = (node, visiting = new Set()) => {
    if (!node) return false;
    if (literals.has(node.kind)) return true;
    if (node.kind === kinds.ParenthesizedExpression) return pure(node.expression, visiting);
    if (node.kind === kinds.PrefixUnaryExpression)
      return unary.has(node.operator?.kind) && pure(node.operand, visiting);
    if (node.kind === kinds.BinaryExpression)
      return (
        binary.has(node.operatorToken?.kind) &&
        pure(node.left, visiting) &&
        pure(node.right, visiting)
      );
    if (node.kind === kinds.Identifier) {
      const name = node.name,
        target = globals.get(name);
      if (!target || !isConst(target) || !target.initializer || visiting.has(name)) return false;
      return pure(target.initializer, new Set([...visiting, name]));
    }
    return false; // Calls, casts/unknown syntax, state access, assignments are not proved pure.
  };
  // Distinct globals may each receive a literal even when they are mutable.
  // No initializer may read those mutable globals or call/change external state.
  const safe = initialized.every((node) => pure(node.initializer, new Set([node.name.name])));
  if (safe && initialized.length > 1) {
    const sorted = [...initialized].sort((a, b) => a.name.name.localeCompare(b.name.name));
    let index = 0;
    clone.statements = clone.statements.map((node) =>
      node.kind === kinds.VariableDeclaration && node.initializer !== undefined
        ? sorted[index++]
        : node,
    );
    notes.push(
      'Independent global literal/constant-expression initializers compared by identity; no calls or mutable reads accepted',
    );
  }
  return {
    source: clone,
    notes,
    globalInitializerOrderProvedIndependent: safe,
    initializedGlobals: initialized.length,
  };
}

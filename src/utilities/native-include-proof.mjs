import { createHash } from 'node:crypto';
const sha = (s) => createHash('sha256').update(s).digest('hex');
const alias = (p) =>
  p
    .replaceAll('\\', '/')
    .replace(/^base\.sc2data\//iu, '')
    .replace(/\.galaxy$/iu, '')
    .toLowerCase();
/** Galaxy loads one source file once. Omit only duplicates of the verified live
 * NativeLib, or includes proven ALREADY loaded through its raw source graph.
 * The first occurrence and order of every other include remain unchanged.
 */
export function normalizeVerifiedNativeIncludes(
  source,
  K,
  { declarations, nativeProof, parseGalaxy } = {},
) {
  if (!nativeProof?.readLive || !Array.isArray(declarations) || !parseGalaxy)
    return { source, notes: [], refused: 'Live source proof omitted' };
  const files = new Map();
  for (const d of declarations) {
    const name = alias(d.fileName);
    if (files.has(name) && files.get(name)?.text !== d.text) files.set(name, null);
    else if (!files.has(name)) files.set(name, d);
  }
  const root = files.get('triggerlibs/nativelib');
  if (!root || sha(root.text) !== nativeProof.sha256)
    return { source, notes: [], refused: 'Effective NativeLib source/hash not unique' };
  const reachable = new Map(),
    pending = ['triggerlibs/nativelib'],
    unknown = [];
  while (pending.length) {
    const name = pending.pop();
    if (reachable.has(name)) continue;
    const file = files.get(name);
    if (!file) {
      unknown.push(name);
      continue;
    }
    const ast = parseGalaxy(file.text, file.fileName);
    if (ast.parseDiagnostics?.length) {
      unknown.push(name);
      continue;
    }
    reachable.set(name, { fileName: file.fileName, sha256: sha(file.text) });
    for (const n of ast.statements ?? [])
      if (n.kind === K.IncludeStatement) {
        const value = (n.path.value ?? n.path.text ?? '').replaceAll('"', '');
        if (!value.includes(':') && !value.split(/[\\/]/u).includes('..'))
          pending.push(alias(value));
      }
  }
  // A generated header may load natives before NativeLib. This is safe only
  // when NativeLib itself begins by loading that EXACT leaf and its complete
  // raw include graph contains declarations/compile-time literals only.
  const rootAst = parseGalaxy(root.text, root.fileName);
  const first = rootAst.statements[0];
  const nativePrefix =
    first?.kind === K.IncludeStatement &&
    alias((first.path.value ?? first.path.text ?? '').replaceAll('"', '')) ===
      'triggerlibs/natives';
  const declarationOnlyGraph = (start) => {
    const seen = new Set(),
      queue = [start],
      constants = new Map();
    while (queue.length) {
      const name = queue.pop();
      if (seen.has(name)) continue;
      seen.add(name);
      const file = files.get(name);
      if (!file) return false;
      const ast = parseGalaxy(file.text, file.fileName);
      if (ast.parseDiagnostics.length) return false;
      for (const n of ast.statements) {
        if (n.kind === K.IncludeStatement) {
          const value = (n.path.value ?? n.path.text ?? '').replaceAll('"', '');
          if (value.includes(':') || value.split(/[\\/]/u).includes('..')) return false;
          queue.push(alias(value));
        } else if (n.kind === K.VariableDeclaration) {
          if (!n.modifiers?.some((m) => m.kind === K.ConstKeyword) || constants.has(n.name.name))
            return false;
          constants.set(n.name.name, n);
        } else if (
          ![
            K.FunctionDeclaration,
            K.StructDeclaration,
            K.TypedefDeclaration,
            K.EmptyStatement,
          ].includes(n.kind)
        )
          return false;
      }
    }
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
      ].map((k) => K[k]),
    );
    const pure = (n, visiting) => {
      if (!n) return false;
      if (
        [K.NumericLiteral, K.StringLiteral, K.TrueKeyword, K.FalseKeyword, K.NullKeyword].includes(
          n.kind,
        )
      )
        return true;
      if (n.kind === K.ParenthesizedExpression) return pure(n.expression, visiting);
      if (n.kind === K.PrefixUnaryExpression)
        return (
          [K.PlusToken, K.MinusToken, K.TildeToken, K.ExclamationToken].includes(
            n.operator?.kind,
          ) && pure(n.operand, visiting)
        );
      if (n.kind === K.BinaryExpression)
        return (
          binary.has(n.operatorToken?.kind) && pure(n.left, visiting) && pure(n.right, visiting)
        );
      if (n.kind === K.Identifier) {
        const d = constants.get(n.name);
        return !!d && !visiting.has(n.name) && pure(d.initializer, new Set([...visiting, n.name]));
      }
      return false;
    };
    return [...constants].every(([name, n]) => pure(n.initializer, new Set([name])));
  };
  const prefixLeafSafe =
    nativePrefix &&
    source.statements.some(
      (n) =>
        n.kind === K.IncludeStatement &&
        alias((n.path.value ?? n.path.text ?? '').replaceAll('"', '')) === 'triggerlibs/nativelib',
    ) &&
    declarationOnlyGraph('triggerlibs/natives');
  let nativeSeen = false;
  const notes = [];
  const statements = source.statements.filter((n) => {
    if (n.kind !== K.IncludeStatement) return true;
    const value = (n.path.value ?? n.path.text ?? '').replaceAll('"', ''),
      name = alias(value);
    if (name === 'triggerlibs/nativelib') {
      if (nativeSeen) {
        notes.push({
          rule: 'SAME_VERIFIED_NATIVE_SOURCE_INCLUDED_ONCE',
          path: value,
          sha256: nativeProof.sha256,
        });
        return false;
      }
      nativeSeen = true;
      return true;
    }
    if (!nativeSeen && name === 'triggerlibs/natives' && prefixLeafSafe) {
      notes.push({
        rule: 'VERIFIED_DECLARATION_ONLY_NATIVE_PREFIX_LEAF',
        path: value,
        source: reachable.get(name),
      });
      return false;
    }
    if (nativeSeen && reachable.has(name)) {
      notes.push({
        rule: 'ALREADY_LOADED_THROUGH_VERIFIED_NATIVE_SOURCE',
        path: value,
        source: reachable.get(name),
      });
      return false;
    }
    return true;
  });
  return {
    source: { ...source, statements },
    notes,
    proof: {
      effectiveNativeSha256: nativeProof.sha256,
      reachable: [...reachable].map(([path, data]) => ({ path, ...data })),
      unresolvedGraphLeaves: unknown,
    },
  };
}

// A function delta allocates new GUI call IDs. Prove that only private compiler
// AUTOVAR bindings changed spelling/order, using the actual loaded templates.
// This is an AST comparison view, never a source/GUI rewrite or API substitution.
import { isDeepStrictEqual } from 'node:util';
import { deriveNativeLoopTemplateMatcher } from './native-loop-template-matcher.mjs';
import { SyntaxKind as K, forEachChild } from './index-alternate-3.js';
const ignored = new Set([
  'parent',
  'pos',
  'end',
  'line',
  'char',
  'syntaxTokens',
  'symbol',
  'locals',
  'flowNode',
]);
function shape(n) {
  while (n?.kind === K.ParenthesizedExpression) n = n.expression;
  if (!n || typeof n !== 'object') return n;
  if (Array.isArray(n)) return n.map(shape);
  return Object.fromEntries(
    Object.keys(n)
      .filter((k) => !ignored.has(k))
      .sort()
      .map((k) => [k, shape(n[k])]),
  );
}
function visit(n, fn) {
  if (!n) return;
  if (Array.isArray(n)) {
    n.forEach((c) => visit(c, fn));
    return;
  }
  fn(n);
  forEachChild(n, (c) => visit(c, fn));
}
const compilerName = (n) => typeof n === 'string' && /^auto[A-F\d]{8}_[A-Za-z_]\w*$/iu.test(n);
function matches(fn, matcher) {
  const out = [];
  visit(fn.body, (n) => {
    if (n.kind !== K.Block) return;
    const list = Array.from(n.statements);
    for (let i = 0; i < list.length; i++)
      for (const m of matcher.matchesAt(list, i)) {
        const automatic = m.captures.filter((c) => c.kind === 'AUTOVAR');
        if (
          !automatic.length ||
          automatic.some((c) => c.value.kind !== K.Identifier || !compilerName(c.value.name))
        )
          continue;
        const meaningful = m.captures
          .filter((c) => c.kind !== 'AUTOVAR')
          .map((c) => [c.kind + ':' + c.name, shape(c.value)])
          .sort(([a], [b]) => a.localeCompare(b));
        out.push({ ...m, automatic, meaningful, nodes: list.slice(m.start, m.end) });
      }
  });
  return out;
}
function privateBindings(fn, rows, names) {
  const declarations = new Map(),
    regions = new Set();
  for (const row of rows) for (const n of row.nodes) regions.add(n);
  for (const n of fn.body.statements)
    if (n.kind === K.VariableDeclaration && names.has(n.name.name)) {
      if (n.initializer != null || declarations.has(n.name.name)) return;
      declarations.set(n.name.name, n);
    }
  if (
    declarations.size !== names.size ||
    Array.from(fn.parameters ?? []).some((p) => names.has(p.name.name))
  )
    return;
  let valid = true;
  for (const row of rows)
    for (const c of row.captures)
      if (c.kind !== 'AUTOVAR')
        visit(c.value, (n) => {
          if (n.kind === K.Identifier && names.has(n.name)) valid = false;
        });
  function scan(n, inside = false) {
    if (!n) return;
    if (regions.has(n)) inside = true;
    if (n.kind === K.VariableDeclaration && declarations.get(n.name.name) === n) return;
    if (n.kind === K.Identifier && names.has(n.name) && !inside) valid = false;
    forEachChild(n, (c) => scan(c, inside));
  }
  scan(fn.body);
  return valid ? declarations : undefined;
}
export function normalizePrivateTemplateCompilerLocalsPair(
  before,
  after,
  { nativeLibrary, macros },
) {
  const unchanged = { before, after, records: [], qualified: false };
  if (!before?.body || !after?.body || before.name.name !== after.name.name) return unchanged;
  const matcher = deriveNativeLoopTemplateMatcher(nativeLibrary, { macros }),
    left = matches(before, matcher),
    right = matches(after, matcher);
  const mapping = new Map(),
    sourceNames = new Set(),
    selectedLeft = [],
    selectedRight = [];
  for (const a of left) {
    const equal = (m) =>
      m.templateId === a.templateId && isDeepStrictEqual(m.meaningful, a.meaningful);
    const candidates = right.filter(equal);
    if (candidates.length !== 1 || left.filter(equal).length !== 1) return unchanged;
    const b = candidates[0],
      from = new Map(a.automatic.map((c) => [c.name, c.value.name])),
      to = new Map(b.automatic.map((c) => [c.name, c.value.name]));
    if (from.size !== to.size || from.size !== a.automatic.length || to.size !== b.automatic.length)
      return unchanged;
    for (const [slot, name] of from) {
      const actual = to.get(slot);
      if (!actual || (mapping.has(actual) && mapping.get(actual) !== name)) return unchanged;
      mapping.set(actual, name);
      sourceNames.add(name);
    }
    selectedLeft.push(a);
    selectedRight.push(b);
  }
  if (!mapping.size || sourceNames.size !== mapping.size || selectedRight.length !== right.length)
    return unchanged;
  const a = privateBindings(before, selectedLeft, sourceNames),
    b = privateBindings(after, selectedRight, new Set(mapping.keys()));
  if (!a || !b) return unchanged;
  for (const [actual, expected] of mapping) {
    const withoutName = (n) =>
      shape(Object.fromEntries(Object.entries(n).filter(([k]) => k !== 'name')));
    if (!isDeepStrictEqual(withoutName(a.get(expected)), withoutName(b.get(actual))))
      return unchanged;
  }
  // A target spelling must not capture an unrelated actual binding/reference.
  const actualNames = new Set(mapping.keys());
  let collision = false;
  visit(after, (n) => {
    if (n.kind === K.Identifier && sourceNames.has(n.name) && !actualNames.has(n.name))
      collision = true;
  });
  if (collision) return unchanged;
  const aa = shape(before),
    bb = shape(after);
  visit(bb, (n) => {
    if (n.kind === K.Identifier && mapping.has(n.name)) n.name = mapping.get(n.name);
  });
  function order(fn, names) {
    const compiler = [],
      other = [];
    for (const n of fn.body.statements)
      (n.kind === K.VariableDeclaration && names.has(n.name.name) ? compiler : other).push(n);
    compiler.sort((x, y) => x.name.name.localeCompare(y.name.name));
    fn.body.statements = [...compiler, ...other];
  }
  order(aa, sourceNames);
  order(bb, sourceNames);
  return {
    before: aa,
    after: bb,
    qualified: true,
    records: [
      {
        kind: 'PRIVATE_LOADED_TEMPLATE_COMPILER_LOCALS',
        bindings: [...mapping].map(([from, to]) => ({ from, to })),
        templates: selectedLeft.map((m) => m.templateId),
        noEscapingReadsOrWrites: true,
        declarationsUninitializedAndTypesExact: true,
        sourceOrGuiWritten: false,
      },
    ],
  };
}

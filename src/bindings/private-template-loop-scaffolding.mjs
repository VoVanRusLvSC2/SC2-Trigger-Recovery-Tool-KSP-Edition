// A loaded template may own compiler temporaries regardless of their spelling.
// Retain authored variables whenever a read escapes the proved template regions.
export function privateTemplateLoopScaffolding({
  nodes,
  index,
  ctx,
  names,
  types,
  userBody,
  input,
  symbolIndex,
  templates,
  K,
  forEachChild,
}) {
  if (
    new Set(names).size !== names.length ||
    names.some((n) => typeof n !== 'string' || !n) ||
    !ctx.structuredFunctionStatements
  )
    return false;
  const full = ctx.structuredFunctionStatements,
    whole = symbolIndex(full),
    selected = new Set(names);
  for (let i = 0; i < names.length; i++) {
    const name = names[i],
      id = ctx.localVarByGalaxyName.get(name),
      variable = id ? ctx.elements[id] : undefined,
      declaration = whole.declarations.get(name);
    if (
      variable?.type !== 'Variable' ||
      variable.variableType?.type !== types[i] ||
      variable.isArray ||
      variable.isConstant ||
      !declaration ||
      declaration.initializer
    )
      return false;
  }
  const mentions = (n) => {
    let found = false;
    visit(n, (x) => {
      if (x.kind === K.Identifier && selected.has(x.name)) found = true;
    });
    return found;
  };
  function visit(n, fn) {
    if (!n) return;
    if (Array.isArray(n)) {
      for (const c of n) visit(c, fn);
      return;
    }
    fn(n);
    forEachChild(n, (c) => visit(c, fn));
  }
  if (mentions(userBody) || mentions(input)) return false;
  let shadowed = false;
  visit(full, (n) => {
    if (
      n.kind === K.VariableDeclaration &&
      selected.has(n.name?.name) &&
      whole.declarations.get(n.name.name) !== n
    )
      shadowed = true;
  });
  if (shadowed) return false;
  const regions = new Set();
  let currentOwned = false;
  function scan(statements) {
    for (let i = 0; i < statements.length; i++)
      for (const m of templates.matchesAt(statements, i)) {
        const automatic = new Set(
          m.captures
            .filter((c) => c.kind === 'AUTOVAR' && c.value?.kind === K.Identifier)
            .map((c) => c.value.name),
        );
        if (
          !names.every((n) => automatic.has(n)) ||
          m.captures.some((c) => c.kind !== 'AUTOVAR' && mentions(c.value))
        )
          continue;
        for (const s of statements.slice(m.start, m.end)) regions.add(s);
      }
  }
  // Scan each statement list once; AST objects retain their original identity.
  scan(full);
  visit(full, (n) => {
    if (n.kind === K.Block) scan(n.statements);
  });
  // Callers provide the first assignment index, not the loop index.
  for (const m of templates.matchesAt(nodes, index + 2))
    if (m.start === index && m.end === index + 3) {
      const automatic = new Set(
        m.captures
          .filter((c) => c.kind === 'AUTOVAR' && c.value?.kind === K.Identifier)
          .map((c) => c.value.name),
      );
      if (
        names.every((n) => automatic.has(n)) &&
        !m.captures.some((c) => c.kind !== 'AUTOVAR' && mentions(c.value))
      )
        currentOwned = true;
    }
  if (!currentOwned) return false;
  const roots = [];
  function collect(n) {
    if (!n) return;
    if (Array.isArray(n)) {
      for (const c of n) collect(c);
      return;
    }
    if (regions.has(n)) {
      roots.push(n);
      return;
    }
    forEachChild(n, collect);
  }
  collect(full);
  const owned = symbolIndex(roots);
  return names.every((n) => whole.uses.get(n) === owned.uses.get(n));
}

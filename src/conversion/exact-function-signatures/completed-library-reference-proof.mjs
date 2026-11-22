// Prove only embedded startup calls whose source guards and callers are visible.

import { SyntaxKind as K } from './index-alternate-3.js';

function walk(n, fn) {
  if (!n || typeof n !== 'object') return;
  if (Array.isArray(n)) {
    n.forEach((x) => walk(x, fn));
    return;
  }
  fn(n);
  for (const k of Object.keys(n))
    if (k !== 'parent' && n[k] && typeof n[k] === 'object') walk(n[k], fn);
}

const unparen = (n) => (n?.kind === K.ParenthesizedExpression ? unparen(n.expression) : n);

// All startup proofs inspect the same source. Literal substring matches
// and references outside the explicitly allowed nodes still count as escapes.
function sourceEscapes(source) {
  let identifiers;
  const literals = new Set();
  return (name, allowed) => {
    if (!identifiers) {
      identifiers = new Map();
      walk(source, (node) => {
        if (node.kind === K.Identifier) {
          let uses = identifiers.get(node.name);
          if (!uses) identifiers.set(node.name, (uses = []));
          uses.push(node);
        } else if (node.kind === K.StringLiteral && node.value != null) {
          literals.add(node.value);
        }
      });
    }
    if (identifiers.get(name)?.some((node) => !allowed.has(node))) return true;
    for (const literal of literals) if (literal.includes(name)) return true;
    return false;
  };
}

function guardedRoot(source, id, escapes) {
  const name = `lib${id}_InitLib`,
    defs = source.statements.filter(
      (n) => n.kind === K.FunctionDeclaration && n.name.name === name && n.body,
    );

  if (defs.length !== 1) return;

  const f = defs[0],
    body = f.body.statements;
  if (f.parameters.length || f.type.kind !== K.VoidKeyword || body.length < 2) return;

  const g = body[0],
    set = body[1]?.kind === K.ExpressionStatement ? body[1].expression : undefined;

  const flag = unparen(g.expression),
    branch = g.thenStatement?.kind === K.Block ? g.thenStatement.statements : [];

  if (
    g.kind !== K.IfStatement ||
    g.elseStatement ||
    flag?.kind !== K.Identifier ||
    branch.length !== 1 ||
    branch[0].kind !== K.ReturnStatement ||
    branch[0].expression
  )
    return;

  if (
    set?.kind !== K.BinaryExpression ||
    set.operatorToken.kind !== K.EqualsToken ||
    set.left.kind !== K.Identifier ||
    set.left.name !== flag.name ||
    unparen(set.right)?.kind !== K.TrueKeyword
  )
    return;

  const vars = source.statements.filter(
    (n) => n.kind === K.VariableDeclaration && n.name.name === flag.name,
  );

  if (
    vars.length !== 1 ||
    vars[0].type.kind !== K.BoolKeyword ||
    unparen(vars[0].initializer)?.kind !== K.FalseKeyword
  )
    return;

  const allowed = new Set([vars[0].name, flag, set.left]);
  if (escapes(flag.name, allowed)) return;

  return { function: f, flag: flag.name };
}

function uniqueDirectCaller(source, id, escapes) {
  const name = `lib${id}_InitLib`,
    allowed = new Set(),
    matches = [];

  for (const f of source.statements.filter((n) => n.kind === K.FunctionDeclaration)) {
    if (f.name.name === name) allowed.add(f.name);

    for (const s of f.body?.statements ?? []) {
      const e = s.kind === K.ExpressionStatement ? s.expression : undefined;
      if (
        e?.kind === K.CallExpression &&
        e.expression.kind === K.Identifier &&
        e.expression.name === name &&
        e.arguments.length === 0
      ) {
        matches.push({ caller: f, statement: s });
        allowed.add(e.expression);
      }
    }
  }

  if (matches.length !== 1 || escapes(name, allowed)) return;

  return matches[0];
}

export function proveCompletedLibraryReferences(source, startedBefore) {
  const proven = new Map(),
    records = [];

  const escapes = sourceEscapes(source);
  const guards = new Map(),
    callers = new Map();
  const guardFor = (id) => {
    if (!guards.has(id)) guards.set(id, guardedRoot(source, id, escapes));
    return guards.get(id);
  };
  const callerFor = (id) => {
    if (!callers.has(id)) callers.set(id, uniqueDirectCaller(source, id, escapes));
    return callers.get(id);
  };
  for (const [target, earlier] of startedBefore) {
    if (!guardFor(target)) continue;

    const targetCall = callerFor(target);
    if (!targetCall) continue;

    const statements = targetCall.caller.body.statements,
      targetIndex = statements.indexOf(targetCall.statement),
      safe = [];

    for (const id of earlier) {
      const guard = guardFor(id),
        call = callerFor(id);

      if (
        !guard ||
        !call ||
        call.caller !== targetCall.caller ||
        statements.indexOf(call.statement) >= targetIndex
      )
        continue;

      safe.push(id);
      records.push({
        target,
        dependency: id,
        caller: call.caller.name.name,
        completionFlag: guard.flag,
        uniqueDirectCallBeforeTarget: true,
        guardFlagCannotEscapeOrReset: true,
      });
    }

    if (safe.length) proven.set(target, safe);
  }

  return { proven, records };
}

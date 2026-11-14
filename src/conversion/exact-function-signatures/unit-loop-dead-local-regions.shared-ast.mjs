// Isolate a native loop's local captures when earlier/later uses belong to
// other definitions. No observable read may see the discarded local stores.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Parser, Printer, SyntaxKind as K, forEachChild } from './index-alternate-3.js';
import { splitClosedUnitLoopLifetimes as closed } from './closed-unit-loop-lifetimes.shared-ast.mjs';
const printer = new Printer(),
  sha = (s) => createHash('sha256').update(s).digest('hex');
const walk = (n, f) => {
  if (n) {
    f(n);
    forEachChild(n, (c) => walk(c, f));
  }
};
const omit = new Set([
  'parent',
  'pos',
  'end',
  'line',
  'char',
  'symbol',
  'locals',
  'flowNode',
  'syntaxTokens',
]);
const shape = (n) =>
  !n || typeof n !== 'object'
    ? n
    : Array.isArray(n)
      ? n.map(shape)
      : Object.fromEntries(
          Object.entries(n)
            .filter(([k]) => !omit.has(k))
            .map(([k, v]) => [k, shape(v)]),
        );
const parse = (s) => {
  const ast = new Parser().parseFile('unit-loop-local-regions', s);
  assert.equal(ast.parseDiagnostics.length, 0);
  return ast;
};
const id = (n, name) => n?.kind === K.Identifier && (name === undefined || n.name === name);
const assign = (n) =>
  n?.kind === K.ExpressionStatement &&
  n.expression?.kind === K.BinaryExpression &&
  n.expression.operatorToken?.kind === K.EqualsToken
    ? n.expression
    : undefined;
const readsName = (n, name) => {
  let found = false;
  walk(n, (x) => {
    if (id(x, name)) found = true;
  });
  return found;
};
function overwrite(n, name) {
  const expression = n?.kind === K.ExpressionStatement ? n.expression : n;
  return (
    expression?.kind === K.BinaryExpression &&
    expression.operatorToken?.kind === K.EqualsToken &&
    id(expression.left, name) &&
    !readsName(expression.right, name)
  );
}
function nativeTriple(statements, index) {
  const a = assign(statements[index]),
    b = assign(statements[index + 1]),
    loop = statements[index + 2];
  if (
    !a ||
    !b ||
    !id(a.left) ||
    !id(b.left) ||
    a.left.name === b.left.name ||
    loop?.kind !== K.ForStatement ||
    loop.initializer ||
    loop.condition ||
    loop.statement?.kind !== K.Block
  )
    return;
  const group = a.left.name,
    counter = b.left.name,
    count = b.right,
    inc = loop.incrementor,
    body = loop.statement.statements;
  if (
    count?.kind !== K.CallExpression ||
    !id(count.expression, 'UnitGroupCount') ||
    count.arguments.length !== 2 ||
    !id(count.arguments[0], group) ||
    !id(count.arguments[1], 'c_unitCountAll')
  )
    return;
  if (
    inc?.kind !== K.BinaryExpression ||
    inc.operatorToken?.kind !== K.MinusEqualsToken ||
    !id(inc.left, counter) ||
    inc.right?.kind !== K.NumericLiteral ||
    inc.right.text !== '1'
  )
    return;
  const picked = assign(body[0]),
    call = picked?.right,
    guard = body[1],
    condition = guard?.expression;
  if (
    !picked ||
    call?.kind !== K.CallExpression ||
    !id(call.expression, 'UnitGroupUnitFromEnd') ||
    call.arguments.length !== 2 ||
    !id(call.arguments[0], group) ||
    !id(call.arguments[1], counter)
  )
    return;
  if (
    guard?.kind !== K.IfStatement ||
    guard.elseStatement ||
    condition?.kind !== K.BinaryExpression ||
    condition.operatorToken?.kind !== K.EqualsEqualsToken ||
    printer.printNode(condition.left) !== printer.printNode(picked.left) ||
    condition.right?.kind !== K.NullKeyword ||
    guard.thenStatement?.kind !== K.Block ||
    guard.thenStatement.statements.length !== 1 ||
    guard.thenStatement.statements[0].kind !== K.BreakStatement
  )
    return;
  return { a, b, loop, inc, picked, group, counter };
}
function deadAfter(statement, name, fn) {
  let current = statement;
  for (let depth = 0; depth < 128; depth++) {
    const parent = current.parent;
    if (parent?.kind === K.Block) {
      const index = parent.statements.indexOf(current);
      if (index < 0) return;
      for (const next of parent.statements.slice(index + 1)) {
        if (overwrite(next, name)) return { kind: 'GUARANTEED_OVERWRITE', position: next.pos };
        if (next.kind === K.ForStatement && overwrite(next.initializer, name))
          return { kind: 'FOR_INITIALIZER_OVERWRITE', position: next.initializer.pos };
        if (readsName(next, name)) return;
        if (next.kind === K.ReturnStatement) return { kind: 'FUNCTION_RETURN', position: next.pos };
        if ([K.BreakStatement, K.ContinueStatement].includes(next.kind)) return;
      }
      if (parent === fn.body) return { kind: 'FUNCTION_EXIT', position: parent.end };
      current = parent;
      continue;
    }
    if (
      parent?.kind === K.IfStatement &&
      (parent.thenStatement === current || parent.elseStatement === current)
    ) {
      current = parent;
      continue;
    }
    // Loop backedges, switch fallthrough and unmodelled control flow are refused.
    return;
  }
}
function isolateDeadRegions(source, document) {
  const ast = document ? document.input(source) : parse(source),
    allNames = new Set(),
    edits = [],
    records = [],
    refused = [],
    renames = new Map(),
    additions = new Map();
  walk(ast, (n) => {
    if (n.kind === K.Identifier) allNames.add(n.name);
  });
  for (const fn of ast.statements.filter((n) => n.kind === K.FunctionDeclaration && n.body)) {
    const declarations = new Map(),
      triples = [],
      added = [];
    walk(fn.body, (n) => {
      if (n.kind === K.VariableDeclaration) {
        const name = n.name.name;
        declarations.set(name, [...(declarations.get(name) ?? []), n]);
      }
      if (n.kind === K.Block)
        for (let i = 0; i < n.statements.length - 2; i++) {
          const t = nativeTriple(n.statements, i);
          if (t) triples.push(t);
        }
    });
    const entry = new Set();
    for (const n of fn.body.statements) {
      if (n.kind !== K.VariableDeclaration) break;
      entry.add(n);
    }
    for (const t of triples) {
      const ds = [declarations.get(t.group), declarations.get(t.counter)];
      if (
        ds.some((d) => d?.length !== 1) ||
        !ds.every((d) => entry.has(d[0])) ||
        printer.printNode(ds[0][0].type) !== 'unitgroup' ||
        printer.printNode(ds[1][0].type) !== 'int' ||
        ds.some((d) => d[0].modifiers?.length)
      )
        continue;
      if (/^auto[0-9a-f]{8}_g$/iu.test(t.group) && /^auto[0-9a-f]{8}_u$/iu.test(t.counter))
        continue;
      let ancestor = t.loop.parent,
        inLoop = false;
      while (ancestor && ancestor !== fn) {
        if ([K.ForStatement, K.WhileStatement, K.DoStatement].includes(ancestor.kind))
          inLoop = true;
        ancestor = ancestor.parent;
      }
      if (inLoop) continue;
      const names = new Set([t.group, t.counter]),
        permitted = new Set();
      for (const n of [t.b, t.inc, t.picked.right])
        walk(n, (x) => {
          if (x.kind === K.Identifier && names.has(x.name)) permitted.add(x);
        });
      let escape = false;
      walk(t.loop, (n) => {
        if (n.kind === K.Identifier && names.has(n.name) && !permitted.has(n)) escape = true;
      });
      if (escape || [...names].some((name) => readsName(t.a.right, name))) continue;
      const groupDeath = deadAfter(t.loop, t.group, fn),
        counterDeath = deadAfter(t.loop, t.counter, fn);
      if (!groupDeath || !counterDeath) {
        refused.push({
          function: fn.name.name,
          group: t.group,
          counter: t.counter,
          sourcePosition: t.a.pos,
          reason: 'LOCAL_VALUE_MAY_BE_OBSERVED_AFTER_LOOP',
        });
        continue;
      }
      let salt = 0,
        prefix;
      do {
        prefix =
          'auto' +
          sha(fn.name.name + ':region:' + t.a.pos + ':' + salt++)
            .slice(0, 8)
            .toUpperCase();
      } while (allNames.has(prefix + '_g') || allNames.has(prefix + '_u'));
      const mapping = new Map([
        [t.group, prefix + '_g'],
        [t.counter, prefix + '_u'],
      ]);
      for (const name of mapping.values()) allNames.add(name);
      for (const n of [t.a.left, t.b, t.inc, t.picked.right])
        walk(n, (x) => {
          if (x.kind === K.Identifier && mapping.has(x.name)) {
            assert(!renames.has(x));
            renames.set(x, mapping.get(x.name));
            edits.push({ start: x.pos, end: x.pos + x.name.length, text: mapping.get(x.name) });
          }
        });
      added.push('unitgroup ' + prefix + '_g;', 'int ' + prefix + '_u;');
      records.push({
        function: fn.name.name,
        sourcePosition: t.a.pos,
        group: t.group,
        counter: t.counter,
        newGroup: prefix + '_g',
        newCounter: prefix + '_u',
        groupDeath,
        counterDeath,
        loopBindingUsesClosed: true,
        nativeCallsAndTheirOrderPreserved: true,
      });
    }
    if (added.length) {
      additions.set(fn, parse('void F(){' + added.join('\n') + '}').statements[0].body.statements);
      edits.push({
        start: fn.body.pos + 1,
        end: fn.body.pos + 1,
        text: '\n' + added.join('\n') + '\n',
      });
    }
  }
  edits.sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < edits.length; i++)
    assert(edits[i - 1].end <= edits[i].start, 'DEAD_UNIT_REGION_OVERLAP');
  let text = source;
  for (const e of [...edits].reverse()) text = text.slice(0, e.start) + e.text + text.slice(e.end);
  function expected(n) {
    if (!n || typeof n !== 'object') return n;
    if (Array.isArray(n)) return n.map(expected);
    const out = Object.fromEntries(
      Object.entries(n)
        .filter(([k]) => !omit.has(k))
        .map(([k, v]) => [k, expected(v)]),
    );
    if (renames.has(n)) out.name = renames.get(n);
    if (additions.has(n))
      out.body.statements = [...shape(additions.get(n)), ...out.body.statements];
    return out;
  }
  assert.deepEqual(
    shape((document ? document.output(text) : parse(text)).statements),
    expected(ast.statements),
    'DEAD_UNIT_REGION_OTHER_AST_CHANGED',
  );
  return {
    text,
    proof: {
      kind: 'TYPED_UNIT_LOOP_DEAD_LOCAL_REGIONS',
      sourceSha256: sha(source),
      outputSha256: sha(text),
      records,
      refused,
      changed: edits.length > 0,
      newRuntimeFunctions: 0,
      sourceOrArchiveChanged: false,
      persistentCache: false,
    },
  };
}
export function splitClosedUnitLoopLifetimes(source, document) {
  const base = closed(source, document),
    regions = isolateDeadRegions(base.text, document?.forRevision(base.text));
  return {
    text: regions.text,
    proof: {
      kind: 'CLOSED_TYPED_UNIT_LOOP_CAPTURE_LIFETIMES_AND_DEAD_REGIONS',
      sourceSha256: sha(source),
      outputSha256: sha(regions.text),
      changed: base.proof.changed || regions.proof.changed,
      records: [...base.proof.records, ...regions.proof.records],
      closedFunctionPhase: base.proof,
      deadRegionPhase: regions.proof,
      sourceOrArchiveChanged: false,
      wholeMapAccepted: false,
      persistentCache: false,
    },
  };
}

// Lower standalone &=, |= and ^= only for a uniquely bound mutable local int
// or int parameter. Such a scalar cannot be mutated by an invoked function:
// Galaxy calls do not capture the caller's locals or pass scalar references.
// Preserve the entire RHS once; never duplicate an indexed/member lvalue.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Parser, SyntaxKind as K } from './index-alternate-3.js';
const sha = (t) => createHash('sha256').update(t).digest('hex');
const skipped = new Set(['parent', 'syntaxTokens', 'symbol', 'locals', 'flowNode']);
function walk(n, fn) {
  if (!n || typeof n !== 'object') return;
  if (Array.isArray(n)) {
    for (const c of n) walk(c, fn);
    return;
  }
  fn(n);
  for (const [k, v] of Object.entries(n)) if (!skipped.has(k)) walk(v, fn);
}
function add(map, n) {
  if (n.name?.name) {
    const xs = map.get(n.name.name) ?? [];
    xs.push(n);
    map.set(n.name.name, xs);
  }
}
const operators = new Map([
  [K.AmpersandEqualsToken, '&'],
  [K.BarEqualsToken, '|'],
  [K.CaretEqualsToken, '^'],
]);
const intBinary = new Set([
  K.PlusToken,
  K.MinusToken,
  K.AsteriskToken,
  K.SlashToken,
  K.PercentToken,
  K.LessThanLessThanToken,
  K.GreaterThanGreaterThanToken,
  K.AmpersandToken,
  K.BarToken,
  K.CaretToken,
]);
assert(
  [...operators.keys(), ...intBinary].every(Number.isInteger),
  'UNKNOWN_BITWISE_OPERATOR_KIND',
);
export function lowerScalarBitwiseAssignments(source, declarations = [], document) {
  const ast = document
    ? document.input(source)
    : new Parser().parseFile('bitwise-assignment-input.galaxy', source);
  assert.equal(ast.parseDiagnostics.length, 0, 'INVALID_SOURCE');
  const roots = new Map(),
    functions = new Map(),
    contexts = [],
    wantedCalls = new Set(),
    declarationInputs = [];
  const signature = (n, text) =>
    JSON.stringify({
      returnType: n.type?.kind,
      parameters: (n.parameters ?? []).map((p) =>
        text
          .slice(p.type.pos, p.type.end)
          .replace(/\/\/[^\r\n]*/gu, '')
          .replace(/\s+/gu, ''),
      ),
    });
  function addFunctions(tree, text, label) {
    for (const f of tree.statements.filter((n) => n.kind === K.FunctionDeclaration)) {
      if (!f.name?.name) continue;
      const records = functions.get(f.name.name) ?? [];
      records.push({
        returnType: f.type?.kind,
        arity: f.parameters?.length ?? 0,
        signature: signature(f, text),
        source: label,
        position: f.pos,
      });
      functions.set(f.name.name, records);
    }
  }
  addFunctions(ast, source, 'owned-source');
  for (const n of ast.statements) if (n.kind === K.VariableDeclaration) add(roots, n);
  for (const fn of ast.statements.filter((n) => n.kind === K.FunctionDeclaration && n.body)) {
    const locals = new Map();
    for (const p of fn.parameters ?? []) add(locals, p);
    walk(fn.body, (n) => {
      if (n.kind === K.VariableDeclaration) add(locals, n);
    });
    walk(fn.body, (stmt) => {
      const e = stmt.kind === K.ExpressionStatement ? stmt.expression : null;
      if (
        e?.kind !== K.BinaryExpression ||
        !operators.has(e.operatorToken.kind) ||
        e.left.kind !== K.Identifier
      )
        return;
      const matches = locals.get(e.left.name);
      if (matches?.length !== 1) return;
      const b = matches[0];
      if (
        b.type?.kind !== K.IntKeyword ||
        (b.modifiers ?? []).some((m) => m.kind === K.ConstKeyword)
      )
        return;
      if (b.kind === K.VariableDeclaration && (!fn.body.statements.includes(b) || b.pos >= e.pos))
        return;
      contexts.push({ fn, locals, e, b });
      walk(e.right, (n) => {
        if (n.kind === K.CallExpression && n.expression?.kind === K.Identifier)
          wantedCalls.add(n.expression.name);
      });
    });
  }
  // Only parse declaration files which could supply a called RHS return type.
  // This is a per-operation scan, with no persistent cache or named-call rule.
  for (const d of declarations) {
    assert(
      typeof d.text === 'string' && typeof d.fileName === 'string',
      'INVALID_DECLARATION_INPUT',
    );
    if (![...wantedCalls].some((name) => d.text.includes(name))) continue;
    const tree = new Parser().parseFile(d.fileName, d.text);
    declarationInputs.push({
      fileName: d.fileName,
      sha256: sha(d.text),
      parseErrors: tree.parseDiagnostics.length,
    });
    if (tree.parseDiagnostics.length === 0) addFunctions(tree, d.text, d.fileName);
  }
  function scalar(n, c) {
    const own = c.locals.get(n.name),
      xs = own ?? roots.get(n.name);
    if (xs?.length !== 1) return;
    const b = xs[0];
    if (b.type?.kind !== K.IntKeyword) return;
    if (
      own &&
      b.kind === K.VariableDeclaration &&
      (!c.fn.body.statements.includes(b) || b.pos >= c.e.pos)
    )
      return;
    if (!own && b.pos >= c.e.pos) return;
    return { kind: 'scalar-int', name: n.name, scope: own ? 'caller-local' : 'owned-global' };
  }
  function proveRhs(n, c, depth = 0) {
    if (!n || depth > 64) return;
    if (n.kind === K.ParenthesizedExpression) return proveRhs(n.expression, c, depth + 1);
    if (n.kind === K.Identifier) return scalar(n, c);
    if (n.kind === K.NumericLiteral) {
      const text = String(n.text ?? n.value);
      if (text.length > 32 || !/^(?:0[xX][0-9a-fA-F]+|0[0-7]*|[1-9][0-9]*)$/u.test(text)) return;
      const value = BigInt(/^0[0-7]+$/u.test(text) ? '0o' + text.slice(1) : text);
      return value <= 2147483647n ? { kind: 'int-literal', value: value.toString() } : undefined;
    }
    if (
      n.kind === K.PrefixUnaryExpression &&
      [K.PlusToken, K.MinusToken, K.TildeToken].includes(n.operator.kind)
    ) {
      const operand = proveRhs(n.operand, c, depth + 1);
      return operand && { kind: 'int-unary', operator: K[n.operator.kind], operand };
    }
    if (n.kind === K.BinaryExpression && intBinary.has(n.operatorToken.kind)) {
      const left = proveRhs(n.left, c, depth + 1),
        right = proveRhs(n.right, c, depth + 1);
      return (
        left && right && { kind: 'int-binary', operator: K[n.operatorToken.kind], left, right }
      );
    }
    if (n.kind === K.CallExpression && n.expression?.kind === K.Identifier) {
      const name = n.expression.name;
      if (c.locals.has(name) || roots.has(name)) return;
      const fs = functions.get(name);
      if (
        !fs?.length ||
        fs.some((f) => f.returnType !== K.IntKeyword || f.arity !== n.arguments.length) ||
        new Set(fs.map((f) => f.signature)).size !== 1
      )
        return;
      if (!fs.some((f) => f.source !== 'owned-source' || f.position < n.pos)) return;
      return { kind: 'declared-int-call', name, arity: n.arguments.length, declarations: fs };
    }
  }
  const edits = [];
  for (const c of contexts) {
    const rhsProof = proveRhs(c.e.right, c);
    if (!rhsProof) continue;
    const name = c.e.left.name,
      op = operators.get(c.e.operatorToken.kind);
    assert.equal(
      source.slice(c.e.left.pos, c.e.left.pos + name.length),
      name,
      'INVALID_TARGET_TOKEN_RANGE',
    );
    assert.equal(
      source.slice(c.e.operatorToken.pos, c.e.operatorToken.pos + 2),
      op + '=',
      'INVALID_ASSIGNMENT_TOKEN_RANGE',
    );
    const lhsTrivia = source.slice(c.e.left.pos + name.length, c.e.operatorToken.pos);
    const rhs =
      source.slice(c.e.operatorToken.pos + 2, c.e.right.pos) +
      source.slice(c.e.right.pos, c.e.right.end);
    const replacement = `${name}${lhsTrivia}= (${name} ${op} (${rhs}${rhs.includes('//') ? '\n' : ''}))`;
    edits.push({
      start: c.e.pos,
      end: c.e.end,
      before: source.slice(c.e.pos, c.e.end),
      replacement,
      function: c.fn.name.name,
      target: name,
      targetType: 'int',
      binding: c.b.kind === K.ParameterDeclaration ? 'parameter' : 'entry-local',
      rhsProof,
      rhsEvaluations: 1,
      implicitTargetReads: 1,
      targetWrites: 1,
      targetCannotBeMutatedThroughRhsCalls: true,
      callOrderAndOperandOperationsPreserved: true,
    });
  }
  edits.sort((a, b) => a.start - b.start);
  for (let i = 1; i < edits.length; i++)
    assert(edits[i - 1].end <= edits[i].start, 'OVERLAPPING_BITWISE_ASSIGNMENTS');
  let text = source;
  for (const e of [...edits].reverse()) {
    assert.equal(text.slice(e.start, e.end), e.before);
    text = text.slice(0, e.start) + e.replacement + text.slice(e.end);
  }
  assert.equal(
    (document
      ? document.output(text)
      : new Parser().parseFile('bitwise-assignment-output.galaxy', text)
    ).parseDiagnostics.length,
    0,
    'INVALID_LOWERED_SOURCE',
  );
  return {
    text,
    proof: {
      kind: 'MUTABLE_LOCAL_INT_COMPOUND_BITWISE_ASSIGNMENT',
      sourceSha256: sha(source),
      outputSha256: sha(text),
      changed: edits.length > 0,
      edits,
      declarationInputs,
      noPersistentCache: true,
      noGlobalArrayMemberByteOrUnknownTargets: true,
      sourceOrArchivesChanged: false,
    },
  };
}

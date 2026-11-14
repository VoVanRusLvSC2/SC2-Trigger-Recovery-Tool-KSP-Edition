// Converter-input lowering only. Retain original source for all comparisons.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Parser, SyntaxKind as K } from './index-alternate-3.js';
const hash = (t) => createHash('sha256').update(t).digest('hex');
export function lowerScalarShiftAssignments(source, document) {
  const ast = document
    ? document.input(source)
    : new Parser().parseFile('shift-input.galaxy', source);
  assert.equal(ast.parseDiagnostics.length, 0);
  const edits = [],
    records = [];
  const walk = (n, f) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      n.forEach((x) => walk(x, f));
      return;
    }
    f(n);
    for (const [k, v] of Object.entries(n)) if (k !== 'parent') walk(v, f);
  };
  for (const fn of ast.statements.filter((n) => n.kind === K.FunctionDeclaration && n.body)) {
    const bindings = new Map();
    const add = (n) => {
      const name = n.name?.name;
      if (!name) return;
      const list = bindings.get(name) ?? [];
      list.push(n);
      bindings.set(name, list);
    };
    (fn.parameters ?? []).forEach(add);
    walk(fn.body, (n) => {
      if (n.kind === K.VariableDeclaration) add(n);
    });
    walk(fn.body, (stmt) => {
      const e = stmt.kind === K.ExpressionStatement ? stmt.expression : null;
      if (!e || e.kind !== K.BinaryExpression) return;
      const op =
        e.operatorToken?.kind === K.GreaterThanGreaterThanEqualsToken
          ? '>>'
          : e.operatorToken?.kind === K.LessThanLessThanEqualsToken
            ? '<<'
            : null;
      if (
        !op ||
        e.left?.kind !== K.Identifier ||
        e.right?.kind !== K.NumericLiteral ||
        !/^\d+$/u.test(e.right.text ?? '')
      )
        return;
      const count = Number(e.right.text);
      if (count < 0 || count > 31) return;
      const candidates = bindings.get(e.left.name);
      if (candidates?.length !== 1) return;
      const binding = candidates[0],
        isByte = binding.type?.kind === K.ByteKeyword;
      if (
        (binding.type?.kind !== K.IntKeyword && !(isByte && op === '>>')) ||
        (binding.modifiers ?? []).some((m) => m.kind === K.ConstKeyword)
      )
        return;
      // Restrict locals to the function entry block and declaration before use.
      if (
        binding.kind === K.VariableDeclaration &&
        (!fn.body.statements.includes(binding) || binding.pos >= e.pos)
      )
        return;
      const original = source.slice(e.pos, e.end),
        name = e.left.name;
      const replacement = `${name} = (${name} ${op} ${e.right.text})`;
      edits.push({ start: e.pos, end: e.end, text: replacement });
      records.push({
        function: fn.name.name,
        target: name,
        type: isByte ? 'byte' : 'int',
        operator: op,
        count,
        original,
        replacement,
        scalarBindingUnique: true,
        rhsLiteral: true,
        targetReadOnce: true,
        targetWrittenOnce: true,
        noIndexMemberCallOrCast: true,
        byteRightShiftStaysInByteDomain: isByte,
      });
    });
  }
  edits.sort((a, b) => b.start - a.start);
  let text = source;
  for (let i = 0; i < edits.length; i++) {
    if (i) assert(edits[i].end <= edits[i - 1].start);
    const e = edits[i];
    text = text.slice(0, e.start) + e.text + text.slice(e.end);
  }
  assert.equal(
    (document ? document.output(text) : new Parser().parseFile('shift-output.galaxy', text))
      .parseDiagnostics.length,
    0,
  );
  return {
    text,
    proof: {
      originalSha256: hash(source),
      loweredSha256: hash(text),
      records,
      originalFilesChanged: false,
      scope:
        'Standalone compound shift on a unique mutable scalar int, or byte right shift; parameter or entry-block local; literal count 0..31 only',
    },
  };
}

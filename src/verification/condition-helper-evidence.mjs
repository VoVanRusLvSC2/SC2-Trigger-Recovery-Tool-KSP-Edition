import { parseImmutableGalaxySyntax as parse } from '../conversion/exact-function-signatures/immutable-galaxy-syntax.mjs';
import {
  SyntaxKind as K,
  forEachChild,
} from '../conversion/exact-function-signatures/index-alternate-3.js';
import { compareGalaxyPrograms } from '../conversion/partition-declaration-identity/index-alternate.mjs';
import { compareGalaxyText } from '../conversion/partition-declaration-identity/comparison.mjs';

const unwrap = (node) => {
  while (node?.kind === K.ParenthesizedExpression) node = node.expression;
  return node;
};
const walk = (node, fn) => {
  if (!node) return;
  fn(node);
  forEachChild(node, (child) => walk(child, fn));
};
const isReturn = (node, value) =>
  node?.kind === K.ReturnStatement && unwrap(node.expression)?.kind === value;

// Evidence only: reverse a narrow, structurally checked helper extraction and
// then run the unmodified strict comparator over the entire reconstructed file.
// This does not certify runtime stack semantics or an Editor export.
export function inspectConditionHelpers(original, generated) {
  const left = parse(original, 'original.galaxy');
  const right = parse(generated, 'generated.galaxy');
  if (left.parseDiagnostics.length || right.parseDiagnostics.length)
    throw new Error('Cannot inspect invalid Galaxy');
  const definitions = new Map();
  const identifiers = new Map();
  const stringValues = new Set();
  walk(right, (node) => {
    if (node.kind === K.Identifier)
      identifiers.set(node.name, (identifiers.get(node.name) ?? 0) + 1);
    if (node.kind === K.StringLiteral) stringValues.add(node.value);
  });
  for (const node of right.statements) {
    if (node.kind !== K.FunctionDeclaration) continue;
    const name = node.name?.name;
    if (!definitions.has(name)) definitions.set(name, []);
    definitions.get(name).push(node);
  }
  const edits = [],
    recovered = [],
    refused = [];
  for (const callback of right.statements) {
    if (
      callback.kind !== K.FunctionDeclaration ||
      !callback.body ||
      callback.type?.kind !== K.BoolKeyword
    )
      continue;
    const callbackNames = new Set(callback.parameters.map((p) => p.name.name));
    walk(callback.body, (node) => {
      if (node.kind === K.VariableDeclaration) callbackNames.add(node.name.name);
    });
    walk(callback.body, (guard) => {
      if (guard.kind !== K.IfStatement || guard.elseStatement) return;
      const expr = unwrap(guard.expression);
      if (expr?.kind !== K.PrefixUnaryExpression || expr.operator?.kind !== K.ExclamationToken)
        return;
      const call = unwrap(expr.operand);
      if (
        call?.kind !== K.CallExpression ||
        call.arguments.length ||
        call.expression?.kind !== K.Identifier
      )
        return;
      const name = call.expression.name;
      const decls = definitions.get(name) ?? [];
      const helper = decls.find((d) => d.body);
      if (!helper || helper.type?.kind !== K.BoolKeyword || helper.parameters.length) return;
      const rejection =
        guard.thenStatement?.kind === K.Block
          ? guard.thenStatement.statements
          : [guard.thenStatement];
      const body = helper.body.statements;
      if (
        rejection.length !== 1 ||
        !isReturn(rejection[0], K.FalseKeyword) ||
        !body.length ||
        !isReturn(body.at(-1), K.TrueKeyword)
      )
        return;
      let unsafe = false;
      walk(helper.body, (node) => {
        if (
          node.kind === K.VariableDeclaration ||
          (node.kind === K.Identifier && callbackNames.has(node.name)) ||
          (node.kind === K.ReturnStatement &&
            node !== body.at(-1) &&
            !isReturn(node, K.FalseKeyword))
        )
          unsafe = true;
      });
      // A helper must be referenced only by its declaration(s) and this call.
      if (
        unsafe ||
        identifiers.get(name) !== decls.length + 1 ||
        stringValues.has(name) ||
        decls.filter((d) => d.body).length !== 1
      ) {
        refused.push(name);
        return;
      }
      edits.push({
        start: guard.pos,
        end: guard.end,
        text: generated.slice(helper.body.pos + 1, body.at(-1).pos),
      });
      for (const decl of decls) edits.push({ start: decl.pos, end: decl.end, text: '' });
      recovered.push(name);
    });
  }
  edits.sort((a, b) => b.start - a.start);
  let expanded = generated,
    previous = generated.length;
  for (const edit of edits) {
    if (edit.end > previous) throw new Error('Overlapping helper edits');
    expanded = expanded.slice(0, edit.start) + edit.text + expanded.slice(edit.end);
    previous = edit.start;
  }
  const comparison = compareGalaxyPrograms(left, parse(expanded, 'expanded.galaxy'), {
    libraryId: 'Map',
    sampleLimit: 40,
  });
  const business = compareGalaxyText(original, expanded, { parseGalaxy: parse });
  return {
    helpersExpanded: recovered.length,
    helpersRefused: refused,
    strictExactAfterExpansion: comparison.exact,
    comparison,
    businessVerdictAfterExpansion: business.verdict,
    businessComparison: business.comparison,
    limitations: [
      'Static structural evidence only',
      'External libraries, dynamic invocation and runtime stack semantics are not verified',
      'Editor export and runtime context are not verified',
    ],
  };
}

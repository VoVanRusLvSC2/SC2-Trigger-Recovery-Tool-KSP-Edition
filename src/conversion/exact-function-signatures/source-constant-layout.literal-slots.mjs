import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {preserveSourceConstantLayout as base} from "./source-constant-layout.constant-prefix-alternate.mjs";
import {parseImmutableGalaxySyntax as parseSyntax} from "./immutable-galaxy-syntax.collections.mjs";
import {assertExactAstShape} from "../../verification/exact-ast-shape.mjs";
import {SyntaxKind as K} from "./index-alternate-3.js";
const sha = value => createHash('sha256').update(value).digest('hex');
const ignored = new Set(['parent', 'pos', 'end', 'line', 'char']);
const profiles = new WeakMap();
export const sourceConstantLayout = Symbol('source constant declaration layout');
export function createSourceConstantLayout({source, header = '', xml}) {
  const token = Object.freeze({kind: 'SOURCE_CONSTANT_LAYOUT', sourceSha256: sha(source), headerSha256: sha(header), xmlSha256: sha(xml), persistentCache: false});
  profiles.set(token, {source, header});return token;
}
const parse = (text, name) => {const ast = parseSyntax(text, name);assert.equal(ast.parseDiagnostics.length, 0, 'LITERAL_SLOT_SYNTAX');return ast;};
function literal(node) {
  while (node?.kind === K.ParenthesizedExpression) node = node.expression;
  return !!node && ([K.NumericLiteral, K.StringLiteral, K.TrueKeyword, K.FalseKeyword, K.NullKeyword].includes(node.kind) ||
    node.kind === K.PrefixUnaryExpression && [K.PlusToken, K.MinusToken].includes(node.operator?.kind) && node.operand?.kind === K.NumericLiteral);
}
const closed = node => node.modifiers?.length === 1 && node.modifiers[0].kind === K.ConstKeyword && literal(node.initializer);
const variables = ast => ast.statements.filter(node => node.kind === K.VariableDeclaration);
const unmoved = ast => variables(ast).filter(node => node.initializer && !closed(node));

// Restore source emission order instead of relaxing the benchmark. Each moved
// mutable initializer must be a typed primitive literal store in its own unique
// global slot. Calls, aliases, aggregates and different values/types refuse.
export function preserveSourceConstantLayout(input) {
  const first = base(input);
  if (!first.proof.refused?.startsWith('CONSTANT_LAYOUT_UNMOVED_INITIALIZER_CHANGED')) return first;
  const {source, header = '', script} = input;
  try {
    const original = parse(source, 'literal-slot-source'), head = parse(header, 'literal-slot-header'), main = parse(script, 'literal-slot-main');
    for (const rows of [variables(original), [...variables(head), ...variables(main)]])
      assert.equal(new Set(rows.map(node => node.name.name)).size, rows.length, 'LITERAL_SLOT_DUPLICATE_GLOBAL');
    const expected = unmoved(original), actual = unmoved(main);
    assert.equal(expected.length, actual.length, 'LITERAL_SLOT_SET_CHANGED');
    for (const node of [...expected, ...actual]) assert(node.type?.kind >= K.BoolKeyword && node.type.kind <= K.WavetargetKeyword &&
      node.type.kind !== K.VoidKeyword && literal(node.initializer) && !node.modifiers?.length, 'LITERAL_SLOT_UNKNOWN_EFFECT_OR_TYPE');
    const byName = new Map(actual.map(node => [node.name.name, node]));
    for (const node of expected) {
      const match = byName.get(node.name.name);assert(match, 'LITERAL_SLOT_MISSING_GLOBAL');
      assertExactAstShape(match, node, {ignoredFields: ignored, label: 'LITERAL_SLOT_DECLARATION_CHANGED'});
    }
    let delta = 0;
    const edits = actual.map((node, index) => {
      const chosen = byName.get(expected[index].name.name), before = script.slice(node.pos, node.end), replacement = script.slice(chosen.pos, chosen.end);
      const edit = {start: node.pos, end: node.end, newStart: node.pos + delta, before, replacement};
      delta += replacement.length - before.length;return edit;
    });
    let ordered = script;
    for (const edit of [...edits].reverse()) ordered = ordered.slice(0, edit.start) + edit.replacement + ordered.slice(edit.end);
    let inverse = ordered;
    for (const edit of [...edits].reverse()) inverse = inverse.slice(0, edit.newStart) + edit.before + inverse.slice(edit.newStart + edit.replacement.length);
    assert.equal(inverse, script, 'LITERAL_SLOT_INVERSE_FAILED');
    const second = base({...input, script: ordered});
    if (second.proof.refused) return {...first, proof: {...first.proof, literalSlotRetryRefused: second.proof.refused}};
    return {...second, proof: {...second.proof, kind: 'SOURCE_CONSTANT_LAYOUT_WITH_TYPED_LITERAL_SLOT_ORDER',
      scriptBeforeSha256: sha(script), orderedScriptSha256: sha(ordered),
      onlyExistingConstantDeclarationsMoved: false, onlyExistingLiteralGlobalDeclarationsRelocated: true,
      literalSlotPermutation: {sourceNames: expected.map(node => node.name.name), emittedNames: actual.map(node => node.name.name),
        primitiveLiteralStoresOnly: true, globalBindingsTypesAndValuesExact: true, allOtherBytesExactByInverse: true},
      constantLayoutPremise: second.proof}};
  } catch (error) { return {...first, proof: {...first.proof, literalSlotRetryRefused: error.message}}; }
}
export function applySourceConstantLayout(token, xml, output) {
  if (token === undefined) return {output};
  const input = profiles.get(token);assert(input, 'UNTRUSTED_SOURCE_CONSTANT_LAYOUT');
  const result = preserveSourceConstantLayout({source: input.source, sourceHeader: input.header,
    header: output.header ?? '', script: output.script, headerFileName: output.headerFileName});
  return {output: {...output, header: result.header, script: result.script}, proof: {...result.proof,
    observedGuiSha256: token.xmlSha256, currentGuiSha256: sha(xml), currentDeclarationsRevalidated: !result.proof.refused}};
}

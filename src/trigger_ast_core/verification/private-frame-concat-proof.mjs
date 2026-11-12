import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createVerifiedConversionProgram} from '../model/verified-conversion-program.mjs';
import {planBoundConcatAssignment} from '../lowering/private-frame-concat-assignment.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {expressionGroupingShape as shape} from './expression-grouping-proof.typedef-terminators.mjs';
import {SyntaxKind as K, forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha = text => createHash('sha256').update(text).digest('hex');

// Comparison view only: the same private cell is read/written exactly once.
// RHS grouping and calls stay exact; this is not a concatenation/algebra rule.
export function canonicalPrivateFrameConcatAssignments(source, {declarations = []} = {}) {
  const rootName = '__concat_proof_root.galaxy', inputs = new Map([[rootName, {fileName: rootName, text: source, owned: true}]]);
  for (const file of declarations) {
    const fileName = file.fileName ?? file.originalPath;assert(fileName && fileName !== rootName);
    if (inputs.has(fileName)) {assert.equal(inputs.get(fileName).text, file.text, 'CONCAT_DECLARATION_CONFLICT');continue;}
    inputs.set(fileName, {...file, fileName, owned: false});
  }
  const files = [...inputs.values()], program = createVerifiedConversionProgram(files, {files});
  const edits = [], refused = [];
  try {
    const ast = program.documents.get(rootName);program.attachOriginal(ast);assert.equal(ast.parseDiagnostics.length, 0);
    const pending = [ast];
    while (pending.length) {
      const node = pending.pop();forEachChild(node, child => {pending.push(child);});
      if (node.kind !== K.ExpressionStatement || node.expression?.operatorToken?.kind !== K.PlusEqualsToken) continue;
      const target = program.declarationAt(node.expression.left);
      if (![K.TextKeyword, K.StringKeyword].includes(target?.type?.kind)) continue;
      const plan = planBoundConcatAssignment(program, node);
      if (!plan) {refused.push({start: node.pos, reason: 'CONCAT_FRAME_PRIVACY_UNPROVED'});continue;}
      const expr = node.expression, name = source.slice(expr.left.pos, expr.left.end), rhs = source.slice(expr.right.pos, expr.right.end);
      const replacement = `${name} = (${name} + (${rhs}));`;
      const replay = parse('void F(){' + replacement + '}', 'concat-replay');assert.equal(replay.parseDiagnostics.length, 0);
      assert.deepEqual(shape(replay.statements[0].body.statements[0].expression), shape(plan.node.expression), 'CONCAT_OPERATOR_TREE_CHANGED');
      edits.push({start: node.pos, end: node.end, before: source.slice(node.pos, node.end), replacement, qualification: plan.proof});
    }
  } finally {program.dispose();}
  edits.sort((a, b) => a.start - b.start);for (let i = 1; i < edits.length; i++) assert(edits[i - 1].end <= edits[i].start);
  let text = source;for (const edit of [...edits].reverse()) text = text.slice(0, edit.start) + edit.replacement + text.slice(edit.end);
  let inverse = text, delta = 0;
  const positions = edits.map(edit => {const start = edit.start + delta;delta += edit.replacement.length - (edit.end - edit.start);return {edit, start};});
  for (const {edit, start} of positions.reverse()) {
    assert.equal(inverse.slice(start, start + edit.replacement.length), edit.replacement);
    inverse = inverse.slice(0, start) + edit.before + inverse.slice(start + edit.replacement.length);
  }
  assert.equal(inverse, source);assert.equal(parse(text, 'concat-view').parseDiagnostics.length, 0);
  return {text, proof: {kind: 'BOUND_PRIVATE_FRAME_CONCAT_ASSIGNMENT', sourceSha256: sha(source), viewSha256: sha(text), edits, refused,
    exactInverseVerified: true, rawOracleReplaced: false, sourceChangedOnDisk: false, wholeProgramEquivalent: false}};
}

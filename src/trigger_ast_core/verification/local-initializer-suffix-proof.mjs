// Keep every opaque declaration at its original point. Only an intrinsic
// declaration suffix is projected through the established initializer proof.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {canonicalLocalInitializerSequence} from './local-initializer-sequence.value-handles.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha = text => createHash('sha256').update(text).digest('hex');
const intrinsic = node => node.type?.kind >= K.BoolKeyword && node.type.kind <= K.WavetargetKeyword && node.type.kind !== K.VoidKeyword;
export function canonicalPrimitiveInitializerSuffix(source) {
  const ast = parse(source, 'initializer-suffix');assert.equal(ast.parseDiagnostics.length, 0);
  const edits = [];
  for (const fn of ast.statements) {
    if (fn.kind !== K.FunctionDeclaration || !fn.body) continue;
    const declarations = [];for (const node of fn.body.statements) {if (node.kind !== K.VariableDeclaration) break;declarations.push(node);}
    const names = [...declarations.map(node => node.name.name), ...fn.parameters.map(node => node.name.name)];
    if (new Set(names).size !== names.length) continue;
    let barrier = -1;for (let i = 0; i < declarations.length; i++) if (!intrinsic(declarations[i])) barrier = i;
    // The existing whole-prefix rule already covers the no-barrier case.
    if (barrier < 0 || barrier === declarations.length - 1) continue;
    const suffix = declarations.slice(barrier + 1), start = suffix[0].pos, end = suffix.at(-1).end;
    const projected = 'void initializerSuffix(){\n' + source.slice(start, end) + '\n}';
    const result = canonicalLocalInitializerSequence(projected), record = result.proof.edits[0];
    if (!record) continue;
    assert.equal(result.proof.edits.length, 1);
    edits.push({function: fn.name.name, start, end, before: source.slice(start, end), replacement: record.replacement,
      retainedBarrierDeclarations: declarations.slice(0, barrier + 1).map(node => node.name.name),
      noInitializerCrossesAnOpaqueDeclaration: true, initializerOrder: record.assignments.map(assignment => assignment.name)});
  }
  let text = source;for (const edit of edits.toReversed()) text = text.slice(0, edit.start) + edit.replacement + text.slice(edit.end);
  assert.equal(parse(text, 'initializer-suffix-view').parseDiagnostics.length, 0);
  return {text, proof: {kind: 'INTRINSIC_INITIALIZER_SUFFIX_AFTER_RETAINED_STORAGE_BARRIERS', edits,
    sourceSha256: sha(source), viewSha256: sha(text), opaqueConstructorsNotAssumedPure: true,
    sourceOrExportChanged: false, wholeProgramOracleStillRequired: true, wholeMapAccepted: false}};
}

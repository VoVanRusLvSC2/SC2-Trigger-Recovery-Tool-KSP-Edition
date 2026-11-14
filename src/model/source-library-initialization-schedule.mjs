import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  indexSourceFunctionDeclarations,
  canonicalSourceFunctionDeclaration,
} from './source-function-declarations.mjs';
import {
  SyntaxKind as K,
  Printer,
} from '../sdk/array-values/modules/galaxy/language-core/index.js';
const states = new WeakMap(),
  printer = new Printer(),
  sha = (s) => createHash('sha256').update(s).digest('hex');
const astSha = (n) => sha(printer.printNode(n));
const ordinary = (n) =>
  n?.kind === K.FunctionDeclaration &&
  n.body &&
  n.type.kind === K.VoidKeyword &&
  !n.parameters.length &&
  !n.modifiers?.length;
const direct = (s) =>
  s?.kind === K.ExpressionStatement &&
  s.expression?.kind === K.CallExpression &&
  s.expression.expression.kind === K.Identifier &&
  !s.expression.arguments.length
    ? s.expression
    : undefined;
const libraryId = (name) => /^lib([A-Za-z0-9_]{1,128})_InitLib$/u.exec(name ?? '')?.[1];

/** Availability of source code is separate from the time of its initialization.
 * Read bound original calls, retaining every root operator and repeated late
 * call. This plan cannot hoist calls, remove effects or authorize GUI emission. */
export function planSourceLibraryInitialization({
  program,
  fileName,
  entryPoint = 'InitMap',
  nativeLibraryId,
}) {
  assert(
    program?.documents instanceof Map && !program.closed,
    'LIBRARY_SCHEDULE_BOUND_PROGRAM_REQUIRED',
  );
  assert(
    typeof nativeLibraryId === 'string' && nativeLibraryId,
    'LIBRARY_SCHEDULE_NATIVE_ID_REQUIRED',
  );
  const index = indexSourceFunctionDeclarations(program.documents),
    entryGroup = index.get(entryPoint),
    entry = entryGroup?.body?.node;
  assert(
    entryGroup?.status === 'UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES' &&
      entryGroup.body.fileName === fileName &&
      ordinary(entry),
    'LIBRARY_SCHEDULE_UNIQUE_ENTRY_ABI',
  );
  const files = [...program.documents].map(([name, ast]) => {
    const identity = program.verifiedInputIdentity(name);
    assert(identity?.contentSha256 === sha(ast.text), 'LIBRARY_SCHEDULE_SOURCE_IDENTITY');
    return { fileName: name, sha256: identity.contentSha256 };
  });
  const targets = new Map(),
    bound = (call) => {
      assert(
        call && program.getBinding(call.expression).status === 'BOUND',
        'LIBRARY_SCHEDULE_CALL_BINDING',
      );
      const target = canonicalSourceFunctionDeclaration(
          index,
          program.declarationAt(call.expression),
        ),
        group = index.get(call.expression.name);
      assert(
        group?.status === 'UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES' &&
          group.body.node === target &&
          ordinary(target),
        'LIBRARY_SCHEDULE_TARGET_ABI',
      );
      const source = program.location(target),
        identity = program.verifiedInputIdentity(source.sourceFile);
      assert(identity?.contentSha256 === source.contentSha256, 'LIBRARY_SCHEDULE_TARGET_IDENTITY');
      targets.set(target, astSha(target));
      return { node: target, source, sourceOwned: identity.owned === true };
    };
  const first = direct(entry.body.statements[0]),
    phase = bound(first);
  assert(phase.node !== entry, 'LIBRARY_SCHEDULE_RECURSIVE_PHASE');
  const phaseCalls = phase.node.body.statements.map((s, ordinal) => {
    const call = direct(s),
      id = libraryId(call?.expression.name);
    assert(id, 'LIBRARY_SCHEDULE_NONCANONICAL_EARLY_PHASE');
    return {
      libraryId: id,
      name: call.expression.name,
      ordinal,
      ...bound(call),
      astSha256: astSha(s),
    };
  });
  assert(phaseCalls.length && phaseCalls.length <= 256, 'LIBRARY_SCHEDULE_PHASE_CAPACITY');
  assert.equal(phaseCalls[0].libraryId, nativeLibraryId, 'LIBRARY_SCHEDULE_NATIVE_FIRST');
  assert.equal(
    new Set(phaseCalls.map((r) => r.libraryId)).size,
    phaseCalls.length,
    'LIBRARY_SCHEDULE_DUPLICATE_EARLY_CALL',
  );
  const deferred = [];
  const rootOperators = entry.body.statements.map((s, ordinal) => {
    const call = direct(s),
      id = ordinal > 0 && libraryId(call?.expression.name);
    if (id)
      deferred.push({
        libraryId: id,
        name: call.expression.name,
        rootOrdinal: ordinal,
        ...bound(call),
        astSha256: astSha(s),
      });
    return { ordinal, kind: s.kind, astSha256: astSha(s), ...(id ? { libraryId: id } : {}) };
  });
  const describe = ({ node, ...row }) => ({ ...row, functionSha256: astSha(node) });
  const proof = {
    kind: 'BOUND_SOURCE_LIBRARY_INITIALIZATION_TIMELINE',
    entryPoint,
    entrySource: program.location(entry),
    entrySha256: astSha(entry),
    phaseName: phase.node.name.name,
    phaseSha256: astSha(phase.node),
    files,
    early: phaseCalls.map(describe),
    deferred: deferred.map(describe),
    rootOperators,
    sourceCallsMayBeHoisted: false,
    sourceEffectsMayBeDropped: false,
    guiEmissionAuthorized: false,
    actualNativeExportStillRequired: true,
    wholeMapAccepted: false,
  };
  const capability = Object.freeze({ kind: proof.kind });
  states.set(capability, {
    program,
    entry,
    phase: phase.node,
    targets,
    proof: structuredClone(proof),
  });
  return { capability, proof };
}

export function readSourceLibraryInitialization(
  capability,
  program,
  { derivedLibraryIds = [] } = {},
) {
  const state = states.get(capability);
  assert(
    state && state.program === program && !program.closed,
    'LIBRARY_SCHEDULE_UNTRUSTED_CAPABILITY',
  );
  for (const file of state.proof.files)
    assert.equal(
      sha(program.documents.get(file.fileName)?.text ?? ''),
      file.sha256,
      'LIBRARY_SCHEDULE_SOURCE_CHANGED',
    );
  assert.equal(astSha(state.entry), state.proof.entrySha256, 'LIBRARY_SCHEDULE_ENTRY_CHANGED');
  assert.equal(astSha(state.phase), state.proof.phaseSha256, 'LIBRARY_SCHEDULE_PHASE_CHANGED');
  for (const [node, digest] of state.targets)
    assert.equal(astSha(node), digest, 'LIBRARY_SCHEDULE_TARGET_CHANGED');
  const proof = structuredClone(state.proof),
    early = new Set(proof.early.map((r) => r.libraryId)),
    late = new Set(proof.deferred.map((r) => r.libraryId));
  for (const id of derivedLibraryIds)
    assert(early.has(id) || late.has(id), 'LIBRARY_SCHEDULE_GUI_DEPENDENCY_NOT_SCHEDULED:' + id);
  return {
    ...proof,
    sourceDeferredGuiLibraryIds: [
      ...new Set(derivedLibraryIds.filter((id) => !early.has(id) && late.has(id))),
    ],
    nativeEarlyInitializationMustBePrevented: derivedLibraryIds.some(
      (id) => !early.has(id) && late.has(id),
    ),
  };
}

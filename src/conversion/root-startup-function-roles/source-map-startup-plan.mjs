import {
  indexRootStartupFunctionInterfaces,
  requireRootStartupGuiFunction,
} from '../../bindings/root-startup-function-interfaces.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  Parser,
  Printer,
  SyntaxKind as K,
} from '../exact-function-signatures/index-alternate-3.js';
import { proveOwnedStartupFunctions } from '../exact-function-signatures/preserved-source-startup-abi.mjs';

const facts = new WeakMap(),
  sha = (s) => createHash('sha256').update(s).digest('hex');
const call = (s) =>
  s?.kind === K.ExpressionStatement &&
  s.expression?.kind === K.CallExpression &&
  s.expression.expression?.kind === K.Identifier &&
  s.expression.arguments.length === 0
    ? s.expression.expression.name
    : undefined;

export function createSourceMapStartupDependencies(source, context) {
  const ast = new Parser().parseFile('source-map-startup', source);
  assert.equal(ast.parseDiagnostics.length, 0, 'SOURCE_MAP_STARTUP_PARSE');
  const proof = {
    kind: 'SOURCE_DECLARED_MAP_STARTUP_DEPENDENCIES',
    sourceSha256: sha(source),
    applicable: false,
    sourceOrArchiveChanged: false,
    wholeMapAccepted: false,
    persistentCache: false,
  };
  const fns = ast.statements.filter((n) => n.kind === K.FunctionDeclaration && n.body),
    roots = fns.filter((n) => n.name.name === 'InitMap');
  if (roots.length !== 1) {
    proof.reason = 'NO_UNIQUE_MAP_ENTRY';
    return { proof };
  }
  const root = roots[0];
  if (root.parameters.length || root.type?.kind !== K.VoidKeyword) {
    proof.reason = 'NONSTANDARD_MAP_ENTRY';
    return { proof };
  }
  const name = call(root.body.statements[0]),
    stages = fns.filter((n) => n.name.name === name);
  if (
    stages.length !== 1 ||
    stages[0].parameters.length ||
    stages[0].type?.kind !== K.VoidKeyword
  ) {
    proof.reason = 'NO_UNIQUE_DIRECT_STARTUP_STAGE';
    return { proof };
  }
  const ids = stages[0].body.statements.map(
    (s) => /^lib([A-Za-z0-9_]+)_InitLib$/u.exec(call(s) ?? '')?.[1],
  );
  if (
    !ids.length ||
    ids.length > 256 ||
    ids.some((id) => !id || id.length > 128) ||
    new Set(ids).size !== ids.length
  ) {
    proof.reason = 'NONCANONICAL_OR_DUPLICATE_LIBRARY_STARTUP';
    return { proof };
  }
  if (context?.ownedSources?.length) {
    const rootAst = new Parser().parseFile(context.root.fileName, context.root.text),
      printer = new Printer();
    assert.equal(rootAst.parseDiagnostics.length, 0, 'STARTUP_ROOT_SOURCE_SYNTAX');
    for (const target of [root, stages[0]]) {
      const matches = rootAst.statements.filter(
        (n) => n.kind === K.FunctionDeclaration && n.body && n.name.name === target.name.name,
      );
      assert(
        matches.length === 1 && printer.printNode(matches[0]) === printer.printNode(target),
        'STARTUP_ROOT_SOURCE_CONTEXT_CHANGED',
      );
    }
  }
  const sourceProof = context?.ownedSources?.length
    ? proveOwnedStartupFunctions(
        context,
        ids.map((id) => 'lib' + id + '_InitLib'),
      )
    : undefined;
  const sourceFunctions = new Map(
    (sourceProof?.functions ?? [])
      .filter((f) => f.status === 'UNIQUE_OWNED_VOID_ZERO_ABI')
      .map((f) => [f.name, f]),
  );
  const rootFunctions = indexRootStartupFunctionInterfaces(
    ast,
    ids.map((id) => 'lib' + id + '_InitLib'),
  );
  const value = Object.freeze({
    sourceSha256: proof.sourceSha256,
    stage: name,
    libraryIds: Object.freeze([...ids]),
    sourceFunctions,
    rootFunctions,
  });
  const capability = Object.freeze({ kind: proof.kind, sourceSha256: value.sourceSha256 });
  facts.set(capability, value);
  Object.assign(proof, {
    applicable: true,
    stage: name,
    libraryIds: [...ids],
    sourceFunctions: sourceProof,
    rootFunctions: [...rootFunctions.values()],
    nativeFirstValidatedDuringCompilation: true,
    allDependenciesValidatedDuringCompilation: true,
  });
  return { capability, proof };
}

export function resolveSourceMapStartupPlan(
  capability,
  { library, nativeLibrary, allLibraries, derived = [] },
) {
  if (capability === undefined)
    return { guiLibraryIds: derived, startupLibraryIds: derived, sourceOnly: [] };
  const f = facts.get(capability);
  assert(f, 'UNTRUSTED_SOURCE_MAP_STARTUP_CAPABILITY');
  if (library.implicit !== true)
    return { guiLibraryIds: derived, startupLibraryIds: derived, sourceOnly: [] };
  assert(
    nativeLibrary?.id && f.libraryIds[0] === nativeLibrary.id,
    'SOURCE_MAP_NATIVE_STARTUP_ORDER_CHANGED',
  );
  const ids = f.libraryIds.slice(1);
  assert(!ids.includes(library.id), 'SOURCE_MAP_STARTUP_SELF_DEPENDENCY');
  const guiLibraryIds = [],
    sourceOnly = [];
  for (const id of ids) {
    const l = allLibraries?.get(id);
    if (l) {
      assert.equal(l.id, id, 'SOURCE_MAP_STARTUP_LIBRARY_IDENTITY');
      guiLibraryIds.push(id);
      continue;
    }
    const symbol = 'lib' + id + '_InitLib',
      owned = f.sourceFunctions.get(symbol),
      root = f.rootFunctions.get(symbol);
    const source = owned ?? (root && requireRootStartupGuiFunction(library, root));
    assert(source, 'SOURCE_MAP_STARTUP_DEPENDENCY_UNAVAILABLE:' + id);
    sourceOnly.push({ libraryId: id, ...source });
  }
  for (const id of derived)
    assert(
      id === nativeLibrary.id || guiLibraryIds.includes(id),
      'SOURCE_MAP_STARTUP_OMITS_GUI_DEPENDENCY:' + id,
    );
  return { guiLibraryIds, startupLibraryIds: ids, sourceOnly };
}

// Existing callers only request GUI includes. Emission of startup calls uses the
// explicit ordered plan, so a source-only dependency never invents Lib<ID>_h.
export function resolveSourceMapStartupDependencies(capability, context) {
  return resolveSourceMapStartupPlan(capability, context).guiLibraryIds;
}

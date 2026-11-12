import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lexical-parameters.mjs';
import {indexSourceFunctionDeclarations} from '../model/source-function-declarations.mjs';
import {proveSourceInitializerWeaveLifetimes} from '../model/source-initializer-weave-lifetimes.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {partitionDeclarationViews, logicalSourcePath} from '../model/source-ownership.mjs';
import {removeAlreadyLoadedOwnedIncludes} from '../passes/owned-include-closure.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

const sha = text => createHash('sha256').update(text).digest('hex');
const directCalls = fn => {
  if (!fn?.body || fn.type.kind !== K.VoidKeyword || fn.parameters.length || fn.modifiers?.length) return;
  const result = [];
  for (const statement of fn.body.statements) {
    const call = statement.kind === K.ExpressionStatement && statement.expression;
    if (call?.kind !== K.CallExpression || call.expression.kind !== K.Identifier || call.arguments.length) return;
    result.push(call.expression.name);
  }
  return result;
};

// Reverse only a proved private-helper tail association in comparison views.
// Source files/archives remain untouched. Both source and candidate lifetimes
// and the unchanged helper prefix are checked before a single view edit exists.
export async function projectSourceInitializerWeaveView(before, after, {closedContext = {}, oracle} = {}) {
  assert(oracle && typeof oracle.compare === 'function', 'INITIALIZER_WEAVE_PINNED_ORACLE_REQUIRED');
  const proof = {kind: 'SOURCE_INITIALIZER_WEAVE_COMPARISON_VIEW', records: [], edits: [],
    sourceSha256: sha(before), exportSha256: sha(after), sourceOrExportChanged: false,
    completeProgramCompared: false, wholePhaseAccepted: false, wholeMapAccepted: false};
  const unchanged = reason => ({before, after, proof: {...proof, reason}});
  const owned = closedContext.ownedSources ?? [];
  const views = partitionDeclarationViews(owned, closedContext.externalSources ?? []);
  if (views.conflicts.length) return unchanged('CONFLICTING_INCLUDE_VIEWS');
  const programs = {}, indexes = {}, closures = {};
  try {
    for (const [side, text] of [['before', before], ['after', after]]) {
      const root = {fileName: 'MapScript.galaxy', text, owned: true};
      const closure = removeAlreadyLoadedOwnedIncludes({root, ownedSources: owned, externalSources: views.external,
        includeEvidence: closedContext.includeEvidence ?? [], includeRoot: false}).proof;
      if (!closure.completeReachableClosure) return unchanged('INCOMPLETE_INCLUDE_CLOSURE:' + side);
      closures[side] = closure;
      const reached = new Map(closure.resolvedFiles.map(row => [logicalSourcePath(row.path), row.sha256]));
      const files = new Map();
      for (const input of [root, ...owned.map(file => ({...file, owned: true})), ...views.external]) {
        const fileName = logicalSourcePath(input.originalPath ?? input.fileName);
        if (!reached.has(fileName)) continue;
        assert.equal(sha(input.text), reached.get(fileName), 'INITIALIZER_WEAVE_INCLUDE_CONTENT_CHANGED');
        if (!files.has(fileName)) files.set(fileName, {...input, fileName, sourceId: fileName, contentSha256: sha(input.text)});
      }
      const inputs = [...files.values()];
      const program = new GalaxyProgramContext(inputs, {files: inputs}, sha, {checks: 'binding'});
      programs[side] = program;
      for (const ast of program.documents.values()) program.attachOriginal(ast);
      if (program.conflicts.size) return unchanged('AMBIGUOUS_RUNTIME_DECLARATIONS:' + side);
      indexes[side] = indexSourceFunctionDeclarations(program.documents);
    }
    const sourceRoot = programs.before.documents.get('mapscript.galaxy');
    const candidateRoot = programs.after.documents.get('mapscript.galaxy');
    const edits = [], used = new Set();
    for (const sourcePhase of sourceRoot.statements.filter(node => node.kind === K.FunctionDeclaration && node.body)) {
      const sourceNames = directCalls(sourcePhase);
      const phaseName = sourcePhase.name.name;
      const candidatePhase = indexes.after.get(phaseName)?.body?.node;
      if (candidatePhase?.parent !== candidateRoot) continue;
      const automaticNames = directCalls(candidatePhase);
      if (!sourceNames || !automaticNames?.length || automaticNames.length >= sourceNames.length ||
          new Set(automaticNames).size !== automaticNames.length) continue;
      const automatic = new Set(automaticNames);
      if (sourceNames.filter(name => automatic.has(name)).join('\0') !== automaticNames.join('\0')) continue;
      let lifetime;
      try {
        lifetime = proveSourceInitializerWeaveLifetimes({program: programs.before, fileName: sourceRoot.fileName,
          phaseName, automaticNames}).proof;
      } catch { continue; }
      const changed = lifetime.changedConstructors;
      if (!changed.length) continue;
      // Restore only the phase in a temporary semantic program, then ask the
      // same lifetime checker about every candidate helper at once. Includes
      // and all other caller sites are retained, with fresh source identities.
      const originalPhaseText = before.slice(sourcePhase.pos, sourcePhase.end);
      const probeText = after.slice(0, candidatePhase.pos) + originalPhaseText + after.slice(candidatePhase.end);
      let probe;
      try {
        const inputs = [...programs.after.inputs.values()].map(file => ({...file,
          ...(file.fileName === sourceRoot.fileName ? {text: probeText, contentSha256: sha(probeText)} : {})}));
        probe = new GalaxyProgramContext(inputs, {files: inputs}, sha, {checks: 'binding'});
        for (const ast of probe.documents.values()) probe.attachOriginal(ast);
        proveSourceInitializerWeaveLifetimes({program: probe, fileName: sourceRoot.fileName, phaseName, automaticNames});
      } catch { continue; } finally { probe?.dispose(); }
      const localEdits = [], rows = [];
      let refused = false;
      for (const slot of changed) {
        const source = indexes.before.get(slot.name)?.body?.node;
        const candidate = indexes.after.get(slot.name)?.body?.node;
        if (used.has(slot.name) || source?.parent !== sourceRoot || candidate?.parent !== candidateRoot) { refused = true; break; }
        const manual = slot.manualCalls.map(call => call.name);
        const tail = candidate.body.statements.slice(-manual.length);
        if (tail.length !== manual.length || !tail.every((statement, index) => {
          const call = statement.kind === K.ExpressionStatement && statement.expression;
          return call?.kind === K.CallExpression && call.expression.kind === K.Identifier && call.arguments.length === 0 && call.expression.name === manual[index];
        })) { refused = true; break; }
        const start = tail[0].pos, end = tail.at(-1).end;
        const prefixText = after.slice(candidate.pos, start) + after.slice(end, candidate.end);
        const sourceText = before.slice(source.pos, source.end);
        const comparison = await oracle.compare(sourceText, prefixText);
        if (!comparison.exact || !comparison.syntaxValid) { refused = true; break; }
        localEdits.push({start, end, before: after.slice(start, end), replacement: ''});
        rows.push({name: slot.name, manual, source: programs.before.location(source), candidate: programs.after.location(candidate),
          exactUnchangedConstructorPrefix: true, comparison});
      }
      if (refused) continue;
      localEdits.push({start: candidatePhase.pos, end: candidatePhase.end,
        before: after.slice(candidatePhase.pos, candidatePhase.end), replacement: before.slice(sourcePhase.pos, sourcePhase.end)});
      edits.push(...localEdits); changed.forEach(slot => used.add(slot.name));
      proof.records.push({phaseName, lifetime, constructors: rows, originalCallSequence: sourceNames, automaticCallSequence: automaticNames,
        noNewOrRemovedRuntimeFunction: true});
    }
    if (!edits.length) return unchanged('NO_QUALIFIED_PRIVATE_INITIALIZER_ASSOCIATION');
    const result = applyReversibleSourceEdits(after, edits);
    return {before, after: result.text, proof: {...proof, edits: result.proof.edits, byteInverseVerified: true,
      proofInputSha256: result.proof.proofInputSha256, closure: closures,
      boundary: 'Typed ordinary Galaxy calls and private source helpers; dynamic callback ABI qualification and full frozen oracle comparison remain required.'}};
  } finally { Object.values(programs).forEach(program => program.dispose()); }
}

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GalaxyProgramContext } from '../../ast/galaxy-program-context.identity.mjs';
import { FunctionCandidateIndex } from '../attribute-scalar-codec/function-candidates.mjs';
import { deriveNativeTypeMapping } from '../attribute-scalar-codec/types/core.mjs';
import { createMissingNativeGuiDescriptions } from '../../bindings/missing-native-gui-description.public-event-alias.mjs';
import { reconcileAuthoredContextualNativeGetters } from '../../incremental/authored-contextual-native-getters.scoped.mjs';
const sha = (b) => createHash('sha256').update(b).digest('hex');

export function repairAuthoredContextualNativeGetters({
  xml,
  strings,
  source,
  libraries,
  declarations,
  owners,
  libraryId,
  core,
}) {
  // A lexical macro is a necessary condition, not permission to change a call.
  if (
    ![...libraries.values()].some((l) =>
      Object.values(l.elements).some(
        (e) =>
          e.type === 'FunctionDef' &&
          source.includes(e.identifier ?? e.name ?? '\0') &&
          /^\s*#AUTOVAR\([^\r\n]*ancestor:/u.test(e.scriptCode ?? ''),
      ),
    )
  )
    return { xml, strings, proof: { records: [], newNativeDescriptions: 0 } };
  const files = new Map(),
    add = (fileName, text, owned) => {
      const old = files.get(fileName);
      if (old) {
        assert.equal(old.text, text, 'CONTEXTUAL_GETTER_SOURCE_NAME_CONFLICT');
        assert.equal(old.owned, owned, 'CONTEXTUAL_GETTER_SOURCE_ROLE_CONFLICT');
        return;
      }
      files.set(fileName, { fileName, text, owned, sourceId: fileName, contentSha256: sha(text) });
    };
  add('authored-contextual-source.galaxy', source, true);
  for (const d of declarations) add(d.fileName, d.text, false);
  const inputs = [...files.values()],
    program = new GalaxyProgramContext(inputs, { files: inputs, dependencies: [] }, sha);
  try {
    for (const ast of program.documents.values()) program.attachOriginal(ast);
    // Work on private metadata copies: source SDK definitions remain immutable.
    const loaded = [...libraries.values()].map((l) => structuredClone(l));
    for (const l of loaded) deriveNativeTypeMapping(l, declarations);
    const candidates = new FunctionCandidateIndex(loaded),
      factory = createMissingNativeGuiDescriptions({ program, candidates });
    core.resetGalaxyToTriggerIdCounter();
    for (const l of libraries.values())
      for (const e of Object.values(l.elements)) core.reserveGalaxyToTriggerId(e.id);
    const result = reconcileAuthoredContextualNativeGetters({
      xml,
      sourceAst: program.documents.get('authored-contextual-source.galaxy'),
      program,
      candidates,
      factory,
      owners,
      libraryId,
    });
    let outputStrings = strings;
    for (const r of result.proof.nativeDescriptions.records) {
      const prefix = libraryId === 'Map' ? '' : `lib_${libraryId}_`,
        key = `FunctionDef/Name/${prefix}${r.definition.id}`;
      assert(
        !strings.split(/\r?\n/u).some((line) => line.startsWith(key + '=')),
        'CONTEXTUAL_GETTER_STRING_KEY_COLLISION',
      );
      outputStrings += (outputStrings.endsWith('\n') ? '' : '\n') + `${key}=${r.api}\n`;
    }
    return { ...result, strings: outputStrings };
  } finally {
    program.dispose();
  }
}

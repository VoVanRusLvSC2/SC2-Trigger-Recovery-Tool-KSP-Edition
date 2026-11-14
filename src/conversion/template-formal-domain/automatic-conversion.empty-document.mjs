import { reifyStringLiteralParameters } from '../exact-function-signatures/string-literal-presets.frontend-scope.mjs';
import {
  bindLocalizedTextParameters,
  bindLoadedStatementTemplates,
} from '../runtime-event-public-alias/missing-description-template-gate.mjs';
// Per-call metadata only: no map fixture, library default, preparation path or persistent cache.
import assert from 'node:assert/strict';
import { createAutomaticCompletion } from './incremental-completion.literal-bytes.mjs';
import * as core from '../native-expression-identity/g2t-core.generated-call-provenance.mjs';
import * as names from '../runtime-event-public-alias/ttg-core.verified-getter.mjs';
import * as model from '../../ast/explicit-numeric-global-model.mjs';
import * as xmlTools from '../implicit-gui-localization/trigger-xml.mjs';
import { readAuthoredTriggerDocument } from '../../ast/read-authored.scope.mjs';
import { xmlTree } from '../../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
import { GalaxyConstantIndex } from '../native-expression-identity/galaxy-constants.mjs';
import {
  syntaxShape,
  printNode,
  templateMacros,
} from '../native-expression-identity/balanced-script-template-alternate.mjs';
import { convertUserFunctionBody } from '../runtime-event-public-alias/g2t-trigger-body-alternate.mjs';
import { parseSharedGalaxySource as parseGalaxySource } from '../runtime-event-public-alias/galaxy-to-trigger.standard-getter.mjs';
const sdk =
  'K:\\SC2_MAP_Workspace\\sc2_editor_C++\\map_build_validation_2026-10-01\\bundle\\modkit-extensions-blizzard\\starcraft2-trigger-ast-array-values-2026-10-07';
export async function completeExistingGui(input, signal, service) {
  signal?.throwIfAborted();
  const libraries = new Map();
  for (const document of input.dependencyLibraries ?? []) {
    const parsed = await readAuthoredTriggerDocument(
      document.triggerData,
      sdk,
      document.triggerStrings ?? '',
    );
    for (const [id, library] of parsed.document.libraries) {
      assert(!libraries.has(id), 'Duplicate dependency library: ' + id);
      libraries.set(id, library);
    }
  }
  const context = {
    core,
    names,
    model,
    xmlTools,
    readAuthoredTriggerDocument,
    xmlTree,
    GalaxyConstantIndex,
    syntaxShape,
    printNode,
    templateMacros,
    convertUserFunctionBody,
    parseGalaxySource,
    sdk,
    service,
    libraries,
    nativeLibrary: libraries.get('Ntve'),
    galaxyDeclarations: input.galaxyDeclarations ?? [],
    opts: input,
  };
  context.prepareIncrementalSourceValues = (work, libraryId, roots, originalIds) => {
    const added = Object.fromEntries(
      Object.values(work.elements)
        .filter((e) => !originalIds.has(e.id))
        .map((e) => [e.id, e]),
    );
    const allocate = () => {
      let id;
      do {
        id = core.generateId();
      } while (work.elements[id] || added[id]);
      return id;
    };
    reifyStringLiteralParameters(added, libraryId, roots, allocate);
    const tables = [...(input.localizedStrings ?? [])];
    if (input.locale && !tables.some((t) => t.locale === input.locale))
      tables.push({
        locale: input.locale,
        triggerStrings: input.triggerStrings,
        gameStrings: input.gameStrings,
      });
    bindLocalizedTextParameters(
      added,
      libraryId,
      context.nativeLibrary,
      libraries,
      tables,
      work.implicit === true,
    );
    bindLoadedStatementTemplates(added, libraryId, context.nativeLibrary, libraries);
    Object.assign(work.elements, added);
  };
  const result = await createAutomaticCompletion(context).complete({
    xml: input.existingTriggerData,
    strings: input.triggerStrings ?? '',
    galaxy: input.script,
    libraryId: input.libraryId ?? 'Map',
    sourceCheckpoint: input.sourceCheckpoint,
    options: input,
  });
  signal?.throwIfAborted();
  if (result.mode === 'FULL_REBUILD')
    return {
      ...result.conversion,
      incremental: { mode: result.mode, timingsMs: result.timingsMs, proof: result.proof },
    };
  return {
    schemaVersion: 1,
    operation: 'galaxy-to-triggers',
    output: {
      libraryId: input.libraryId ?? 'Map',
      documentKind: input.documentKind ?? 'map',
      triggerData: result.xml,
      triggerStrings: result.strings,
      triggerStringsFileName: 'TriggerStrings.txt',
      generationOptions: result.generationOptions,
    },
    incremental: {
      mode: result.mode,
      changes: result.changes,
      proof: result.proof,
      timingsMs: result.timingsMs,
    },
  };
}

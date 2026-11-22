import { recoveryTextSha256 as sha } from '../../utilities/recovery-parse-scope.mjs';
import { normalizeOwnedSourceFiles as sourceFiles } from '../../model/owned-source-files.mjs';
import {
  withRetainedNominalInterfaces,
  replayRetainedNominalInterfaces,
} from '../source-nominal-return-roles/retained-nominal-gui-interfaces.replay.mjs';
import { verifySourceInitializerGuiOwnership } from '../native-expression-identity/source-initializer-gui-ownership.indexed.mjs';
import { verifyMissingNativeGuiDescriptions } from './missing-native-gui-descriptions.bound-source.mjs';
import { createOwnedAggregateConversion } from '../retained-type-spelling/owned-aggregate-conversion.structref-alias-abi.mjs';
import {
  sourceConstantLayout,
  createSourceConstantLayout,
  applySourceConstantLayout,
} from '../exact-function-signatures/source-constant-layout.constant-prefix.mjs';
import { partitionOwnedAiRecoveryInputs } from '../../model/owned-ai-recovery-inputs.mjs';
import {
  withPreservedSourceCallInterfaces,
  preservedSourceCallInterfaceProof,
} from '../qualified-macro-binding/preserved-source-aggregate-interfaces.dependency-functions.mjs';
import {
  withAuthoredSectionFunctions,
  authoredSectionProof,
  replayPartitionAuthoredStorage,
} from '../partition-declaration-identity/authored-section-functions.mixed-atomic.mjs';
import assert from 'node:assert/strict';
import { logicalSourcePath } from '../../model/source-ownership.mjs';
import { resolveGuiRecoveryPolicy } from '../../model/gui-recovery-policy.source-includes.mjs';
import { verifyAuthoredCodePolicy } from '../partition-declaration-identity/authored-code-preservation.missing-descriptions.mjs';
import {
  withPreservedSourceIncludes,
  verifyPreservedSourceIncludes,
} from '../exact-function-signatures/preserved-source-includes.exact-inputs.mjs';
import {
  authoredInitializerOrigins,
  createAuthoredInitializerOrigins,
  withAuthoredInitializerOrigins,
} from '../exact-function-signatures/initializer-origins.local-array-entry.qualified.mjs';

function declarationsWithSources(declarations, files) {
  const output = [...(declarations ?? [])];
  const byPath = new Map();
  for (const file of output) {
    const key = logicalSourcePath(file.originalPath ?? file.fileName);
    assert(!byPath.has(key) || byPath.get(key) === file.text, 'CONFLICTING_DECLARATION_SOURCE');
    byPath.set(key, file.text);
  }
  for (const file of files) {
    const key = logicalSourcePath(file.originalPath ?? file.fileName);
    assert(!byPath.has(key) || byPath.get(key) === file.text, 'OWNED_DECLARATION_SOURCE_CONFLICT');
    if (!byPath.has(key)) {
      output.push({ ...file });
      byPath.set(key, file.text);
    }
  }
  return output;
}

export function createSourceAwareConversion(engine, xmlTree) {
  assert.equal(typeof engine.convertGalaxyToTriggers, 'function');
  assert.equal(typeof xmlTree, 'function');
  return createOwnedAggregateConversion(
    Object.freeze({
      async convertGalaxyToTriggers(input, signal) {
        signal?.throwIfAborted();
        const policy = resolveGuiRecoveryPolicy(input),
          files = sourceFiles(input.additionalScripts);
        const initializerOrigins =
          input[authoredInitializerOrigins] ??
          (input.existingTriggerData?.trim()
            ? createAuthoredInitializerOrigins({
                xml: input.existingTriggerData,
                xmlTree,
                libraryId: input.libraryId ?? 'Map',
                sources: [
                  { fileName: 'primary.galaxy', text: input.script ?? '' },
                  { fileName: 'primary-header.galaxy', text: input.header ?? '' },
                  ...files,
                ],
              })
            : undefined);
        return withRetainedNominalInterfaces(input, policy, files, () =>
          withPreservedSourceCallInterfaces(input, policy, files, () =>
            withAuthoredSectionFunctions(input, policy, () =>
              withPreservedSourceIncludes(policy, input, files, async (plan) => {
                // Kept files still supply declarations. They must never disappear from the
                // compiler's symbol universe merely because they are not being lowered.
                const aiRecoveryInputs = partitionOwnedAiRecoveryInputs(
                  policy,
                  files,
                  input.customAiScripts,
                );
                const prepared = {
                  ...input,
                  customAiScripts: aiRecoveryInputs.files,
                  guiRecoveryMode: policy.mode,
                  [authoredInitializerOrigins]: initializerOrigins,
                  convertAdditionalScripts: policy.convertAdditionalScripts,
                  additionalScripts: files,
                  ...(policy.preserveAuthoredCode
                    ? {
                        primaryGalaxyIncludeFiles: [
                          ...new Set([
                            ...(input.primaryGalaxyIncludeFiles ?? []),
                            ...files.map((f) => f.fileName),
                          ]),
                        ],
                      }
                    : {}),
                  galaxyDeclarations: policy.preserveAuthoredCode
                    ? declarationsWithSources(input.galaxyDeclarations, files)
                    : input.galaxyDeclarations,
                };
                const initializerRecords = [];
                const result = await withAuthoredInitializerOrigins(
                  initializerOrigins,
                  input.existingTriggerData ?? '',
                  xmlTree,
                  () => engine.convertGalaxyToTriggers(prepared, signal),
                  initializerRecords,
                );
                signal?.throwIfAborted();
                for (const file of files)
                  assert.equal(
                    sha(file.text),
                    file.sha256,
                    'OWNED_SCRIPT_CHANGED_DURING_CONVERSION',
                  );
                if (policy.preserveAuthoredCode) {
                  const originals = new Map(
                    files.map((file) => [logicalSourcePath(file.fileName), file]),
                  );
                  assert.equal(originals.size, files.length, 'AMBIGUOUS_OWNED_SCRIPT_FILENAME');
                  for (const name of [
                    'customAiScripts',
                    'additionalScripts',
                    'preservedGalaxyScripts',
                  ])
                    for (const file of result.output?.[name] ?? []) {
                      const original = originals.get(logicalSourcePath(file.fileName));
                      if (original)
                        assert.equal(
                          file.text,
                          original.text,
                          'PRESERVED_SCRIPT_OUTPUT_CONFLICT: ' + file.fileName,
                        );
                    }
                }
                assert.equal(
                  typeof result.output?.triggerData,
                  'string',
                  'CONVERTER_TRIGGER_OUTPUT_REQUIRED',
                );
                const nominalGuiReplay = replayRetainedNominalInterfaces(
                  result.output.triggerData,
                  input.libraryId ?? 'Map',
                );
                if (typeof input.onDiagnosticGuiCandidate === 'function')
                  await input.onDiagnosticGuiCandidate({
                    triggerData: result.output.triggerData,
                    script: prepared.script,
                    header: prepared.header ?? '',
                    nominalGuiReplay,
                  });
                await replayPartitionAuthoredStorage(
                  result.output.triggerData,
                  result.output.triggerStrings,
                );
                const gui = (() => {
                  try {
                    return verifyAuthoredCodePolicy({
                      before: input.existingTriggerData ?? '',
                      after: result.output.triggerData,
                      policy,
                      xmlTree,
                      libraryId: input.libraryId ?? 'Map',
                      sourceInitializerWeave: verifySourceInitializerGuiOwnership({
                        input: prepared,
                        after: result.output.triggerData,
                      }),
                      nativeDescriptions: verifyMissingNativeGuiDescriptions({
                        input: prepared,
                        after: result.output.triggerData,
                      }),
                    });
                  } catch (error) {
                    error.nominalGuiReplay = nominalGuiReplay;
                    throw error;
                  }
                })();
                const preserved = policy.preserveAuthoredCode ? files : [];
                let sourceIncludes = { required: [], preserved: true };
                if (plan.length) {
                  const forward = await engine.convertTriggersToGalaxy(
                    result.output.triggerData,
                    {
                      ...prepared,
                      ...result.output.generationOptions,
                      triggerStrings: result.output.triggerStrings,
                      ...(result.output.customAi ? { customAi: result.output.customAi } : {}),
                    },
                    signal,
                  );
                  assert(
                    !forward.diagnostics?.some((d) => d.severity === 'error'),
                    'PRESERVED_SOURCE_FORWARD_FAILED',
                  );
                  sourceIncludes = verifyPreservedSourceIncludes(
                    plan,
                    [forward.output.header, forward.output.script].filter(Boolean).join('\n'),
                  );
                }
                // This is an explicit packing instruction, not evidence that an archive was
                // already written or that its logic passed the independent benchmark.
                return {
                  ...result,
                  output: {
                    ...result.output,
                    generationOptions: {
                      ...result.output.generationOptions,
                      [sourceConstantLayout]: createSourceConstantLayout({
                        source: input.script ?? '',
                        header: input.header ?? '',
                        xml: result.output.triggerData,
                      }),
                    },
                    ...(initializerOrigins
                      ? {
                          generationOptions: {
                            ...result.output.generationOptions,
                            [sourceConstantLayout]: createSourceConstantLayout({
                              source: input.script ?? '',
                              header: input.header ?? '',
                              xml: result.output.triggerData,
                            }),
                            [authoredInitializerOrigins]:
                              result.output.generationOptions?.[authoredInitializerOrigins] ??
                              initializerOrigins,
                          },
                        }
                      : {}),
                    ...(preserved.length ? { preservedGalaxyScripts: preserved } : {}),
                  },
                  guiRecovery: {
                    policy,
                    gui,
                    sourceIncludes,
                    retainedNominalInterfaces: nominalGuiReplay,
                    retainedAiSources: aiRecoveryInputs.retained,
                    sourceCallInterfaces: preservedSourceCallInterfaceProof(),
                    authoredSections: authoredSectionProof(),
                    initializerOrigins: initializerOrigins && {
                      profile:
                        result.output.generationOptions?.[authoredInitializerOrigins] ??
                        initializerOrigins,
                      decisions: initializerRecords,
                    },
                    preservedGalaxyScripts: preserved.map(({ fileName, originalPath, sha256 }) => ({
                      fileName,
                      originalPath,
                      sha256,
                    })),
                    archivePackingVerified: false,
                    benchmarkVerdictChanged: false,
                  },
                };
              }),
            ),
          ),
        );
      },
      async convertTriggersToGalaxy(xml, input, signal) {
        const decisions = [];
        const result = await withAuthoredInitializerOrigins(
          input?.[authoredInitializerOrigins],
          xml,
          xmlTree,
          () => engine.convertTriggersToGalaxy(xml, input, signal),
          decisions,
        );
        const layout = applySourceConstantLayout(input?.[sourceConstantLayout], xml, result.output);
        const output =
          layout.output === result.output
            ? result
            : { ...result, output: layout.output, sourceConstantLayoutProof: layout.proof };
        return input?.[authoredInitializerOrigins]
          ? {
              ...output,
              initializerOriginProof: { profile: input[authoredInitializerOrigins], decisions },
            }
          : output;
      },
    }),
  );
}

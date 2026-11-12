import {normalizeOwnedSourceFiles as sourceFiles} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/owned-source-files.mjs';
import {withRetainedNominalInterfaces,replayRetainedNominalInterfaces} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v499_source_nominal_return_roles_2026-10-27/graph/7e4380349d93-retained-nominal-gui-interfaces.replay.mjs';
import {verifySourceInitializerGuiOwnership} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/76d95c05edc5-5ac25f-f9d682b96379-b3bdab774ff2-f3df1133c45a-source-initializer-gui-ownership.indexed.mjs';
import {verifyMissingNativeGuiDescriptions} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v566_runtime_event_public_alias_2026-10-30/graph/a605266bc83a-5e-b19e0914598f-998594dee46c-b8ed8092c677-missing-native-gui-descriptions.bound-source.mjs';
import {createOwnedAggregateConversion} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v465_retained_type_spelling_2026-10-27/graph/ce449850c6e7--366402a2c9bd-ec6c43ab8354-7f990aacdc4b-owned-aggregate-conversion.structref-alias-abi.mjs';
import {sourceConstantLayout,createSourceConstantLayout,applySourceConstantLayout} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/252bf33f82b8-6e21ce8a76d0-source-constant-layout.constant-prefix.mjs';
import {partitionOwnedAiRecoveryInputs} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/owned-ai-recovery-inputs.mjs";
import {withPreservedSourceCallInterfaces,preservedSourceCallInterfaceProof} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v513_qualified_macro_binding_2026-10-28/graph/6c8e7632f9e0-a-001e9d0cef74-71588ccf11d1-preserved-source-aggregate-interfaces.dependency-functions.mjs";
import {withAuthoredSectionFunctions,authoredSectionProof,replayPartitionAuthoredStorage} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v548_partition_declaration_identity_2026-10-29/graph/5a4f51c22902-29d678d-e2e17cf47c8a-299547cdd472-91a0eb51e031-authored-section-functions.mixed-atomic.mjs";
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {logicalSourcePath} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/source-ownership.mjs';
import {resolveGuiRecoveryPolicy} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/gui-recovery-policy.source-includes.mjs';
import {verifyAuthoredCodePolicy} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v548_partition_declaration_identity_2026-10-29/graph/1b0e30bd03e0-cafb9be7b35f-e87435547e59-3ae7588c3c04-authored-code-preservation.missing-descriptions.mjs';
import {withPreservedSourceIncludes, verifyPreservedSourceIncludes} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/60dfd382b171-preserved-source-includes.exact-inputs.mjs';
import {authoredInitializerOrigins,createAuthoredInitializerOrigins,withAuthoredInitializerOrigins} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/23be55620b26-initializer-origins.local-array-entry.qualified.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');

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
    if (!byPath.has(key)) { output.push({...file}); byPath.set(key, file.text); }
  }
  return output;
}

export function createSourceAwareConversion(engine, xmlTree) {
  assert.equal(typeof engine.convertGalaxyToTriggers, 'function');
  assert.equal(typeof xmlTree, 'function');
  return createOwnedAggregateConversion(Object.freeze({
    async convertGalaxyToTriggers(input, signal) {
      signal?.throwIfAborted();
      const policy = resolveGuiRecoveryPolicy(input), files = sourceFiles(input.additionalScripts);
      const initializerOrigins=input[authoredInitializerOrigins]??(input.existingTriggerData?.trim()
        ?createAuthoredInitializerOrigins({xml:input.existingTriggerData,xmlTree,libraryId:input.libraryId??'Map',
          sources:[{fileName:'primary.galaxy',text:input.script??''},{fileName:'primary-header.galaxy',text:input.header??''},...files]})
        :undefined);
      return withRetainedNominalInterfaces(input,policy,files,()=>withPreservedSourceCallInterfaces(input,policy,files,()=>withAuthoredSectionFunctions(input,policy,()=>withPreservedSourceIncludes(policy, input, files, async plan => {
      // Kept files still supply declarations. They must never disappear from the
      // compiler's symbol universe merely because they are not being lowered.
      const aiRecoveryInputs=partitionOwnedAiRecoveryInputs(policy,files,input.customAiScripts);
      const prepared = {...input, customAiScripts:aiRecoveryInputs.files, guiRecoveryMode: policy.mode,[authoredInitializerOrigins]:initializerOrigins,
        convertAdditionalScripts: policy.convertAdditionalScripts, additionalScripts: files,
        ...(policy.preserveAuthoredCode ? {primaryGalaxyIncludeFiles: [...new Set([...(input.primaryGalaxyIncludeFiles ?? []), ...files.map(f => f.fileName)])]} : {}),
        galaxyDeclarations: policy.preserveAuthoredCode
          ? declarationsWithSources(input.galaxyDeclarations, files) : input.galaxyDeclarations};
      const initializerRecords=[];
      const result = await withAuthoredInitializerOrigins(initializerOrigins,input.existingTriggerData??'',xmlTree,
        ()=>engine.convertGalaxyToTriggers(prepared, signal),initializerRecords);
      signal?.throwIfAborted();
      for (const file of files) assert.equal(sha(file.text), file.sha256, 'OWNED_SCRIPT_CHANGED_DURING_CONVERSION');
      if (policy.preserveAuthoredCode) {
        const originals = new Map(files.map(file => [logicalSourcePath(file.fileName), file]));
        assert.equal(originals.size, files.length, 'AMBIGUOUS_OWNED_SCRIPT_FILENAME');
        for (const name of ['customAiScripts', 'additionalScripts', 'preservedGalaxyScripts'])
          for (const file of result.output?.[name] ?? []) {
            const original = originals.get(logicalSourcePath(file.fileName));
            if (original) assert.equal(file.text, original.text, 'PRESERVED_SCRIPT_OUTPUT_CONFLICT: ' + file.fileName);
          }
      }
      assert.equal(typeof result.output?.triggerData, 'string', 'CONVERTER_TRIGGER_OUTPUT_REQUIRED');
      const nominalGuiReplay=replayRetainedNominalInterfaces(result.output.triggerData,input.libraryId??'Map');
      if(typeof input.onDiagnosticGuiCandidate==='function') await input.onDiagnosticGuiCandidate({triggerData:result.output.triggerData,script:prepared.script,header:prepared.header??'',nominalGuiReplay});
      await replayPartitionAuthoredStorage(result.output.triggerData,result.output.triggerStrings);
      const gui = (()=>{try{return verifyAuthoredCodePolicy({before: input.existingTriggerData ?? '',
        after: result.output.triggerData, policy, xmlTree, libraryId: input.libraryId ?? 'Map',
        sourceInitializerWeave:verifySourceInitializerGuiOwnership({input:prepared,after:result.output.triggerData}),
        nativeDescriptions:verifyMissingNativeGuiDescriptions({input:prepared,after:result.output.triggerData})});}catch(error){error.nominalGuiReplay=nominalGuiReplay;throw error;}})();
      const preserved = policy.preserveAuthoredCode ? files : [];
      let sourceIncludes = {required: [], preserved: true};
      if (plan.length) {
        const forward = await engine.convertTriggersToGalaxy(result.output.triggerData,
          {...prepared, ...result.output.generationOptions, triggerStrings: result.output.triggerStrings,
            ...(result.output.customAi ? {customAi: result.output.customAi} : {})}, signal);
        assert(!forward.diagnostics?.some(d => d.severity === 'error'), 'PRESERVED_SOURCE_FORWARD_FAILED');
        sourceIncludes = verifyPreservedSourceIncludes(plan, [forward.output.header, forward.output.script].filter(Boolean).join('\n'));
      }
      // This is an explicit packing instruction, not evidence that an archive was
      // already written or that its logic passed the independent benchmark.
      return {...result, output: {...result.output,
        generationOptions:{...result.output.generationOptions,[sourceConstantLayout]:createSourceConstantLayout({source:input.script??'',header:input.header??'',xml:result.output.triggerData})},
        ...(initializerOrigins?{generationOptions:{...result.output.generationOptions,[sourceConstantLayout]:createSourceConstantLayout({source:input.script??'',header:input.header??'',xml:result.output.triggerData}),[authoredInitializerOrigins]:result.output.generationOptions?.[authoredInitializerOrigins]??initializerOrigins}}:{}),
        ...(preserved.length ? {preservedGalaxyScripts: preserved} : {})},
        guiRecovery: {policy, gui, sourceIncludes, retainedNominalInterfaces:nominalGuiReplay, retainedAiSources:aiRecoveryInputs.retained, sourceCallInterfaces:preservedSourceCallInterfaceProof(), authoredSections:authoredSectionProof(),initializerOrigins:initializerOrigins&&{profile:result.output.generationOptions?.[authoredInitializerOrigins]??initializerOrigins,decisions:initializerRecords}, preservedGalaxyScripts: preserved.map(({fileName, originalPath, sha256}) => ({fileName, originalPath, sha256})),
          archivePackingVerified: false, benchmarkVerdictChanged: false}};
      }))));
    },
    async convertTriggersToGalaxy(xml,input,signal) {
      const decisions=[];
      const result=await withAuthoredInitializerOrigins(input?.[authoredInitializerOrigins],xml,xmlTree,
        ()=>engine.convertTriggersToGalaxy(xml,input,signal),decisions);
      const layout=applySourceConstantLayout(input?.[sourceConstantLayout],xml,result.output);
      const output=layout.output===result.output?result:{...result,output:layout.output,sourceConstantLayoutProof:layout.proof};
      return input?.[authoredInitializerOrigins]?{...output,initializerOriginProof:{profile:input[authoredInitializerOrigins],decisions}}:output;
    },
  }));
}

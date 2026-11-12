import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {logicalSourcePath} from '../model/source-ownership.mjs';
import {resolveGuiRecoveryPolicy} from '../model/gui-recovery-policy.source-includes.mjs';
import {verifyAuthoredCodePolicy} from '../verification/authored-code-preservation.guarded.mjs';
import {withPreservedSourceIncludes, verifyPreservedSourceIncludes} from '../bindings/preserved-source-includes.guarded.mjs';
import {authoredInitializerOrigins,createAuthoredInitializerOrigins,withAuthoredInitializerOrigins} from '../model/initializer-origins.scoped-symbol.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');
function sourceFiles(files = []) {
  assert(Array.isArray(files), 'ADDITIONAL_SCRIPTS_ARRAY_REQUIRED');
  const seen = new Set(), names = new Set();
  return files.map(file => {
    const owner = logicalSourcePath(file.originalPath ?? file.fileName);
    const name = logicalSourcePath(file.fileName);
    assert(!seen.has(owner), 'DUPLICATE_OWNED_SCRIPT_PATH'); seen.add(owner);
    assert(!names.has(name), 'AMBIGUOUS_OWNED_SCRIPT_FILENAME'); names.add(name);
    assert.equal(typeof file.text, 'string', 'OWNED_SCRIPT_TEXT_REQUIRED');
    const digest = sha(file.text);
    assert(file.sha256 === undefined || file.sha256 === digest, 'OWNED_SCRIPT_SHA_MISMATCH');
    return Object.freeze({...file, sha256: digest});
  });
}

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
  return Object.freeze({
    async convertGalaxyToTriggers(input, signal) {
      signal?.throwIfAborted();
      const policy = resolveGuiRecoveryPolicy(input), files = sourceFiles(input.additionalScripts);
      const initializerOrigins=input[authoredInitializerOrigins]??(input.existingTriggerData?.trim()
        ?createAuthoredInitializerOrigins({xml:input.existingTriggerData,xmlTree,libraryId:input.libraryId??'Map',
          sources:[{fileName:'primary.galaxy',text:input.script??''},{fileName:'primary-header.galaxy',text:input.header??''},...files]})
        :undefined);
      return withPreservedSourceIncludes(policy, input, files, async plan => {
      // Kept files still supply declarations. They must never disappear from the
      // compiler's symbol universe merely because they are not being lowered.
      const prepared = {...input, guiRecoveryMode: policy.mode,[authoredInitializerOrigins]:initializerOrigins,
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
      const gui = verifyAuthoredCodePolicy({before: input.existingTriggerData ?? '',
        after: result.output.triggerData, policy, xmlTree, libraryId: input.libraryId ?? 'Map'});
      const preserved = policy.preserveAuthoredCode ? files : [];
      let sourceIncludes = {required: [], preserved: true};
      if (plan.length) {
        const forward = await engine.convertTriggersToGalaxy(result.output.triggerData,
          {...prepared, ...result.output.generationOptions, triggerStrings: result.output.triggerStrings}, signal);
        assert(!forward.diagnostics?.some(d => d.severity === 'error'), 'PRESERVED_SOURCE_FORWARD_FAILED');
        sourceIncludes = verifyPreservedSourceIncludes(plan, [forward.output.header, forward.output.script].filter(Boolean).join('\n'));
      }
      // This is an explicit packing instruction, not evidence that an archive was
      // already written or that its logic passed the independent benchmark.
      return {...result, output: {...result.output,
        ...(initializerOrigins?{generationOptions:{...result.output.generationOptions,[authoredInitializerOrigins]:initializerOrigins}}:{}),
        ...(preserved.length ? {preservedGalaxyScripts: preserved} : {})},
        guiRecovery: {policy, gui, sourceIncludes,initializerOrigins:initializerOrigins&&{profile:initializerOrigins,decisions:initializerRecords}, preservedGalaxyScripts: preserved.map(({fileName, originalPath, sha256}) => ({fileName, originalPath, sha256})),
          archivePackingVerified: false, benchmarkVerdictChanged: false}};
      });
    },
    async convertTriggersToGalaxy(xml,input,signal) {
      const decisions=[];
      const result=await withAuthoredInitializerOrigins(input?.[authoredInitializerOrigins],xml,xmlTree,
        ()=>engine.convertTriggersToGalaxy(xml,input,signal),decisions);
      return input?.[authoredInitializerOrigins]?{...result,initializerOriginProof:{profile:input[authoredInitializerOrigins],decisions}}:result;
    },
  });
}

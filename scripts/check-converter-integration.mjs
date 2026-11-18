import { primaryLocalizedTable } from '../src/libraries/gui/primary-localized-table.mjs';
/** End-to-end API checks against real NativeLib and the unchanged external oracle.
 * Required game data stays outside the repository; no Editor is involved. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import {
  convertGalaxyToTriggers,
  convertTriggersToGalaxy,
  createTriggerConversionContext,
} from '../src/conversion/index.mjs';
import { xmlTree } from '../src/sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
import { openPinnedUserOracle } from '../src/verification/pinned-user-oracle.mjs';

const option = (name, fallback) => {
  const at = process.argv.indexOf(name);
  const value = at < 0 ? fallback : process.argv[at + 1];
  assert(typeof value === 'string' && value && !value.startsWith('--'), `${name} is required`);
  return value;
};
const nativeRoot = option('--native-root', process.env.SC2_TRIGGER_NATIVE_ROOT);
const benchmarkRoot = option('--benchmark-root', process.env.SC2_TRIGGER_BENCHMARK_ROOT);
const sha = (x) => createHash('sha256').update(x).digest('hex');
const nativeFiles = new Map(
  await Promise.all(
    ['NativeLib.TriggerLib', 'natives.galaxy', 'NativeLib_h.galaxy', 'NativeLib.galaxy'].map(
      async (name) => [name, await readFile(path.join(nativeRoot, name), 'utf8')],
    ),
  ),
);
const conversionContext = createTriggerConversionContext({
  maxDependencyCacheEntries: 0,
  maxDependencyCacheSourceBytes: 0,
});
const common = {
  dependencyLibraries: [
    {
      sourcePath: 'TriggerLibs/NativeLib.TriggerLib',
      triggerData: nativeFiles.get('NativeLib.TriggerLib'),
      triggerStrings: '',
    },
  ],
  galaxyDeclarations: [...nativeFiles]
    .filter(([name]) => name.endsWith('.galaxy'))
    .map(([name, text]) => ({ fileName: 'TriggerLibs/' + name, text })),
  strictSymbols: true,
  guiRecoveryMode: 'preserve-source',
  conversionContext,
};
const oracle = await openPinnedUserOracle({ root: benchmarkRoot });
const program = (output) => output.header + '\n' + output.script;
function assertEquivalent(expected, actual) {
  const result = oracle.compare(expected, actual);
  assert(result.syntaxValid && result.exact, JSON.stringify(result));
}
assert(
  !oracle.compare('int f() { return 1; }', 'int f() { return 2; }').exact,
  'Changed results must fail the oracle',
);
assert(
  !oracle.compare(
    'void InitGlobals() {} void InitMap() { InitGlobals(); }',
    'void InitGlobals() {} void InitMap() {}',
  ).exact,
  'Lost initialization must fail the oracle',
);

// A small authored GUI example, not a corpus map or a synthesized API wrapper.
// The fixture deliberately uses real standard Return/Arithmetic definitions.
function authoredXml(kind) {
  const owner = kind === 'map' ? 'Map' : 'TEST';
  const open = kind === 'map' ? '<Standard Id="Map"/>' : '<Library Id="TEST">';
  return `<TriggerData>${open}<Root><Item Type="Category" Library="${owner}" Id="C"/></Root>
<Element Type="Category" Id="C"><Identifier>Author folder</Identifier><RecoveryNote Keep="yes"/><Item Type="FunctionDef" Library="${owner}" Id="F"/></Element>
<Element Type="FunctionDef" Id="F"><Identifier>Increment</Identifier><FlagCall/><ReturnType><Type Value="int"/></ReturnType><Parameter Type="ParamDef" Library="${owner}" Id="X"/><FunctionCall Type="FunctionCall" Library="${owner}" Id="RETURN"/></Element>
<Element Type="ParamDef" Id="X"><Identifier>value</Identifier><ParameterType><Type Value="int"/></ParameterType></Element>
<Element Type="FunctionCall" Id="RETURN"><FunctionDef Type="FunctionDef" Library="Ntve" Id="00000097"/><Parameter Type="Param" Library="${owner}" Id="EXPR"/></Element>
<Element Type="Param" Id="EXPR"><ParameterDef Type="ParamDef" Library="Ntve" Id="00000488"/><FunctionCall Type="FunctionCall" Library="${owner}" Id="ADD"/></Element>
<Element Type="FunctionCall" Id="ADD"><FunctionDef Type="FunctionDef" Library="Ntve" Id="00000128"/><Parameter Type="Param" Library="${owner}" Id="LEFT"/><Parameter Type="Param" Library="${owner}" Id="OP"/><Parameter Type="Param" Library="${owner}" Id="RIGHT"/></Element>
<Element Type="Param" Id="LEFT"><ParameterDef Type="ParamDef" Library="Ntve" Id="00000205"/><Parameter Type="ParamDef" Library="${owner}" Id="X"/></Element>
<Element Type="Param" Id="OP"><ParameterDef Type="ParamDef" Library="Ntve" Id="00000206"/><Preset Type="PresetValue" Library="Ntve" Id="00000085"/></Element>
<Element Type="Param" Id="RIGHT"><ParameterDef Type="ParamDef" Library="Ntve" Id="00000207"/><ValueType Type="int"/><Value>1</Value></Element>
${kind === 'map' ? '' : '</Library>'}</TriggerData>`;
}
function elements(xml) {
  const out = new Map();
  const visit = (node) => {
    if (node.tag === 'Element')
      out.set(node.attributes.Type + ':' + node.attributes.Id, xml.slice(node.start, node.end));
    node.children.forEach(visit);
  };
  visit(xmlTree(xml));
  return out;
}
function noWrappers(xml) {
  assert(
    !/<(?:FlagNative|ScriptCode|CustomScript)\b/u.test(xml),
    'New native or raw GUI wrappers are forbidden',
  );
}
const results = [];
try {
  for (const kind of ['map', 'library']) {
    const xml = authoredXml(kind),
      libraryId = kind === 'map' ? 'Map' : 'TEST';
    const input = { ...common, libraryId, documentKind: kind };
    const baseline = await convertTriggersToGalaxy(xml, input);
    for (const mode of kind === 'map'
      ? ['fresh', 'unchanged', 'added', 'changed', 'empty-envelope']
      : ['fresh']) {
      let script = baseline.output.script;
      if (mode === 'added') script += '\nint gf_Decrement(int lp_value) { return lp_value - 1; }\n';
      if (mode === 'changed') {
        assert(script.includes('(lp_value + 1)'));
        script = script.replace('(lp_value + 1)', '(lp_value + 3)');
      }
      const started = performance.now();
      const recovered = await convertGalaxyToTriggers({
        ...input,
        script,
        header: baseline.output.header,
        ...(mode === 'fresh'
          ? {}
          : { existingTriggerData: mode === 'empty-envelope' ? '<TriggerData/>' : xml }),
      });
      const elapsedMs = performance.now() - started;
      noWrappers(recovered.output.triggerData);
      if (mode === 'unchanged') {
        assert.equal(recovered.incremental.mode, 'UNCHANGED');
        assert.equal(recovered.output.triggerData, xml);
      }
      if (['added', 'changed'].includes(mode)) {
        assert.equal(recovered.incremental.mode, 'INCREMENTAL');
        assert.equal(recovered.incremental.changes.length, 1);
        const before = elements(xml),
          after = elements(recovered.output.triggerData);
        if (mode === 'added')
          for (const [key, bytes] of before)
            if (key !== 'Category:C')
              assert.equal(after.get(key), bytes, 'Unchanged authored element was rebuilt: ' + key);
        assert(after.get('Category:C').includes('<RecoveryNote Keep="yes"/>'));
        assert(after.get('Category:C').includes('<Identifier>Author folder</Identifier>'));
        assert(after.has('FunctionDef:F'));
      }
      if (mode === 'empty-envelope') assert.equal(recovered.incremental.mode, 'FULL_REBUILD');
      if (recovered.fidelity?.verification) {
        assert.equal(recovered.fidelity.verification.sourceGalaxyValidation.status, 'passed');
        assert.equal(recovered.fidelity.verification.galaxyValidation.status, 'passed');
      }
      const actual = await convertTriggersToGalaxy(recovered.output.triggerData, {
        ...input,
        ...recovered.output.generationOptions,
        triggerStrings: recovered.output.triggerStrings ?? '',
      });
      assertEquivalent(baseline.output.header + '\n' + script, program(actual.output));
      results.push({
        kind,
        mode,
        elapsedMs: Math.round(elapsedMs),
        changes: recovered.incremental?.changes,
      });
      console.log(JSON.stringify(results.at(-1)));
    }
  }
  // Compiler-created threaded storage belongs to GUI functions, even when their
  // only name is in TriggerStrings. An alphabetically earlier sparse locale must
  // not make that function and its argument storage disappear during completion.
  const threadedXml = `<TriggerData><Library Id="AB123456"><Root><Item Type="FunctionDef" Library="AB123456" Id="F"/></Root>
<Element Type="FunctionDef" Id="F"><FlagAction/><FlagCreateThread/><FlagNoScriptPrefix/><Parameter Type="ParamDef" Library="AB123456" Id="A"/><Parameter Type="ParamDef" Library="AB123456" Id="B"/></Element>
<Element Type="ParamDef" Id="A"><Identifier>duration</Identifier><ParameterType><Type Value="fixed"/></ParameterType></Element>
<Element Type="ParamDef" Id="B"><Identifier>count</Identifier><ParameterType><Type Value="int"/></ParameterType></Element></Library></TriggerData>`;
  const locales = [
    { locale: 'deDE', triggerStrings: '', gameStrings: '' },
    {
      locale: 'enUS',
      triggerStrings: 'FunctionDef/Name/lib_AB123456_F=Delay Dispatch\n',
      gameStrings: '',
    },
  ];
  const threadedInput = {
    ...common,
    ...primaryLocalizedTable(locales),
    localizedStrings: locales,
    libraryId: 'AB123456',
    documentKind: 'library',
  };
  const threaded = await convertTriggersToGalaxy(threadedXml, threadedInput);
  assert.equal((threaded.output.script.match(/^(?:trigger|fixed|int) auto_/gm) ?? []).length, 3);
  const completeInput = {
    ...threadedInput,
    existingTriggerData: threadedXml,
    script: threaded.output.script,
    header: threaded.output.header,
  };
  await assert.rejects(
    convertGalaxyToTriggers({ ...completeInput, ...locales[0] }),
    /Changes to globals\/includes\/structures/,
    'The sparse locale must reproduce the missing threaded declarations failure',
  );
  const completed = await convertGalaxyToTriggers(completeInput);
  assert.equal(completed.incremental.mode, 'UNCHANGED');
  assert.equal(completed.output.triggerData, threadedXml);
  noWrappers(completed.output.triggerData);
  const emitted = await convertTriggersToGalaxy(completed.output.triggerData, threadedInput);
  assertEquivalent(program(threaded.output), program(emitted.output));
  await assert.rejects(
    convertGalaxyToTriggers({
      ...completeInput,
      script: threaded.output.script + '\nint newGlobal = 4;\n',
    }),
    /Changes to globals\/includes\/structures/,
  );
  results.push({ kind: 'library', mode: 'threaded-localized-unchanged', changes: [] });
  console.log(JSON.stringify(results.at(-1)));
  // GUI Constant marks a structure field as read-only in the editor. It does
  // not remove its per-instance runtime default, including a native call.
  const constantMemberXml = `<TriggerData><Library Id="AB123456"><Root><Item Type="Variable" Library="AB123456" Id="D"/></Root>
<Element Type="Structure" Id="A"><Identifier>State</Identifier><Variable Type="Variable" Library="AB123456" Id="B"/><Variable Type="Variable" Library="AB123456" Id="F"/></Element>
<Element Type="Variable" Id="F"><Identifier>disabledPlayers</Identifier><Disabled/><VariableType><Type Value="playergroup"/></VariableType><Value Type="Param" Library="AB123456" Id="C"/></Element>
<Element Type="Variable" Id="B"><Identifier>players</Identifier><VariableType><Type Value="playergroup"/><Constant/></VariableType><Value Type="Param" Library="AB123456" Id="C"/></Element>
<Element Type="Param" Id="C"><FunctionCall Type="FunctionCall" Library="AB123456" Id="E"/></Element>
<Element Type="FunctionCall" Id="E"><FunctionDef Type="FunctionDef" Library="Ntve" Id="00000056"/></Element>
<Element Type="Variable" Id="D"><Identifier>state</Identifier><VariableType><Type Value="struct"/><TypeElement Type="Structure" Library="AB123456" Id="A"/></VariableType></Element></Library></TriggerData>`;
  const constantInput = { ...common, libraryId: 'AB123456', documentKind: 'library' };
  const initialized = await convertTriggersToGalaxy(constantMemberXml, constantInput);
  assert.equal((initialized.output.script.match(/PlayerGroupEmpty\(\)/g) ?? []).length, 1);
  assert(!initialized.output.header.includes('lv_disabledPlayers'));
  assert(!initialized.output.script.includes('lv_disabledPlayers'));
  assert(
    initialized.output.script.includes('libAB123456_gv_state.lv_players = PlayerGroupEmpty();'),
  );
  const retained = await convertGalaxyToTriggers({
    ...constantInput,
    existingTriggerData: constantMemberXml,
    script: initialized.output.script,
    header: initialized.output.header,
  });
  assert.equal(retained.incremental.mode, 'UNCHANGED');
  assert.equal(retained.output.triggerData, constantMemberXml);
  noWrappers(retained.output.triggerData);
  const constantForward = await convertTriggersToGalaxy(retained.output.triggerData, constantInput);
  assertEquivalent(program(initialized.output), program(constantForward.output));
  results.push({ kind: 'library', mode: 'constant-structure-runtime-default', changes: [] });
  console.log(JSON.stringify(results.at(-1)));
  // Editor emits its bool default for an empty condition list. Empty OR is
  // therefore true here; replacing it with mathematical OR identity is unsafe.
  const emptyOrXml = `<TriggerData><Library Id="AB123456"><Root><Item Type="FunctionDef" Library="AB123456" Id="A"/></Root>
<Element Type="FunctionDef" Id="A"><Identifier>EmptyCondition</Identifier><FlagAction/><FunctionCall Type="FunctionCall" Library="AB123456" Id="B"/></Element>
<Element Type="FunctionCall" Id="B"><FunctionDef Type="FunctionDef" Library="Ntve" Id="00000137"/><FunctionCall Type="FunctionCall" Library="AB123456" Id="C"/><FunctionCall Type="FunctionCall" Library="AB123456" Id="D"/></Element>
<Element Type="FunctionCall" Id="C"><FunctionDef Type="FunctionDef" Library="Ntve" Id="00000133"/><SubFunctionType Type="SubFuncType" Library="Ntve" Id="00000003"/></Element>
<Element Type="FunctionCall" Id="D"><FunctionDef Type="FunctionDef" Library="Ntve" Id="00000139"/><SubFunctionType Type="SubFuncType" Library="Ntve" Id="00000004"/></Element></Library></TriggerData>`;
  const emptyOr = await convertTriggersToGalaxy(emptyOrXml, constantInput);
  assert(emptyOr.output.script.includes('if ((true))'));
  const emptyOrRecovered = await convertGalaxyToTriggers({
    ...constantInput,
    existingTriggerData: emptyOrXml,
    script: emptyOr.output.script,
    header: emptyOr.output.header,
  });
  assert.equal(emptyOrRecovered.incremental.mode, 'UNCHANGED');
  assert.equal(emptyOrRecovered.output.triggerData, emptyOrXml);
  noWrappers(emptyOrRecovered.output.triggerData);
  const emptyOrForward = await convertTriggersToGalaxy(
    emptyOrRecovered.output.triggerData,
    constantInput,
  );
  assertEquivalent(program(emptyOr.output), program(emptyOrForward.output));
  assert(
    !oracle.compare(
      program(emptyOr.output),
      program(emptyOr.output).replace('if ((true))', 'if ((false))'),
    ).exact,
  );
  results.push({ kind: 'library', mode: 'empty-or-editor-default', changes: [] });
  console.log(JSON.stringify(results.at(-1)));
  await oracle.verify();
} finally {
  conversionContext.clear();
}
console.log(
  JSON.stringify({
    passed: results.length,
    oracleAssets: oracle.assets,
    oracleManifest: oracle.manifestSha256,
    nativeData: Object.fromEntries([...nativeFiles].map(([name, text]) => [name, sha(text)])),
    editorVerified: false,
  }),
);

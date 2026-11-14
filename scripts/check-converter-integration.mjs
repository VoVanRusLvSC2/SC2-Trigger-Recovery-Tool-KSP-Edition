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

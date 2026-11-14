import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { convertGalaxyToTriggers, convertTriggersToGalaxy } from '../src/conversion/index.mjs';
const root = process.env.SC2_TRIGGER_NATIVE_ROOT;
assert(root, 'SC2_TRIGGER_NATIVE_ROOT required');
const read = (name) => readFile(path.join(root, name), 'utf8');
const triggerData = await read('NativeLib.TriggerLib');
const names = ['natives.galaxy', 'NativeLib_h.galaxy', 'NativeLib.galaxy'];
const galaxyDeclarations = await Promise.all(
  names.map(async (name) => ({ fileName: 'TriggerLibs/' + name, text: await read(name) })),
);
const options = {
  libraryId: 'Map',
  documentKind: 'map',
  dependencyLibraries: [
    { sourcePath: 'TriggerLibs/NativeLib.TriggerLib', triggerData, triggerStrings: '' },
  ],
  galaxyDeclarations,
  strictSymbols: true,
  guiRecoveryMode: 'preserve-source',
};
const script =
  'bool[4] gv_flags;\nbool gf_Check (int lp_index) {\n if (gv_flags[lp_index]) { return true; }\n return false;\n}\n';
const recovered = await convertGalaxyToTriggers({ ...options, script, header: '' });
assert(
  !/<(?:FlagNative|ScriptCode|CustomScript)\b/u.test(recovered.output.triggerData),
  'generated raw or Native',
);
const generated = await convertTriggersToGalaxy(recovered.output.triggerData, {
  ...options,
  ...recovered.output.generationOptions,
  triggerStrings: recovered.output.triggerStrings ?? '',
});
const output = generated.output.header + '\n' + generated.output.script;
assert(/gv_flags\s*\[\s*lp_index\s*\]/u.test(output), 'Boolean array reference lost');
assert(/==\s*true/u.test(output), 'Boolean GUI comparison missing');
assert(/return\s+true/u.test(output) && /return\s+false/u.test(output), 'Branch returns lost');
console.log(
  'Boolean array condition restored through a standard GUI comparison; no new Native or raw code.',
);

import { primaryLocalizedTable } from '../src/libraries/gui/primary-localized-table.mjs';
/** Library/package boundaries: no map wrapper, no unrelated GUI or payload loss. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { modLibraryUnits } from '../src/cli/mod-library-units.mjs';
import { mergeLibrary, mergeStringTable, assertNoNewRawGui } from '../src/cli/mod-document.mjs';
import { writePackageCandidate } from '../src/cli/package-candidate.mjs';
import { encodeFreshMpq } from '../src/vendor/@modkit/blizzard-mpq/src/mpq/fresh-writer.js';
const german = { locale: 'deDE', triggerStrings: 'Sparse table' };
const english = { locale: 'enUS', triggerStrings: 'Original compiler names' };
assert.equal(primaryLocalizedTable([german, english]), english);
assert.equal(primaryLocalizedTable([english, german]), english);
assert.equal(primaryLocalizedTable([german]), german);
assert.equal(primaryLocalizedTable([german, english], 'deDE'), german);
assert.deepEqual(primaryLocalizedTable([]), {});
assert.equal(german.triggerStrings, 'Sparse table');
const a =
  '<Library Id="A"><Root/><Element Type="Category" Id="folder"><Identifier>Keep</Identifier></Element></Library>';
const b = '<Library Id="B"><Root/></Library>';
const source = '<?xml version="1.0"?><TriggerData><!--keep-->' + a + b + '</TriggerData>';
const changed =
  '<TriggerData><Library Id="B"><Root/><Element Type="FunctionDef" Id="new"/></Library></TriggerData>';
const merged = mergeLibrary(source, changed, 'B');
assert(merged.includes(a));
assert(merged.includes('<!--keep-->'));
assert(merged.includes('Id="new"'));
assert.equal(mergeLibrary(source, source, 'A'), source);
assert(mergeLibrary('', changed, 'B').includes('Id="new"'));
assert.equal(mergeStringTable('\uFEFFx=one\r\ny=two\r\n', 'x=one'), '\uFEFFx=one\r\ny=two\r\n');
assert(mergeStringTable('x=one\ny=two\n', 'x=changed\nz=new').includes('y=two'));
assertNoNewRawGui(source, merged);
assert.throws(
  () =>
    assertNoNewRawGui(
      source,
      '<TriggerData><Library Id="B"><Element Type="FunctionDef" Id="new"><FlagNative/></Element></Library></TriggerData>',
    ),
  /forbidden/,
);
assert.deepEqual(
  modLibraryUnits(['Base.SC2Data/LibAB12.galaxy', 'Base.SC2Data/LibAB12_h.galaxy', 'Other.galaxy']),
  [
    {
      libraryId: 'AB12',
      body: 'Base.SC2Data/LibAB12.galaxy',
      header: 'Base.SC2Data/LibAB12_h.galaxy',
    },
  ],
);
assert.equal(modLibraryUnits(['LibA.galaxy']).length, 0);
if (process.platform === 'win32') {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'recovery-mod-pack-'));
  const entries = [
    { path: 'Triggers', bytes: Buffer.from(source) },
    { path: 'Base.SC2Data/LibB.galaxy', bytes: Buffer.from('void libB_InitLib() {}') },
    { path: 'Attributes', bytes: Buffer.from('<Attributes/>') },
    { path: 'Assets/raw.bin', bytes: Buffer.from([0, 255, 17]) },
  ];
  const original = path.join(directory, 'input.SC2Mod');
  await fs.writeFile(original, encodeFreshMpq(entries));
  const bytes = await fs.readFile(original);
  const output = path.join(directory, 'output');
  await fs.mkdir(output);
  const packed = await writePackageCandidate(
    {
      archive: original,
      name: 'output.SC2Mod',
      mpq: path.resolve(import.meta.dirname, '../.runtime/tools/mpqcli.exe'),
    },
    output,
    new Map([['Triggers', Buffer.from(merged)]]),
    entries.map((entry) => ({
      path: entry.path,
      sha256: createHash('sha256').update(entry.bytes).digest('hex'),
    })),
  );
  assert.equal(packed.preservedComponents, 3);
  assert.deepEqual(await fs.readFile(original), bytes);
}
console.log(
  'Mod boundaries passed: library pairs, scoped XML, localized keys, wrapper refusal, preserved attributes/runtime/assets and original archive.',
);

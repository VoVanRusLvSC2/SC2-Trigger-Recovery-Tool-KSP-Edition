/** Verify that a diagnostic archive preserves source bytes and cannot overwrite
 * existing GUI or a previously created preview. No Editor or game required. */
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { createUnverifiedPreviewMap } from '../src/cli/unverified-preview-map.mjs';
import { openMpqReader } from '../src/vendor/@modkit/blizzard-mpq/src/mpq/codec.js';

const execute = promisify(execFile);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const root = path.resolve(import.meta.dirname, '..');
const mpq = path.join(root, '.runtime/tools/mpqcli.exe');
const temp = await mkdtemp(path.join(os.tmpdir(), 'unverified-map-check-'));
const input = path.join(temp, 'input');
const locale = path.join(input, 'enUS.SC2Data/LocalizedData');
const job = path.join(temp, 'job');
const preview = path.join(job, 'UNVERIFIED_PREVIEW');
await mkdir(locale, { recursive: true });
await mkdir(preview, { recursive: true });
await writeFile(path.join(input, 'MapScript.galaxy'), 'void InitMap() {}\n');
await writeFile(path.join(locale, 'GameStrings.txt'), 'Old/Key=Original\n');
await writeFile(path.join(locale, 'TriggerStrings.txt'), 'Trigger/Name/OLD=Old name\n');
const original = path.join(temp, 'original.SC2Map');
await execute(mpq, ['create', input, '--output', original, '--game', 'starcraft2'], {
  windowsHide: true,
});
const originalBytes = await readFile(original);
const limits = { maxArchiveBytes: 1024 ** 3, maxEntries: 100000, maxEntryBytes: 256 * 1024 ** 2 };
const reader = await openMpqReader(originalBytes, limits);
const entries = [];
for (const entry of reader.entries)
  entries.push({ path: entry.path, sha256: sha(Buffer.from(await reader.read(entry.id))) });
reader.dispose();
const config = path.join(temp, 'config.json');
await writeFile(config, JSON.stringify({ entries }));
await writeFile(path.join(job, 'SOURCE_GUI_INPUT.json'), JSON.stringify({ present: false }));
const triggerData = '<TriggerData><Root/></TriggerData>\n';
await writeFile(path.join(preview, 'Triggers'), triggerData);
const row = {
  original,
  originalSha256: sha(originalBytes),
  config,
  job,
  name: 'original.SC2Map',
  mpq,
};
const args = { row, preview, triggerData, names: ['Trigger/Name/NEW=Recovered'] };
const draft = await createUnverifiedPreviewMap(args);
assert.equal(draft.accepted, false);
assert.equal(draft.editorVerified, false);
assert.equal(draft.originalGalaxyPreserved, true);
assert.equal(sha(await readFile(original)), row.originalSha256);
const packed = await openMpqReader(await readFile(draft.path), limits);
const content = async (name) =>
  Buffer.from(await packed.read(packed.find(name).id)).toString('utf8');
assert.equal(await content('MapScript.galaxy'), 'void InitMap() {}\n');
assert.equal(await content('Triggers'), triggerData);
assert.match(
  await content('enUS.SC2Data/LocalizedData/TriggerStrings.txt'),
  /Old name\nTrigger\/Name\/NEW=Recovered/,
);
packed.dispose();
await assert.rejects(createUnverifiedPreviewMap(args));
await stat(draft.path);
await writeFile(path.join(job, 'SOURCE_GUI_INPUT.json'), JSON.stringify({ present: true }));
await assert.rejects(createUnverifiedPreviewMap(args), /original without Triggers/);
assert.equal(sha(await readFile(original)), row.originalSha256);
console.log(
  'Unverified map checks passed: actual MPQ, immutable source, original Galaxy and names, no overwrites, and authored GUI refusal.',
);

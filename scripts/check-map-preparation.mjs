/** Reject archive-path traversal and unsafe output reuse before opening SC2. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safeComponentPath, prepareMap } from '../src/cli/prepare-map.mjs';
assert.equal(
  safeComponentPath('enUS.SC2Data\\LocalizedData\\GameStrings.txt'),
  'enUS.SC2Data/LocalizedData/GameStrings.txt',
);
for (const name of ['../out', '/absolute', 'C:\\out', 'a//b', 'a/./b', 'a/../b', 'a\0b'])
  assert.throws(() => safeComponentPath(name));
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'trigger-preparation-'));
const original = path.join(temporary, 'original.SC2Map');
await fs.writeFile(original, 'not an archive');
await assert.rejects(
  prepareMap({ original, installation: temporary, output: temporary, mpq: original }),
  /contain original|protected/,
);
const existing = path.join(temporary, 'existing');
await fs.mkdir(existing);
await assert.rejects(
  prepareMap({ original, installation: os.tmpdir(), output: existing, mpq: original }),
  /protected|EEXIST/,
);
assert.equal(await fs.readFile(original, 'utf8'), 'not an archive');
console.log(
  'Preparation guards passed: traversal, protected inputs, output reuse and original bytes.',
);

/** Reject archive-path traversal and unsafe output reuse before opening SC2. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safeComponentPath, prepareMap } from '../src/cli/prepare-map.mjs';
import {
  openSc2Package,
  verifyComponentSource,
  packComponentSnapshot,
} from '../src/cli/sc2-package.mjs';
import { createHash } from 'node:crypto';
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
const absentIndexOutput = path.join(temporary, 'no-attribute-index-output');
await assert.rejects(
  prepareMap({
    original,
    installation: temporary,
    output: absentIndexOutput,
    mpq: original,
    attributeIndex: path.join(temporary, 'missing-index.json'),
  }),
  /ENOENT/,
);
await assert.rejects(fs.access(absentIndexOutput), /ENOENT/);
await fs.mkdir(existing);
await assert.rejects(
  prepareMap({ original, installation: os.tmpdir(), output: existing, mpq: original }),
  /protected|EEXIST/,
);
assert.equal(await fs.readFile(original, 'utf8'), 'not an archive');
const folder = path.join(temporary, 'Components.SC2Map');
await fs.mkdir(path.join(folder, 'Base.SC2Data'), { recursive: true });
const component = path.join(folder, 'Base.SC2Data', 'library.galaxy');
const source = Buffer.from('void Test() {}\r\n');
await fs.writeFile(component, source);
const reader = await openSc2Package(folder);
const entry = reader.find('BASE.SC2DATA\\LIBRARY.GALAXY');
assert(entry);
assert.deepEqual(Buffer.from(await reader.read(entry.id)), source);
reader.dispose();
const observation = {
  path: folder,
  entries: [{ path: entry.path, sha256: createHash('sha256').update(source).digest('hex') }],
};
await verifyComponentSource(observation);
if (process.platform === 'win32') {
  const internal = Buffer.from('old container listing');
  await fs.writeFile(path.join(folder, '(listfile)'), internal);
  observation.entries.push({
    path: '(listfile)',
    sha256: createHash('sha256').update(internal).digest('hex'),
  });
  const archive = path.join(temporary, 'snapshot.SC2Map');
  await packComponentSnapshot(
    path.resolve(import.meta.dirname, '../.runtime/tools/mpqcli.exe'),
    folder,
    archive,
    observation.entries,
  );
  const packed = await openSc2Package(archive);
  assert.deepEqual(Buffer.from(await packed.read(packed.find(entry.path).id)), source);
  packed.dispose();
  await verifyComponentSource(observation);
}
await fs.writeFile(component, 'changed');
await assert.rejects(verifyComponentSource(observation), /Source component changed/);
await assert.rejects(openSc2Package(folder, { maxEntryBytes: 2 }), /size limit/);
console.log(
  'Preparation guards passed: traversal, protected inputs, output reuse and original bytes.',
);

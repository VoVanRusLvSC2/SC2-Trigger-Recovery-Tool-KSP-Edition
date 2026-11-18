/** Pack only requested edits into a separate archive and verify every payload. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { openSc2Package, safeComponentPath } from './sc2-package.mjs';
const execute = promisify(execFile);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const metadata = /^\((?:listfile|attributes|signature)\)$/i;

export async function writePackageCandidate(row, directory, changes, entries) {
  const building = path.join(directory, 'BUILDING.tmp');
  const candidate = path.join(directory, row.name);
  await fs.copyFile(row.archive, building, constants.COPYFILE_EXCL);
  const requested = new Map();
  for (const [name, bytes] of changes) {
    const key = safeComponentPath(name).toLowerCase();
    assert(!requested.has(key), 'Duplicate package edit: ' + name);
    requested.set(key, sha(bytes));
    const file = path.join(directory, 'components', ...name.split('/'));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes, { flag: 'wx' });
    await execute(
      row.mpq,
      [
        'add',
        building,
        file,
        '--path',
        name.replaceAll('/', '\\'),
        '--overwrite',
        '--game',
        'starcraft2',
      ],
      { windowsHide: true, maxBuffer: 8 * 1024 ** 2 },
    );
  }
  const packed = await openSc2Package(building);
  try {
    const expected = new Map(
      entries
        .filter((entry) => !metadata.test(entry.path))
        .map((entry) => [entry.path.toLowerCase(), entry.sha256]),
    );
    for (const [key, digest] of requested) expected.set(key, digest);
    const actual = packed.entries.filter((entry) => !metadata.test(entry.path));
    assert.equal(actual.length, expected.size, 'Candidate component count changed');
    for (const entry of actual)
      assert.equal(
        sha(await packed.read(entry.id)),
        expected.get(entry.path.toLowerCase()),
        'Candidate component mismatch: ' + entry.path,
      );
    await fs.copyFile(building, candidate, constants.COPYFILE_EXCL);
    await fs.unlink(building);
    return {
      candidate,
      sha256: sha(await fs.readFile(candidate)),
      changedComponents: [...changes.keys()],
      preservedComponents: expected.size - requested.size,
    };
  } finally {
    packed.dispose();
  }
}

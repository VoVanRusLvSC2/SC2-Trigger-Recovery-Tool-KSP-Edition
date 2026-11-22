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

/** Stage only manifest entries, then add them to the copied archive in one
 * invocation. Full inventory and payload verification follow in the caller. */
export async function addVerifiedMapComponents(mpq, candidate, directory, components) {
  if (!components.length) return;
  const stage = await fs.mkdtemp(path.join(directory, 'packing-'));
  try {
    const source = path.join(directory, 'components');
    const names = new Set();
    for (const component of components) {
      const name = safeComponentPath(component.path);
      const key = name.toLowerCase();
      assert(!names.has(key), 'Duplicate package edit: ' + name);
      names.add(key);
      const bytes = await fs.readFile(path.join(source, ...name.split('/')));
      assert.equal(sha(bytes), component.sha256);
      const file = path.join(stage, ...name.split('/'));
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, bytes, { flag: 'wx' });
    }
    // Relative argv keeps Windows mpqcli independent of the output path's encoding.
    await execute(
      mpq,
      [
        'add',
        path.basename(candidate),
        path.basename(stage),
        '--overwrite',
        '--game',
        'starcraft2',
      ],
      { cwd: directory, windowsHide: true, timeout: 180000, maxBuffer: 8 * 1024 ** 2 },
    );
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
}

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
        path.basename(building),
        path.relative(directory, file),
        '--path',
        name.replaceAll('/', '\\'),
        '--overwrite',
        '--game',
        'starcraft2',
      ],
      { cwd: directory, windowsHide: true, maxBuffer: 8 * 1024 ** 2 },
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

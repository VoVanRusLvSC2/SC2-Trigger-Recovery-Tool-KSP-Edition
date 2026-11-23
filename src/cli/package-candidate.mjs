/** Pack only requested edits into a separate archive and verify every payload. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { openSc2Package, safeComponentPath } from './sc2-package.mjs';
import { openMpqReader } from '../vendor/@modkit/blizzard-mpq/src/mpq/codec.js';
const execute = promisify(execFile);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const metadata = /^\((?:listfile|attributes|signature)\)$/i;
const mapLimits = {
  maxArchiveBytes: 512 * 1024 ** 2,
  maxEntries: 100000,
  maxEntryBytes: 512 * 1024 ** 2,
};

function payloadEntries(reader) {
  const entries = new Map();
  for (const entry of reader.entries) {
    if (metadata.test(entry.path)) continue;
    const key = safeComponentPath(entry.path).toLowerCase();
    assert(!entries.has(key), 'Duplicate MPQ payload: ' + entry.path);
    entries.set(key, entry);
  }
  return entries;
}

function equalStoredPayload(left, before, right, after) {
  if (
    !before ||
    !after ||
    before.size !== after.size ||
    before.length !== after.length ||
    before.flags !== after.flags ||
    before.sectorShift !== after.sectorShift ||
    before.key !== after.key
  )
    return false;
  return left
    .subarray(before.offset, before.offset + before.length)
    .equals(right.subarray(after.offset, after.offset + after.length));
}

/** Verify untouched MPQ payloads in their stored representation whenever its
 * bytes and decoding parameters agree. Read the decoded form for changed or
 * recompressed entries. The source archive is pinned independently. */
export async function updateMapCandidate(
  row,
  candidate,
  directory,
  components,
  { sourceBytes, onVerifiedArchive } = {},
) {
  const source = sourceBytes ?? (await fs.readFile(row.archive));
  assert.equal(sha(source), row.archiveSha256, 'Source archive changed before packaging');
  const original = await openMpqReader(source, mapLimits);
  let packed;
  try {
    assert(!original.recovered && !original.headerRepaired, 'Source MPQ needs repair');
    const before = payloadEntries(original);
    assert(before.has('mapscript.galaxy'), 'Source map is missing MapScript.galaxy');
    const planned = new Map();
    const writes = [];
    for (const component of components) {
      const name = safeComponentPath(component.path);
      const key = name.toLowerCase();
      assert(key !== 'mapscript.galaxy', 'MapScript updates require source transfer verification');
      assert(!planned.has(key), 'Duplicate package edit: ' + name);
      const bytes = await fs.readFile(path.join(directory, 'components', ...name.split('/')));
      assert.equal(sha(bytes), component.sha256, 'Staged component changed: ' + name);
      planned.set(key, component);
      const entry = before.get(key);
      if (!entry || !Buffer.from(await original.read(entry.id)).equals(bytes))
        writes.push(component);
    }

    await fs.writeFile(candidate, source, { flag: 'wx' });
    await addVerifiedMapComponents(row.mpq, candidate, directory, writes);
    const output = await fs.readFile(candidate);
    const archiveSha256 = sha(output);
    let unchangedStored = 0;
    let decodedFallbacks = 0;
    let originalAttributesPreserved = before.has('attributes') ? true : null;
    const unchangedPayloads = [...before.keys()].filter((key) => !planned.has(key)).length;
    if (!writes.length) {
      assert.equal(archiveSha256, row.archiveSha256, 'Unchanged archive copy differs');
    } else {
      packed = await openMpqReader(output, mapLimits);
      assert(!packed.recovered && !packed.headerRepaired, 'Restored archive needs repair');
      const after = payloadEntries(packed);
      const expected = new Set([...before.keys(), ...planned.keys()]);
      assert.equal(after.size, expected.size, 'Candidate component count changed');
      for (const key of expected) {
        const entry = after.get(key);
        assert(entry, 'Candidate component missing: ' + key);
        const plan = planned.get(key);
        const prior = before.get(key);
        if (plan) {
          const hash = sha(await packed.read(entry.id));
          assert.equal(hash, plan.sha256, 'Component mismatch: ' + entry.path);
          if (key === 'attributes' && prior)
            originalAttributesPreserved = hash === sha(await original.read(prior.id));
        } else if (
          equalStoredPayload(
            source,
            original.storedEntry(prior.id),
            output,
            packed.storedEntry(entry.id),
          )
        ) {
          unchangedStored++;
        } else {
          decodedFallbacks++;
          assert(
            Buffer.from(await original.read(prior.id)).equals(await packed.read(entry.id)),
            'Unrelated payload changed: ' + prior.path,
          );
        }
      }
    }
    onVerifiedArchive?.({ bytes: output, sha256: archiveSha256 });
    return {
      passed: true,
      unchangedPayloads,
      originalGalaxyPreserved: true,
      originalAttributesPreserved,
      archiveSha256,
      componentCount: planned.size,
      writtenComponents: writes.map((entry) => entry.path),
      verification: writes.length ? 'STORED_OR_DECODED_PAYLOAD_EQUALITY' : 'EXACT_ARCHIVE_COPY',
      unchangedStored,
      decodedFallbacks,
      editorAcceptance: 'pending: separate actual Editor compile/export evidence required',
    };
  } finally {
    packed?.dispose();
    original.dispose();
  }
}

export async function writeTriggerDraft(row, directory, triggerData) {
  assert.equal(path.basename(row.name), row.name, 'Draft name must be a filename');
  await fs.mkdir(directory);
  const components = path.join(directory, 'components');
  await fs.mkdir(components);
  const bytes = Buffer.from(triggerData);
  await fs.writeFile(path.join(components, 'Triggers'), bytes, { flag: 'wx' });
  const candidate = path.join(directory, 'DRAFT-' + row.name);
  const verification = await updateMapCandidate(row, candidate, directory, [
    { path: 'Triggers', sha256: sha(bytes), bytes: bytes.length },
  ]);
  return { candidate, verification };
}

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

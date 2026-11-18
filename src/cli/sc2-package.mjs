/** One read-only view of packed SC2 archives and Editor component folders. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { openMpqReader } from '../vendor/@modkit/blizzard-mpq/src/mpq/codec.js';

export function safeComponentPath(name) {
  const normalized = name.replaceAll('\\', '/');
  assert(
    normalized && !normalized.includes(':') && !/[\x00-\x1f]/u.test(normalized),
    'Unsafe component path',
  );
  assert(
    !normalized.split('/').some((part) => !part || part === '..' || part === '.'),
    'Unsafe component path',
  );
  return normalized;
}

export async function openSc2Package(input, options = {}) {
  const limits = {
    maxArchiveBytes: 1024 ** 3,
    maxEntries: 100000,
    maxEntryBytes: 256 * 1024 ** 2,
    ...options,
  };
  let root = await fs.realpath(input);
  const stat = await fs.stat(root);
  if (stat.isFile()) {
    assert(stat.size <= limits.maxArchiveBytes, 'Archive exceeds the size limit');
    const bytes = await fs.readFile(root);
    const reader = await openMpqReader(bytes, limits);
    return {
      entries: reader.entries,
      find: (name) => reader.find(name),
      read: (id) => reader.read(id),
      dispose: () => reader.dispose(),
      archiveSha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }
  assert(stat.isDirectory(), 'Choose an SC2 archive or component folder');
  // Extracted downloads may repeat the package name around the actual components.
  // Unwrap only a sole, identically named directory, never an arbitrary child.
  for (let depth = 0; depth < 8; depth++) {
    const children = await fs.readdir(root, { withFileTypes: true });
    if (
      children.length !== 1 ||
      !children[0].isDirectory() ||
      children[0].isSymbolicLink() ||
      children[0].name.toLowerCase() !== path.basename(root).toLowerCase()
    )
      break;
    root = await fs.realpath(path.join(root, children[0].name));
  }
  const entries = [];
  const names = new Map();
  let bytes = 0;
  let visited = 0;
  async function visit(directory, depth = 0) {
    assert(depth <= 128, 'Component folder nesting exceeds the limit');
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      assert(++visited <= limits.maxEntries, 'Component package exceeds the entry limit');
      assert(
        !item.isSymbolicLink(),
        'Component folders cannot contain symbolic links: ' + item.name,
      );
      const file = path.join(directory, item.name);
      if (item.isDirectory()) await visit(file, depth + 1);
      else {
        assert(item.isFile(), 'Unsupported component entry: ' + item.name);
        const name = safeComponentPath(path.relative(root, file));
        const key = name.toLowerCase();
        assert(!names.has(key), 'Ambiguous case-insensitive component: ' + name);
        const info = await fs.stat(file);
        assert(info.size <= limits.maxEntryBytes, 'Component exceeds the size limit: ' + name);
        bytes += info.size;
        assert(bytes <= limits.maxArchiveBytes, 'Component package exceeds the size limit');
        const entry = { id: entries.length, path: name };
        entries.push(entry);
        names.set(key, entry);
        assert(entries.length <= limits.maxEntries, 'Component package exceeds the entry limit');
      }
    }
  }
  await visit(root);
  return {
    componentRoot: root,
    entries,
    find(name) {
      return names.get(name.replaceAll('\\', '/').toLowerCase());
    },
    async read(id) {
      const entry = entries[id];
      assert(entry, 'Unknown component');
      const file = path.join(root, ...entry.path.split('/'));
      assert(
        (await fs.lstat(file)).isFile(),
        'Component is no longer a regular file: ' + entry.path,
      );
      const actual = await fs.realpath(file);
      const relative = path.relative(root, actual);
      assert(
        relative && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative),
        'Component escaped its source folder',
      );
      const payload = await fs.readFile(actual);
      assert(
        payload.length <= limits.maxEntryBytes,
        'Component exceeds the size limit: ' + entry.path,
      );
      return payload;
    },
    dispose() {},
  };
}

/** Recheck the user's folder, separately from the immutable packed job snapshot. */
export async function verifyComponentSource(source) {
  if (!source) return;
  const reader = await openSc2Package(source.path);
  try {
    const expected = new Map(source.entries.map((entry) => [entry.path, entry.sha256]));
    assert.equal(reader.entries.length, expected.size, 'Source component listing changed');
    for (const entry of reader.entries) {
      const digest = createHash('sha256')
        .update(await reader.read(entry.id))
        .digest('hex');
      assert.equal(digest, expected.get(entry.path), 'Source component changed: ' + entry.path);
    }
  } finally {
    reader.dispose();
  }
}

/** Container tables are regenerated; every actual component must match its source hash. */
export async function packComponentSnapshot(tool, directory, archive, entries) {
  await new Promise((resolve, reject) => {
    const child = spawn(tool, ['create', directory, '--output', archive, '--game', 'starcraft2'], {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let error = '';
    child.stderr.on('data', (chunk) => {
      error = (error + chunk).slice(-65536);
    });
    child.once('error', reject);
    child.once('close', (code) =>
      code === 0 ? resolve() : reject(Error('Cannot pack component snapshot: ' + error)),
    );
  });
  const metadata = /^\((?:listfile|attributes|signature)\)$/i;
  const expected = new Map(
    entries
      .filter((entry) => !metadata.test(entry.path))
      .map((entry) => [entry.path.toLowerCase(), entry.sha256]),
  );
  const reader = await openSc2Package(archive);
  try {
    const packed = reader.entries.filter((entry) => !metadata.test(entry.path));
    assert.equal(packed.length, expected.size, 'Component snapshot entry count differs');
    for (const entry of packed) {
      const digest = createHash('sha256')
        .update(await reader.read(entry.id))
        .digest('hex');
      assert.equal(
        digest,
        expected.get(entry.path.toLowerCase()),
        'Component snapshot differs: ' + entry.path,
      );
    }
  } finally {
    reader.dispose();
  }
}

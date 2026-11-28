/** Fetch a version-pinned public SC2 data snapshot; no game binaries are included. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { readZipByRanges } from 'modkit-extension-archives/formats/zip/codec';
import { containerEntryLayer } from '@modkit/codec-kit';
import { fileRangeSource } from '@modkit/vfs/content-sources/node';

export const REVISION = '6dd323aae4209a01f110719a00b4e8f7a88389bc';
const REPOSITORY = 'SC2Mapster/SC2GameData';
const API = `https://api.github.com/repos/${REPOSITORY}`;
const PREFIX = `SC2GameData-${REVISION}/`;
const MAX_ARCHIVE = 2 * 1024 ** 3;
const MAX_EXPANDED = 2 * 1024 ** 3;
const MAX_FILE = 128 * 1024 ** 2;
const MAX_FILES = 30000;
const gitBlob = (bytes) =>
  createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
export function resourcePath(name) {
  assert(
    typeof name === 'string' && name && !/[\\\\:<>"|?*\x00-\x1f]/u.test(name),
    'Unsafe resource path',
  );
  const parts = name.split('/');
  assert(
    parts.every(
      (p) =>
        p &&
        p !== '.' &&
        p !== '..' &&
        !/[ .]$/u.test(p) &&
        !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(p),
    ),
    'Unsafe resource path',
  );
  return parts;
}
async function get(url, fetchImpl, timeout = 120000) {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': 'SC2-Galaxy-Trigger-Recovery', Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(timeout),
  });
  assert(response.ok, `Resource download failed: HTTP ${response.status}`);
  return response;
}
export async function fetchPublicPack(output, { fetchImpl = fetch, onProgress = () => {} } = {}) {
  assert(output, 'A new output directory is required');
  const root = path.resolve(output);
  await mkdir(root); // refuse any existing directory
  const commit = await (await get(`${API}/git/commits/${REVISION}`, fetchImpl)).json();
  const treeId = commit?.tree?.sha;
  assert(commit.sha === REVISION && /^[0-9a-f]{40}$/u.test(treeId), 'Invalid pinned commit');
  const tree = await (await get(`${API}/git/trees/${treeId}?recursive=1`, fetchImpl)).json();
  assert(
    tree.sha === treeId && !tree.truncated && Array.isArray(tree.tree),
    'Incomplete resource tree',
  );
  const expected = new Map(),
    casefold = new Set();
  let expanded = 0;
  for (const entry of tree.tree) {
    if (entry.type !== 'blob') continue;
    resourcePath(entry.path);
    assert(
      ['100644', '100755'].includes(entry.mode) &&
        /^[0-9a-f]{40}$/u.test(entry.sha) &&
        Number.isSafeInteger(entry.size) &&
        entry.size >= 0 &&
        entry.size <= MAX_FILE,
      `Invalid resource entry: ${entry.path}`,
    );
    assert(!casefold.has(entry.path.toLowerCase()), `Ambiguous resource path: ${entry.path}`);
    casefold.add(entry.path.toLowerCase());
    expected.set(entry.path, entry);
    expanded += entry.size;
  }
  assert(
    expected.size > 0 && expected.size <= MAX_FILES && expanded <= MAX_EXPANDED,
    'Resource tree exceeds limits',
  );
  onProgress({ stage: 'download', files: expected.size, expandedBytes: expanded });
  const archive = path.join(root, 'download.partial.zip');
  const response = await get(
    `https://codeload.github.com/${REPOSITORY}/zip/${REVISION}`,
    fetchImpl,
    1800000,
  );
  assert(response.body, 'Missing archive body');
  let received = 0;
  const limit = new Transform({
    transform(chunk, _enc, done) {
      received += chunk.length;
      done(received > MAX_ARCHIVE ? new Error('Archive exceeds size limit') : null, chunk);
    },
  });
  await pipeline(
    Readable.fromWeb(response.body),
    limit,
    createWriteStream(archive, { flags: 'wx' }),
  );
  const source = fileRangeSource(archive);
  try {
    const { containerEntries } = await readZipByRanges(source, {
      maxInputBytes: MAX_FILE,
      maxNodes: MAX_FILES * 2,
    });
    const layer = containerEntryLayer('public-snapshot', containerEntries, source);
    const seen = new Set();
    for (const file of layer.entries) {
      assert(file.path.startsWith(PREFIX), 'Archive root does not match pinned revision');
      const name = file.path.slice(PREFIX.length);
      const parts = resourcePath(name),
        entry = expected.get(name);
      assert(
        entry && !seen.has(name) && Number(file.size) === entry.size,
        `Unexpected resource: ${name}`,
      );
      const bytes = Buffer.from(await layer.read(file.path, MAX_FILE));
      assert(
        bytes.length === entry.size && gitBlob(bytes) === entry.sha,
        `Resource integrity mismatch: ${name}`,
      );
      const target = path.join(root, ...parts);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes, { flag: 'wx' });
      seen.add(name);
      if (seen.size % 1000 === 0)
        onProgress({ stage: 'verify', files: seen.size, total: expected.size });
    }
    assert(seen.size === expected.size, 'Public archive missing expected resources');
    const manifest = {
      schema: 1,
      repository: `https://github.com/${REPOSITORY}`,
      revision: REVISION,
      gitTree: treeId,
      files: expected.size,
      expandedBytes: expanded,
      resourceType: 'public-snapshot-not-installed-game',
      verifiedGitBlobs: true,
      versionKnown: false,
      editorVerified: false,
      limitations: [
        'Archived data may not match the map or Editor.',
        'Custom dependencies are not included.',
        'No game or Editor is included.',
      ],
    };
    await writeFile(
      path.join(root, 'RESOURCE_MANIFEST.json'),
      JSON.stringify(manifest, null, 2) + '\n',
      { flag: 'wx' },
    );
    await source.close();
    await unlink(archive); // this invocation created this file in an exclusive new directory
    return manifest;
  } finally {
    await source.close().catch(() => {});
  }
}

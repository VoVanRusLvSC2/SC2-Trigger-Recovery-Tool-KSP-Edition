import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, rmdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fetchPublicPack, resourcePath, REVISION } from '../src/resources/fetch-public-pack.mjs';
const parent = process.env.SC2_TEST_OUTPUT_ROOT || os.tmpdir();
for (const bad of ['../x', 'a/../b', 'a\\b', 'a:evil', 'CON.txt', 'a/<x>'])
  assert.throws(() => resourcePath(bad));
const bytes = Buffer.from('hello test\n'),
  blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const zip = Buffer.from(
  'UEsDBBQAAAAIANaxbl0ANYQMDQAAAAsAAABRAAAAU0MyR2FtZURhdGEtNmRkMzIzYWFlNDIwOWEwMWYxMTA3MTlhMDBiNGU4ZjdhODgzODliYy9tb2RzL2NvcmUuc2MybW9kL3Rlc3QuZ2FsYXh5y0jNyclXKEktLuECAFBLAQIUABQAAAAIANaxbl0ANYQMDQAAAAsAAABRAAAAAAAAAAAAAACAAQAAAABTQzJHYW1lRGF0YS02ZGQzMjNhYWU0MjA5YTAxZjExMDcxOWEwMGI0ZThmN2E4ODM4OWJjL21vZHMvY29yZS5zYzJtb2QvdGVzdC5nYWxheHlQSwUGAAAAAAEAAQB/AAAAfAAAAAAA',
  'base64',
);
const treeId = '1234567890123456789012345678901234567890';
const mock = async (url) =>
  url.includes('/git/commits/')
    ? Response.json({ sha: REVISION, tree: { sha: treeId } })
    : url.includes('/git/trees/')
      ? Response.json({
          sha: treeId,
          truncated: false,
          tree: [
            {
              type: 'blob',
              mode: '100644',
              path: 'mods/core.sc2mod/test.galaxy',
              size: bytes.length,
              sha: blob,
            },
          ],
        })
      : new Response(zip);
const t = await mkdtemp(path.join(parent, 'pack-check-')),
  out = path.join(t, 'out');
try {
  const m = await fetchPublicPack(out, { fetchImpl: mock });
  assert.equal(m.files, 1);
  assert.equal(m.editorVerified, false);
  assert.equal(m.versionKnown, false);
  assert.deepEqual(await readFile(path.join(out, 'mods/core.sc2mod/test.galaxy')), bytes);
  assert(!(await readdir(out)).includes('download.partial.zip'));
  await assert.rejects(fetchPublicPack(out, { fetchImpl: mock }), /EEXIST/u);
  await unlink(path.join(out, 'mods/core.sc2mod/test.galaxy'));
  await rmdir(path.join(out, 'mods/core.sc2mod'));
  await rmdir(path.join(out, 'mods'));
  await unlink(path.join(out, 'RESOURCE_MANIFEST.json'));
  await rmdir(out);
  console.log(
    'Full snapshot downloader: pinned tree, verified ZIP, safety and no-overwrite passed.',
  );
} finally {
  await rm(t, { recursive: true, force: true });
}

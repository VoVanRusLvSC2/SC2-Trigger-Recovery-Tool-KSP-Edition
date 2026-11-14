import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rmdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fetchPublicCore } from '../src/resources/fetch-public-core.mjs';
const source = process.env.SC2_TRIGGER_NATIVE_ROOT;
const parent = process.env.SC2_TEST_OUTPUT_ROOT;
assert(source && parent, 'Set SC2_TRIGGER_NATIVE_ROOT and SC2_TEST_OUTPUT_ROOT');
const temp = await mkdtemp(path.join(parent, 'public-core-check-'));
const mock = async (url) =>
  new Response(await readFile(path.join(source, new URL(url).pathname.split('/').at(-1))));
try {
  const success = path.join(temp, 'success');
  const result = await fetchPublicCore(success, { fetchImpl: mock });
  assert.equal(result.status, 'PUBLIC_CORE_ONLY_NOT_MAP_READY');
  assert.equal(result.files.length, 4);
  await assert.rejects(fetchPublicCore(success, { fetchImpl: mock }), /EEXIST/u);
  const bad = path.join(temp, 'bad');
  await assert.rejects(
    fetchPublicCore(bad, { fetchImpl: async () => new Response('corrupt') }),
    /Integrity mismatch/u,
  );
  assert.deepEqual(await readdir(bad), []);
  for (const file of await readdir(success)) await unlink(path.join(success, file));
  await rmdir(success);
  await rmdir(bad);
  console.log('Public core: offline fixture, integrity rejection and no-overwrite checks passed.');
} finally {
  if ((await readdir(temp)).length === 0) await rmdir(temp);
}

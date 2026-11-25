import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { localResourcePath } from '../model/local-resource-path.mjs';
import { loadConversionOracle } from './oracle/conversion-oracle.mjs';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
// Release identity of the user's unchanged benchmark, not a map-specific rule.
const manifestSha256 = '94d0ee8f5a7ff489e1d161134a6a93f73c68669d00ce7f4bca2bc66f24649166';
export async function openPinnedUserOracle({ root = process.env.SC2_TRIGGER_BENCHMARK_ROOT } = {}) {
  if (root === undefined)
    throw new Error('Pinned benchmark root required: pass root or set SC2_TRIGGER_BENCHMARK_ROOT');
  const location = pathToFileURL(localResourcePath(root) + '/');
  const bytes = await readFile(new URL('benchmark/MANIFEST.json', location));
  assert.equal(sha(bytes), manifestSha256);
  const manifest = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u, ''));
  const verify = async () => {
    assert.equal(sha(await readFile(new URL('benchmark/MANIFEST.json', location))), manifestSha256);
    for (let start = 0; start < manifest.files.length; start += 16) {
      const entries = manifest.files.slice(start, start + 16);
      const files = await Promise.all(
        entries.map((entry) => readFile(new URL('benchmark/' + entry.path, location))),
      );
      for (const [index, entry] of entries.entries())
        assert.equal(sha(files[index]), entry.sha256, entry.path);
    }
  };
  await verify();
  const oracle = await loadConversionOracle(
    './benchmark/build/.benchmark-build/modkit-sc2-triggers/modules/triggers/services/galaxy-conversion/index.js',
    fileURLToPath(location),
  );
  return {
    compare: (a, b) => oracle.compareGalaxy(a, b, { libraryId: 'Map' }),
    verify,
    manifestSha256,
    assets: manifest.files.length,
  };
}

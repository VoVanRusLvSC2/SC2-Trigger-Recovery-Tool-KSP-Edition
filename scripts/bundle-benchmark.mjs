/** Bundle only the unchanged hash-verified oracle assets, never map corpora. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { openPinnedUserOracle } from '../src/verification/pinned-user-oracle.mjs';

const root = path.resolve(import.meta.dirname, '..');
const destination = path.join(root, '.runtime', 'pinned-benchmark');
const source = process.argv[2] ?? process.env.SC2_TRIGGER_BENCHMARK_ROOT ?? destination;
await openPinnedUserOracle({ root: source });
try {
  await fs.access(destination);
  await openPinnedUserOracle({ root: destination });
  console.log('Bundled benchmark already verified.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await fs.mkdir(destination); // Do not overwrite an incomplete or different bundle.
  const bytes = await fs.readFile(path.join(source, 'benchmark', 'MANIFEST.json'));
  const manifest = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u, ''));
  for (const name of ['MANIFEST.json', ...manifest.files.map((entry) => entry.path)]) {
    const relative = path.normalize(name);
    if (path.isAbsolute(relative) || relative.split(path.sep).includes('..'))
      throw Error('Invalid benchmark asset path.');
    const target = path.join(destination, 'benchmark', relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(source, 'benchmark', relative), target, fs.constants.COPYFILE_EXCL);
  }
  await openPinnedUserOracle({ root: destination });
  console.log(`Bundled and verified ${manifest.files.length} unchanged benchmark assets.`);
}

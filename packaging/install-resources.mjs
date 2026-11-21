// Install a complete snapshot atomically. A failed download can be retried.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchPublicPack } from '../src/resources/fetch-public-pack.mjs';
import { bundledSnapshot } from '../src/resources/installed-snapshot.mjs';

const root = path.resolve(import.meta.dirname, '..');
const runtime = path.join(root, '.runtime');
if (!(await bundledSnapshot(root))) {
  const temp = await fs.mkdtemp(path.join(runtime, 'snapshot-install-'));
  try {
    const payload = path.join(temp, 'payload');
    await fetchPublicPack(payload);
    await fs.rename(payload, path.join(runtime, 'public-resources'));
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
}

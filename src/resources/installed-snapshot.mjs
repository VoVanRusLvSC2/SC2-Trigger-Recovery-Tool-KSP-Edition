import fs from 'node:fs/promises';
import path from 'node:path';
import { REVISION } from './fetch-public-pack.mjs';

export async function bundledSnapshot(root) {
  const folder = path.join(root, '.runtime', 'public-resources');
  let bytes;
  try {
    bytes = await fs.readFile(path.join(folder, 'RESOURCE_MANIFEST.json'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
  const manifest = JSON.parse(bytes);
  if (
    manifest.revision !== REVISION ||
    !manifest.verifiedGitBlobs ||
    manifest.resourceType !== 'public-snapshot-not-installed-game'
  )
    throw Error('Invalid Standalone resource manifest. Reinstall the Standalone edition.');
  return folder;
}

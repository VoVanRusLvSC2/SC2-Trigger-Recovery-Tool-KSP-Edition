/** Verify the installed immutable payload; maps and reports live outside it. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(
  await fs.readFile(path.join(root, 'distribution-manifest.json'), 'utf8'),
);
for (const entry of manifest.files) {
  if (
    !entry.path ||
    entry.path.includes('\\') ||
    entry.path.split('/').some((p) => !p || p === '..' || p === '.') ||
    entry.path.includes(':')
  )
    throw Error('Unsafe manifest path');
  const bytes = await fs.readFile(path.join(root, ...entry.path.split('/')));
  if (
    bytes.length !== entry.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== entry.sha256
  )
    throw Error('Installed file differs: ' + entry.path);
}
console.log(`Verified ${manifest.files.length} installed files for ${manifest.version}.`);

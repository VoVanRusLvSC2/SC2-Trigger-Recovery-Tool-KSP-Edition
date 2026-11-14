/** Check the exact published bytes of the recovered source snapshot. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('./recovered-sources.json', import.meta.url)));
for (const entry of manifest.files) {
  const target = new URL(entry.file, root);
  assert(target.href.startsWith(root.href), 'Recovered source path leaves the project');
  const bytes = await readFile(target);
  const digest = createHash('sha256').update(bytes).digest('hex');
  assert.equal(digest, entry.publishedSha256, `Recovered source changed: ${entry.file}`);
}
console.log(
  `Verified ${manifest.files.length} recovered source files against the publication manifest.`,
);
console.log('This is source integrity evidence, not a converter or map-equivalence pass.');

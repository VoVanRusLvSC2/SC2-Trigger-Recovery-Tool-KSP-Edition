/** Check recovered retained-source bytes without loading converter modules. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('./retained-sources.json', import.meta.url)));
for (const entry of manifest.files) {
  const target = new URL(entry.file, root);
  assert(target.href.startsWith(root.href), 'Retained source path leaves the project');
  const digest = createHash('sha256')
    .update(await readFile(target))
    .digest('hex');
  assert.equal(digest, entry.publishedSha256, `Retained source changed: ${entry.file}`);
}
console.log(`Verified ${manifest.files.length} modules against retained-source provenance.`);
console.log(
  'These are retained-source copies, not newly discovered historical destination pins or map passes.',
);

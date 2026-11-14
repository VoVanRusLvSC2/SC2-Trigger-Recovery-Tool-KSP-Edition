/** Execute the retained package interfaces; no source map or Editor is used. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { encodeFreshMpq } from '../src/vendor/@modkit/blizzard-mpq/src/mpq/fresh-writer.js';
import { openMpqReader } from '../src/vendor/@modkit/blizzard-mpq/src/mpq/codec.js';

const imports = JSON.parse(
  await readFile(new URL('./local-runtime-imports.json', import.meta.url)),
);
for (const specifier of imports) await import(specifier);
const { STARCRAFT2_CATALOG_FILES } = await import(
  '../src/sdk/core/modules/data/services/schema/full-data-schema.js'
);
assert(STARCRAFT2_CATALOG_FILES.length > 0, 'Generated schema has no catalog files');
const { gameDataIncludePaths } = await import(
  '../src/sdk/core/modules/data/shared/catalog-engine/gamedata-order.js'
);
assert.deepEqual(
  gameDataIncludePaths('<Includes><Catalog path="GameData/UnitData.xml"/></Includes>'),
  ['GameData/UnitData.xml'],
);

const original = Buffer.from('runtime-boundary-probe\n', 'utf8');
const archive = encodeFreshMpq([{ path: 'Probe.txt', bytes: original }]);
const reader = await openMpqReader(archive, {
  maxArchiveBytes: 1024 ** 2,
  maxEntries: 16,
  maxEntryBytes: 1024,
});
try {
  const entry = reader.find('Probe.txt');
  assert(entry, 'The retained reader did not find the newly encoded entry');
  assert.deepEqual(Buffer.from(await reader.read(entry.id)), original);
} finally {
  reader.dispose();
}
console.log(
  `Loaded ${imports.length} package entry points; verified schema loading, catalog includes and an in-memory MPQ roundtrip.`,
);
console.log(
  'This verifies dependency preparation, not converter output, Editor acceptance or map equivalence.',
);

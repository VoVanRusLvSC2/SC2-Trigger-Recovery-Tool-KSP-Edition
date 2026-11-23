/** Execute the retained package interfaces; no source map or Editor is used. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { BlizzardLibraryCache } from '../src/cli/blizzard-library-cache.mjs';
import { blizzardPackageIndex } from '../src/cli/blizzard-package-index.mjs';
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

const reads = new Map();
let lists = 0;
let closes = 0;
const root = { storageOf: 'installed-sc2', revision: 'build-one' };
const stock = {
  root,
  list: async () => {
    lists++;
    return [{ name: 'TriggerLibs', directory: true }];
  },
  read: async (file, maximum) => {
    if (maximum < 1) throw Error('read limit');
    const count = (reads.get(file) ?? 0) + 1;
    reads.set(file, count);
    return Uint8Array.of(count);
  },
  dispose: async () => {
    closes++;
  },
};
const mount = (source = stock) => ({
  locals: new Map([
    ['local:casc', source],
    ['local:mods:0', { read: async () => Uint8Array.of(99) }],
  ]),
});
const cache = new BlizzardLibraryCache();
const prepareSource = mount();
const custom = prepareSource.locals.get('local:mods:0');
cache.attach(prepareSource);
const prepare = prepareSource.locals.get('local:casc');
assert.equal(prepareSource.locals.get('local:mods:0'), custom);
const libraryPaths = [
  'Mods/Core.SC2Mod/Base.SC2Data/TriggerLibs/NativeLib.TriggerLib',
  'Campaigns/Liberty.SC2Campaign/Base.SC2Data/LibCamp_h.galaxy',
  'Mods/AlliedCommanders.SC2Mod/enUS.SC2Data/LocalizedData/TriggerStrings.txt',
];
for (const file of libraryPaths) {
  const first = await prepare.read(file, 1);
  first[0] = 77;
  assert.deepEqual(await prepare.read(file, 1), Uint8Array.of(1));
  await assert.rejects(prepare.read(file, 0), /read limit/);
}
const texture = 'Mods/Core.SC2Mod/Base.SC2Assets/Assets/Textures/sample.dds';
assert.deepEqual(await prepare.read(texture, 1), Uint8Array.of(1));
assert.deepEqual(await prepare.read(texture, 1), Uint8Array.of(2));
const layerPath = 'Mods/Core.SC2Mod/Base.SC2Data';
const firstList = await prepare.list(layerPath);
firstList[0].name = 'modified';
await prepare.dispose();
assert.equal(closes, 0);
cache.beginVerification();
const convertSource = mount({
  ...stock,
  read: async () => assert.fail('Second phase must use the already opened CASC source'),
});
cache.attach(convertSource);
const convert = convertSource.locals.get('local:casc');
assert.equal((await convert.list(layerPath))[0].name, 'TriggerLibs');
assert.equal(lists, 1);
for (const file of libraryPaths) {
  assert.deepEqual(await convert.read(file, 1), Uint8Array.of(2));
  assert.deepEqual(await convert.read(file, 1), Uint8Array.of(2));
}
const dependency = {
  sourcePath: 'Base.SC2Data/TriggerLibs/NativeLib.TriggerLib',
  triggerData: '<TriggerData><Library Id="Ntve"><Root/></Library></TriggerData>',
};
const digest = createHash('sha256').update(dependency.triggerData).digest('hex');
cache.mountedOwners(dependency).remember(['Ntve']);
assert.equal(cache.mountedOwners(dependency).owners, undefined);
cache.confirmMountedOwners([{ path: 'somewhere-else/NativeLib.TriggerLib', sha256: digest }]);
assert.equal(cache.mountedOwners(dependency).owners, undefined);
cache.mountedOwners(dependency).remember(['Ntve']);
cache.confirmMountedOwners([{ path: dependency.sourcePath, sha256: digest }]);
cache.beginPreparation();
assert.deepEqual(cache.mountedOwners(dependency).owners, ['Ntve']);
assert.equal(
  cache.mountedOwners({ ...dependency, triggerStrings: 'other locale' }).owners,
  undefined,
);
assert.equal(
  cache.mountedOwners({ ...dependency, triggerData: dependency.triggerData + '\n' }).owners,
  undefined,
);

let classifications = 0;
const classifyPrepared = () => {
  classifications++;
  return false;
};
assert.equal(cache.classifyPreparedDocument(dependency, classifyPrepared), false);
assert.equal(cache.classifyPreparedDocument(dependency, classifyPrepared), false);
assert.equal(classifications, 2);
assert.throws(
  () =>
    cache.classifyInstalledDocument(digest, () => {
      throw Error('invalid XML');
    }),
  /invalid XML/,
);
assert.equal(
  cache.classifyInstalledDocument(digest, () => false),
  false,
);
assert.equal(
  cache.classifyInstalledDocument(digest, () => assert.fail('Repeated installed parse')),
  false,
);
assert.equal(cache.classifyPreparedDocument(dependency, classifyPrepared), false);
assert.equal(
  cache.classifyPreparedDocument(dependency, () => assert.fail('Repeated preparation parse')),
  false,
);
assert.equal(classifications, 3);
assert.equal(
  cache.classifyPreparedDocument(
    { ...dependency, triggerData: dependency.triggerData + '\n' },
    classifyPrepared,
  ),
  false,
);
assert.equal(classifications, 4);

const metadata = [{ fileName: dependency.sourcePath, sha256: digest }];
const authority = {
  buildIdentity: { buildInfoSha256: 'build-one' },
  files: [{ path: dependency.sourcePath, sha256: digest }],
};
const initializers = { nativeId: 'Ntve' };
assert.equal(
  cache.compilerInitializers(metadata, authority, () => initializers),
  initializers,
);
assert.equal(
  cache.compilerInitializers(metadata, authority, () =>
    assert.fail('Repeated initializer analysis'),
  ),
  initializers,
);
const localMetadata = [{ ...metadata[0], fileName: 'Triggers' }];
for (let run = 1; run <= 2; run++)
  assert.equal(
    cache.compilerInitializers(localMetadata, authority, () => run),
    run,
  );
assert.equal(
  cache.compilerInitializers(
    metadata,
    { ...authority, buildIdentity: { buildInfoSha256: 'build-two' } },
    () => 'updated',
  ),
  'updated',
);

const preloaded = new BlizzardLibraryCache({ expectedBuild: 'build-one' });
preloaded.preloadCompilerInitializers(metadata, () => initializers);
assert.equal(
  preloaded.compilerInitializers(
    metadata,
    { ...authority, files: [] },
    () => 'missing live authority',
  ),
  'missing live authority',
);
assert.equal(
  preloaded.compilerInitializers(metadata, authority, () => assert.fail('Repeated preload')),
  initializers,
);
const changedMetadata = [{ ...metadata[0], sha256: 'new-digest' }];
assert.equal(
  preloaded.compilerInitializers(
    changedMetadata,
    { ...authority, files: [{ path: dependency.sourcePath, sha256: 'new-digest' }] },
    () => 'changed',
  ),
  'changed',
);
await preloaded.dispose();

assert.throws(
  () => cache.attach(mount({ ...stock, root: { ...root, revision: 'build-two' } })),
  /Blizzard libraries changed/,
);
await cache.dispose();
assert.equal(closes, 1);

const paths = [
  'campaigns/liberty.sc2campaign/base.sc2data/triggerlibs/one.triggerlib',
  'mods/alliedcommanders.sc2mod/base.sc2data/triggerlibs/coop.triggerlib',
  'mods/core.sc2mod/base.sc2assets/assets/probe.dds',
  'mods/core.sc2mod/base.sc2data/triggerlibs/alpha.triggerlib',
  'mods/core.sc2mod/base.sc2data/triggerlibs/beta.sc2lib',
  'mods/core.sc2mod/base.sc2data/triggerlibsextra/not-in-prefix.sc2lib',
  'mods/core.sc2mod/enus.sc2assets/assets/probe.dds',
  'mods/core.sc2mod/frfr.sc2assets/assets/probe.dds',
  'mods/core.sc2mod/locale/café.txt',
  'mods/core.sc2modextra/base.sc2data/triggerlibs/other.triggerlib',
];
let packageLists = 0;
const indexedStock = {
  async open() {
    return {
      entryIndex: {
        size: paths.length,
        lowerBound(key) {
          const row = paths.findIndex(
            (file) => Buffer.compare(Buffer.from(file), Buffer.from(key)) >= 0,
          );
          return row === -1 ? paths.length : row;
        },
        keyAt: (row) => paths[row],
      },
    };
  },
  async list(name) {
    assert.equal(name, 'Mods/Core.SC2Mod');
    packageLists++;
    return [
      { name: 'frfr.sc2assets', directory: true },
      { name: 'enus.sc2assets', directory: true },
      { name: 'base.sc2assets', directory: true },
      { name: 'triggers', directory: false },
    ];
  },
};
const index = blizzardPackageIndex(indexedStock, 'Mods/Core.SC2Mod', async (name, limit) => {
  assert.equal(name, 'Mods/Core.SC2Mod/enus.sc2assets/assets/probe.dds');
  assert.equal(limit, 64 * 1024 ** 2);
  return Uint8Array.of(42);
});
assert.deepEqual(await index.list('base.sc2data/triggerlibs/'), [
  'base.sc2data/triggerlibs/alpha.triggerlib',
  'base.sc2data/triggerlibs/beta.sc2lib',
]);
assert.deepEqual(await index.list('missing/'), []);
assert.equal(await index.list('locale/'), undefined);
assert.equal(await index.list('locale/café'), undefined);
assert.equal(await index.find(['assets/probe.dds', 'assets/probe.dds.extra']), undefined);
assert.equal(packageLists, 0);
const preferred = await index.find([
  'assets/probe.dds',
  'enus.sc2assets/assets/probe.dds',
  'base.sc2assets/assets/probe.dds',
]);
assert.equal(preferred, 'enus.sc2assets/assets/probe.dds');
assert.deepEqual(await index.read(preferred), Uint8Array.of(42));
assert.deepEqual(await index.localeComponents(), ['enus.sc2assets', 'frfr.sc2assets']);
await index.localeComponents();
assert.equal(packageLists, 1);
for (const [name, file] of [
  ['Campaigns/Liberty.SC2Campaign', 'one.triggerlib'],
  ['Mods/AlliedCommanders.SC2Mod', 'coop.triggerlib'],
]) {
  const prefix = 'base.sc2data/triggerlibs/';
  assert.deepEqual(await blizzardPackageIndex(indexedStock, name).list(prefix), [prefix + file]);
}
console.log(
  `Loaded ${imports.length} package entry points; verified schema loading, catalog includes, the Blizzard cache and CASC package lookup, and an in-memory MPQ roundtrip.`,
);
console.log(
  'This verifies dependency preparation, not converter output, Editor acceptance or map equivalence.',
);

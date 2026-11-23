/** Reject archive-path traversal and unsafe output reuse before opening SC2. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { safeComponentPath, prepareMap } from '../src/cli/prepare-map.mjs';
import {
  openSc2Package,
  verifyComponentSource,
  packComponentSnapshot,
} from '../src/cli/sc2-package.mjs';
import { createHash } from 'node:crypto';
import { updateMapCandidate, writeTriggerDraft } from '../src/cli/package-candidate.mjs';
import { findPublishedBindings, verifyPublishedFiles } from '../src/cli/published-dependencies.mjs';
import { omitMissingIncludes } from '../src/cli/recover-incomplete-dependencies.mjs';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
assert.equal(
  safeComponentPath('enUS.SC2Data\\LocalizedData\\GameStrings.txt'),
  'enUS.SC2Data/LocalizedData/GameStrings.txt',
);
for (const name of ['../out', '/absolute', 'C:\\out', 'a//b', 'a/./b', 'a/../b', 'a\0b'])
  assert.throws(() => safeComponentPath(name));
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'trigger-preparation-'));
const original = path.join(temporary, 'original.SC2Map');
await fs.writeFile(original, 'not an archive');
const library = path.join(temporary, 'OfflineCopy.SC2Mod');
await fs.mkdir(path.join(library, 'Base.SC2Data'), { recursive: true });
const libraryScript = path.join(library, 'Base.SC2Data', 'LibA1B2C3D4.galaxy');
await fs.writeFile(libraryScript, 'void libA1B2C3D4_InitLib() {}');
const reference = 'bnet:Published Test Mod/1.0/123456';
const dependencyXml = `<DocInfo><Dependencies><Value>${reference}</Value></Dependencies></DocInfo>`;
const includeScript = 'include "TriggerLibs/NativeLib"\r\ninclude "LibA1B2C3D4"\r\nvoid F() {}';
const inputs = {
  xml: dependencyXml,
  script: includeScript,
  original,
  libraryRoots: [],
  installation: temporary,
};
assert.deepEqual(await findPublishedBindings(inputs), []);
const [binding] = await findPublishedBindings({ ...inputs, libraryInputs: [library] });
assert.equal(binding.reference, reference);
assert.equal(binding.match, 'EXPLICIT_LOCAL_PACKAGE');
assert.deepEqual(binding.libraryIds, ['a1b2c3d4']);
const [automaticallyNamed] = await findPublishedBindings({
  ...inputs,
  xml: dependencyXml.replace('Published Test Mod', 'OfflineCopy'),
});
assert.equal(automaticallyNamed.match, 'LOCAL_PACKAGE_NAME');
await verifyPublishedFiles([binding]);
await fs.appendFile(libraryScript, '\nvoid Changed() {}');
await assert.rejects(verifyPublishedFiles([binding]), /Local dependency changed/);
const analysisScript = omitMissingIncludes(includeScript, 'MapScript.galaxy', {
  includes: [{ from: 'MapScript.galaxy', include: 'LibA1B2C3D4' }],
});
assert.equal(analysisScript.length, includeScript.length);
assert.match(analysisScript, /^include "TriggerLibs\/NativeLib"\r\n +\r\nvoid F\(\) \{\}$/u);
await assert.rejects(
  prepareMap({ original, installation: temporary, output: temporary, mpq: original }),
  /contain original|protected/,
);
const existing = path.join(temporary, 'existing');
const absentIndexOutput = path.join(temporary, 'no-attribute-index-output');
await assert.rejects(
  prepareMap({
    original,
    installation: temporary,
    output: absentIndexOutput,
    mpq: original,
    attributeIndex: path.join(temporary, 'missing-index.json'),
  }),
  /ENOENT/,
);
await assert.rejects(fs.access(absentIndexOutput), /ENOENT/);
await fs.mkdir(existing);
await assert.rejects(
  prepareMap({ original, installation: os.tmpdir(), output: existing, mpq: original }),
  /protected|EEXIST/,
);
assert.equal(await fs.readFile(original, 'utf8'), 'not an archive');
const folder = path.join(temporary, 'Components.SC2Map');
await fs.mkdir(path.join(folder, 'Base.SC2Data'), { recursive: true });
const component = path.join(folder, 'Base.SC2Data', 'library.galaxy');
const source = Buffer.from('void Test() {}\r\n');
await fs.writeFile(component, source);
const reader = await openSc2Package(folder);
const entry = reader.find('BASE.SC2DATA\\LIBRARY.GALAXY');
assert(entry);
assert.deepEqual(Buffer.from(await reader.read(entry.id)), source);
reader.dispose();
const observation = {
  path: folder,
  entries: [{ path: entry.path, sha256: createHash('sha256').update(source).digest('hex') }],
};
await verifyComponentSource(observation);
if (process.platform === 'win32') {
  const internal = Buffer.from('old container listing');
  await fs.writeFile(path.join(folder, '(listfile)'), internal);
  observation.entries.push({
    path: '(listfile)',
    sha256: createHash('sha256').update(internal).digest('hex'),
  });
  const archive = path.join(temporary, 'snapshot.SC2Map');
  await packComponentSnapshot(
    path.resolve(import.meta.dirname, '../.runtime/tools/mpqcli.exe'),
    folder,
    archive,
    observation.entries,
  );
  const packed = await openSc2Package(archive);
  assert.deepEqual(Buffer.from(await packed.read(packed.find(entry.path).id)), source);
  packed.dispose();
  await verifyComponentSource(observation);

  const map = path.join(temporary, 'map.SC2Map');
  const mpq = path.resolve(import.meta.dirname, '../.runtime/tools/mpqcli.exe');
  const sourceComponents = path.join(temporary, 'map-components');
  await fs.mkdir(sourceComponents);
  const originalTrigger = Buffer.from('<TriggerData><Root/></TriggerData>');
  const assets = [
    ['MapScript.galaxy', Buffer.from('void InitMap() {}')],
    ['Triggers', originalTrigger],
    ['texture.dds', Buffer.from('untouched texture bytes'.repeat(256))],
  ];
  for (const [name, bytes] of assets) await fs.writeFile(path.join(sourceComponents, name), bytes);
  await packComponentSnapshot(
    mpq,
    sourceComponents,
    map,
    assets.map(([name, bytes]) => ({ path: name, sha256: sha(bytes) })),
  );
  const originalMap = await fs.readFile(map);
  const row = { archive: map, archiveSha256: sha(originalMap), mpq };
  for (const edit of [false, true]) {
    const directory = path.join(temporary, edit ? 'edited' : 'identical');
    await fs.mkdir(path.join(directory, 'components'), { recursive: true });
    const triggers = edit
      ? Buffer.from('<TriggerData><!-- change --><Root/></TriggerData>')
      : originalTrigger;
    await fs.writeFile(path.join(directory, 'components/Triggers'), triggers);
    const target = path.join(directory, 'result.SC2Map');
    let packed;
    const proof = await updateMapCandidate(
      edit ? row : { ...row, mpq: path.join(temporary, 'unused.exe') },
      target,
      directory,
      [{ path: 'Triggers', sha256: sha(triggers), bytes: triggers.length }],
      {
        sourceBytes: originalMap,
        onVerifiedArchive: (archive) => {
          packed = archive;
        },
      },
    );
    assert.equal(packed.sha256, proof.archiveSha256);
    assert.deepEqual(packed.bytes, await fs.readFile(target));
    assert.equal(
      proof.verification,
      edit ? 'STORED_OR_DECODED_PAYLOAD_EQUALITY' : 'EXACT_ARCHIVE_COPY',
    );
    assert.deepEqual(proof.writtenComponents, edit ? ['Triggers'] : []);
    assert.equal(proof.unchangedPayloads, 2);
    if (!edit) assert.deepEqual(await fs.readFile(target), originalMap);
    else {
      assert.equal(proof.unchangedStored, 2);
      assert.equal(proof.decodedFallbacks, 0);
      const verified = await openSc2Package(target);
      try {
        assert.deepEqual(Buffer.from(await verified.read(verified.find('Triggers').id)), triggers);
        assert.deepEqual(
          Buffer.from(await verified.read(verified.find('texture.dds').id)),
          assets[2][1],
        );
      } finally {
        verified.dispose();
      }
    }
  }
  const draftXml = '<TriggerData><!-- draft --><Root/></TriggerData>';
  const draft = await writeTriggerDraft(
    { ...row, name: 'map.SC2Map' },
    path.join(temporary, 'draft'),
    draftXml,
  );
  assert.deepEqual(draft.verification.writtenComponents, ['Triggers']);
  const draftReader = await openSc2Package(draft.candidate);
  try {
    assert.equal(
      Buffer.from(await draftReader.read(draftReader.find('Triggers').id)).toString('utf8'),
      draftXml,
    );
  } finally {
    draftReader.dispose();
  }
  assert.deepEqual(await fs.readFile(map), originalMap);
}
await fs.writeFile(component, 'changed');
await assert.rejects(verifyComponentSource(observation), /Source component changed/);
await assert.rejects(openSc2Package(folder, { maxEntryBytes: 2 }), /size limit/);
console.log(
  'Preparation guards passed: traversal, protected inputs, output reuse and original bytes.',
);

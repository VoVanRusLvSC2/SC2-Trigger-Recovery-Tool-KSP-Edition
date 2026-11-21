/** Exercise the actual desktop bridge: authorization, literal argv, failure
 * reporting, immutable inputs and explicit shutdown. No game/Editor required. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { selectAdapter } from '../gui/dist/adapters.js';
import { findInstallation } from '../gui/dist/defaults.js';
import { createPreferenceStore, preferenceDefaults } from '../gui/dist/preferences.js';
import {
  normalizeLibraryRoots,
  assertPreparedLibraryRoots,
} from '../src/libraries/local-roots.mjs';
import { BoundedLocalModSources } from '../src/libraries/extensions/bounded-local-mod-sources.mjs';
import { encodeFreshMpq } from '../src/vendor/@modkit/blizzard-mpq/src/mpq/fresh-writer.js';

const root = path.resolve(import.meta.dirname, '..');
assert.doesNotThrow(() => assertPreparedLibraryRoots({}, {}));
assert.doesNotThrow(() =>
  assertPreparedLibraryRoots({ libraryRoots: ['one'] }, { libraryRoots: ['one'] }),
);
assert.throws(
  () => assertPreparedLibraryRoots({ libraryRoots: ['other'] }, { libraryRoots: ['one'] }),
  /hash-bound/,
);
assert.throws(() => assertPreparedLibraryRoots({ libraryRoots: ['one'] }, {}), /hash-bound/);
const request = {
  adapter: 'sc2',
  fields: {
    input: 'C:\\maps\\a & $(literal).SC2Map',
    installation: 'C:\\SC2',
    output: 'C:\\new',
    attributeIndex: 'C:\\proof.json',
    benchmark: 'C:\\benchmark',
  },
  fullGui: false,
};
const argv = selectAdapter(request).command(request, root);
const standalone = {
  ...request,
  fields: { ...request.fields, installation: path.join(root, '.runtime', 'public-resources') },
};
const standaloneArgs = selectAdapter(standalone).command(standalone, root);
assert(standaloneArgs.includes('--resources') && standaloneArgs.includes('--benchmark'));
assert(!standaloneArgs.includes('--sc2'));
const modRequest = { ...request, fields: { ...request.fields, input: 'C:\\maps\\Library.SC2Mod' } };
assert.equal(selectAdapter(modRequest).command(modRequest, root)[2], modRequest.fields.input);
assert.equal(argv[2], request.fields.input);
assert(argv.includes('--attribute-index'));
assert(argv.includes('--benchmark'));
assert(!argv.includes('--full-gui'));
assert(!argv.includes('--no-attribute-recovery'));
assert(
  selectAdapter({ ...request, recoverAttributes: false })
    .command({ ...request, recoverAttributes: false }, root)
    .includes('--no-attribute-recovery'),
);
assert.throws(() => selectAdapter({ ...request, recoverAttributes: 'no' }), /Invalid attribute/);
assert.throws(() => selectAdapter({ ...request, adapter: 'invented' }), /Unsupported/);
assert.throws(() => selectAdapter({ ...request, fields: {} }), /Choose/);
assert.throws(() => selectAdapter({ ...request, libraryRoots: ['bad\0path'] }), /Invalid local/);
const libraryArgv = selectAdapter({
  ...request,
  libraryRoots: ['C:\\literal & $(not-executed)'],
}).command({ ...request, libraryRoots: ['C:\\literal & $(not-executed)'] }, root);
assert.equal(libraryArgv.at(-1), 'C:\\literal & $(not-executed)');
assert.equal(libraryArgv.at(-2), '--library');
const settingsFolder = await fs.mkdtemp(path.join(os.tmpdir(), 'recovery-settings-'));
const settingsFile = path.join(settingsFolder, 'settings.json');
const store = createPreferenceStore(settingsFile);
assert.deepEqual(await store.read(), preferenceDefaults);
await store.write({ ...preferenceDefaults, fullGui: true, backgroundOpacity: 0.53 });
assert.equal((await createPreferenceStore(settingsFile).read()).fullGui, true);
assert.equal((await createPreferenceStore(settingsFile).read()).backgroundOpacity, 0.53);
await assert.rejects(store.write({ musicVolume: 1.1 }), /Invalid preference/);
await assert.rejects(
  store.write({ libraryRoots: [{ path: 'a', enabled: 'yes' }] }),
  /Invalid preference/,
);

const child = spawn(process.execPath, ['gui/dist/server.js', '--no-open'], {
  cwd: root,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, SC2_RECOVERY_SETTINGS: settingsFile },
});
let output = '',
  stderr = '';
child.stdout.setEncoding('utf8').on('data', (s) => {
  output += s;
});
child.stderr.setEncoding('utf8').on('data', (s) => {
  stderr += s;
});
const exited = once(child, 'exit');
async function eventually(check, label) {
  for (let i = 0; i < 300; i++) {
    const value = await check();
    if (value) return value;
    if (child.exitCode !== null) throw Error('GUI stopped early: ' + stderr);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error('GUI check timed out: ' + label);
}
try {
  const url = await eventually(() => output.match(/http:\/\/127\.0\.0\.1:\d+/u)?.[0], 'listen');
  const home = await fetch(url);
  const html = await home.text();
  assert(home.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  const token = html.match(/name="session-token" content="([a-f0-9]+)"/u)?.[1];
  assert(token && token.length === 64);
  assert.equal((await fetch(url + '/api/state')).status, 403);
  assert.equal(
    (
      await fetch(url + '/api/state', {
        headers: { 'X-Recovery-Token': token, Origin: 'https://hostile.example' },
      })
    ).status,
    403,
  );
  assert.equal((await fetch(url + '/../../package.json')).status, 404);
  assert.equal((await fetch(url + '/app.js')).status, 200);
  assert.equal((await fetch(url + '/picker.js')).status, 200);
  for (const module of ['hierarchy', 'search', 'settings-view'])
    assert.equal((await fetch(url + '/' + module + '.js')).status, 200);
  assert.equal((await fetch(url + '/preferences.js')).status, 404);
  async function api(route, data) {
    const response = await fetch(url + '/api/' + route, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'X-Recovery-Token': token, 'Content-Type': 'application/json' },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: response.status, value: await response.json() };
  }
  assert.equal((await api('adapters')).value[0].id, 'sc2');
  assert.equal((await api('preferences')).value.fullGui, true);
  assert.equal(
    (await api('preferences', { ...preferenceDefaults, backgroundOpacity: 2 })).status,
    400,
  );
  assert.equal((await api('preferences', preferenceDefaults)).status, 200);
  assert.equal((await api('preferences')).value.fullGui, false);
  assert.equal((await api('music', { path: 'anything.exe' })).status, 400);
  const locations = await api('places');
  assert.equal(locations.status, 200);
  assert(locations.value.some((place) => place.name === 'Home' && path.isAbsolute(place.path)));
  assert(
    locations.value.every((place) => typeof place.name === 'string' && path.isAbsolute(place.path)),
  );
  const automatic = await api('defaults');
  assert.equal(automatic.status, 200);
  assert.equal(typeof automatic.value.installationStatus, 'string');
  assert.equal(typeof automatic.value.benchmarkStatus, 'string');
  assert.equal((await api('artifact?id=../../package.json')).status, 400);
  assert.equal((await api('download?id=../../package.json')).status, 400);
  assert.equal((await api('inspect', { adapter: 'other', path: 'anything' })).status, 400);
  assert.equal((await api('recover', { ...request, adapter: 'other' })).status, 400);
  // Windows runners may expose TEMP through an 8.3 alias. The picker returns real paths.
  const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'recovery-gui-')));
  const original = path.join(temporary, 'original.SC2Map');
  const customInstallation = path.join(temporary, 'CustomSC2');
  await fs.mkdir(customInstallation);
  await fs.writeFile(path.join(customInstallation, '.build.info'), 'fixture');
  assert.equal(
    await findInstallation([temporary, customInstallation]),
    await fs.realpath(customInstallation),
  );
  assert.equal(await findInstallation([temporary]), '');
  await fs.writeFile(original, 'deliberately invalid archive');
  const proof = path.join(temporary, 'attributes.json');
  await fs.writeFile(proof, '{}');
  const packedMod = path.join(temporary, 'Packed.SC2Mod');
  const modMarkup = '<TriggerData><Root/><Library Id="A1234567"><Root/></Library></TriggerData>';
  const modBody = 'void libA1234567_InitLib() {}\r\n';
  const modHeader = 'include "TriggerLibs/NativeLib"\r\n';
  await fs.writeFile(
    packedMod,
    encodeFreshMpq([
      { path: 'Triggers', bytes: Buffer.from(modMarkup) },
      { path: 'Base.SC2Data/LibA1234567_h.galaxy', bytes: Buffer.from(modHeader) },
      { path: 'Base.SC2Data/LibA1234567.galaxy', bytes: Buffer.from(modBody) },
    ]),
  );
  const beforePreview = await fs.readFile(packedMod);
  const packedMap = path.join(temporary, 'Preview.SC2Map');
  await fs.writeFile(
    packedMap,
    encodeFreshMpq([
      { path: 'MapScript.galaxy', bytes: Buffer.from('void InitMap() {}\n') },
      { path: 'Base.SC2Data/LibExtra.galaxy', bytes: Buffer.from('void Extra() {}\n') },
    ]),
  );
  const mapPreview = await api('inspect', { adapter: 'sc2', path: packedMap });
  assert.equal(mapPreview.status, 200);
  assert.equal(mapPreview.value.canRecover, true);
  assert.deepEqual(
    mapPreview.value.sourceFiles,
    [{ path: 'MapScript.galaxy', text: 'void InitMap() {}\n' }],
    'Normal map preview must not eagerly read all included libraries',
  );
  const modPreview = await api('inspect', { adapter: 'sc2', path: packedMod });
  assert.equal(modPreview.status, 200);
  assert.equal(modPreview.value.markup, modMarkup);
  assert.equal(
    modPreview.value.source,
    modBody,
    'Preview must select the actual body, not its header',
  );
  assert.deepEqual(
    modPreview.value.sourceFiles.map((f) => f.path),
    ['Base.SC2Data/LibA1234567.galaxy', 'Base.SC2Data/LibA1234567_h.galaxy'],
  );
  assert.equal(modPreview.value.sourceFiles[1].text, modHeader);
  assert.equal(
    modPreview.value.canRecover,
    true,
    'A generated mod body/header pair must enable library recovery',
  );
  assert.deepEqual(await fs.readFile(packedMod), beforePreview);
  const componentMod = path.join(temporary, 'Components.SC2Mod');
  await fs.mkdir(path.join(componentMod, 'Base.SC2Data'), { recursive: true });
  await fs.writeFile(path.join(componentMod, 'Triggers'), modMarkup);
  await fs.writeFile(path.join(componentMod, 'Base.SC2Data', 'LibA1234567.galaxy'), modBody);
  const folderPreview = await api('inspect', { adapter: 'sc2', path: componentMod });
  assert.equal(folderPreview.status, 200);
  assert.equal(folderPreview.value.markup, modMarkup);
  assert.equal(folderPreview.value.source, modBody);
  assert.equal(folderPreview.value.canRecover, true, 'A missing header must not disable Generate');
  const wrapper = path.join(temporary, 'Wrapped.SC2Mod');
  const actualRoot = path.join(wrapper, 'Wrapped.SC2Mod');
  await fs.mkdir(actualRoot, { recursive: true });
  await fs.writeFile(path.join(actualRoot, 'Triggers'), modMarkup);
  const wrappedPreview = await api('inspect', { adapter: 'sc2', path: wrapper });
  assert.equal(wrappedPreview.status, 200);
  assert.equal(wrappedPreview.value.markup, modMarkup);
  const componentMap = path.join(temporary, 'Components.SC2Map');
  await fs.mkdir(componentMap);
  await fs.writeFile(path.join(componentMap, 'MapScript.galaxy'), 'void InitMap() {}\n');
  const folderMapPreview = await api('inspect', { adapter: 'sc2', path: componentMap });
  assert.equal(folderMapPreview.status, 200);
  assert.equal(folderMapPreview.value.canRecover, true);
  const componentListing = await api('files', { kind: 'map', path: componentMap });
  assert.equal(componentListing.value.selected, await fs.realpath(componentMap));
  assert(
    componentListing.value.entries.some(
      (entry) => entry.path === componentMap && entry.package && entry.directory,
    ),
  );
  const resourceMod = path.join(temporary, 'Resource.SC2Mod');
  await fs.writeFile(
    resourceMod,
    encodeFreshMpq([{ path: 'Test.txt', bytes: Buffer.from('resource') }]),
  );
  const resourcePreview = await api('inspect', { adapter: 'sc2', path: resourceMod });
  assert.equal(resourcePreview.status, 200);
  assert.deepEqual(resourcePreview.value.sourceFiles, []);
  assert.equal(resourcePreview.value.markup, '');
  assert.equal(
    resourcePreview.value.canRecover,
    true,
    'Resource-only packages may start validation',
  );
  const resourceMap = path.join(temporary, 'Resource.SC2Map');
  await fs.copyFile(resourceMod, resourceMap);
  assert.equal(
    (await api('inspect', { adapter: 'sc2', path: resourceMap })).value.canRecover,
    true,
  );
  const excluded = path.join(temporary, 'NotShown.SC2Campaign');
  await fs.writeFile(excluded, 'fixture');
  const mod = path.join(temporary, 'Dependency.SC2Mod');
  await fs.mkdir(mod);
  await fs.mkdir(path.join(mod, 'TriggerLibs'));
  const dependencySource = 'void ExtraDependency() {}\n';
  await fs.writeFile(path.join(mod, 'TriggerLibs/Extra.galaxy'), dependencySource);
  const extraSources = new BoundedLocalModSources({
    sources: [{ type: 'mods', path: temporary, priority: -100 }],
  });
  try {
    const local = extraSources.locals.get('local:mods:0');
    assert(local, 'The configured root must be mounted by the real SDK');
    assert.equal(
      Buffer.from(await local.read('Dependency.SC2Mod/TriggerLibs/Extra.galaxy', 1024)).toString(
        'utf8',
      ),
      dependencySource,
    );
    const identity = await extraSources.resolveLocalPath(
      'local:mods:0',
      'Mods/Dependency.SC2Mod/TriggerLibs/Extra.galaxy',
    );
    assert.equal(identity.path, path.join(mod, 'TriggerLibs/Extra.galaxy'));
  } finally {
    await extraSources.dispose();
  }
  assert.deepEqual(await normalizeLibraryRoots([mod, temporary]), [await fs.realpath(temporary)]);
  await assert.rejects(normalizeLibraryRoots([proof]), /Choose an SC2 package/);
  assert.equal((await api('library-root', { path: proof })).status, 400);
  assert.equal((await api('library-root', { path: mod })).value.path, await fs.realpath(temporary));
  await fs.writeFile(path.join(temporary, 'track.ogg'), 'fixture');
  const audioListing = await api('files', { kind: 'audio', path: temporary });
  assert(audioListing.value.entries.some((e) => e.name === 'track.ogg'));
  assert(!audioListing.value.entries.some((e) => e.name === 'attributes.json'));
  const libraryListing = await api('files', { kind: 'library', path: temporary });
  assert(libraryListing.value.entries.some((e) => e.name === 'Dependency.SC2Mod'));
  const mapListing = await api('files', { kind: 'map', path: temporary });
  assert.equal(mapListing.status, 200);
  assert(mapListing.value.entries.some((e) => e.path === original && !e.directory));
  assert(mapListing.value.entries.some((e) => e.path === packedMod && !e.directory));
  assert(mapListing.value.entries.every((e) => e.directory || /\.sc2(map|mod)$/i.test(e.name)));
  assert(!mapListing.value.entries.some((e) => e.path === excluded));
  assert(!mapListing.value.entries.some((e) => e.path === proof));
  assert(mapListing.value.entries.some((e) => e.name === 'CustomSC2' && e.directory));
  const pasted = await api('files', { kind: 'map', path: original });
  assert.equal(pasted.value.selected, await fs.realpath(original));
  assert.equal(pasted.value.directory, await fs.realpath(temporary));
  const pastedMod = await api('files', { kind: 'map', path: packedMod });
  assert.equal(pastedMod.value.selected, await fs.realpath(packedMod));
  const jsonListing = await api('files', { kind: 'json', path: temporary });
  assert(jsonListing.value.entries.some((e) => e.path === proof));
  assert(!jsonListing.value.entries.some((e) => e.path === original));
  for (const kind of ['folder', 'output']) {
    const folders = await api('files', { kind, path: temporary });
    assert.equal(folders.status, 200);
    assert(folders.value.entries.every((e) => e.directory));
  }
  assert.equal((await api('files', { kind: 'invented', path: temporary })).status, 400);
  assert.equal((await api('files', { kind: 'map', path: 12 })).status, 400);
  assert.equal((await api('files', { kind: 'map', path: temporary + '/missing' })).status, 400);
  assert.equal((await api('files', { kind: 'map', path: temporary })).status, 200);
  assert.equal((await api('files', { kind: 'map' })).status, 200);
  assert.equal(await fs.readFile(proof, 'utf8'), '{}');
  assert.equal((await api('inspect', { adapter: 'sc2', path: original })).status, 400);
  assert.equal(await fs.readFile(original, 'utf8'), 'deliberately invalid archive');
  const fields = {
    input: original,
    installation: temporary,
    output: temporary,
    benchmark: automatic.value.benchmark || 'C:\\benchmark',
  };
  assert.equal((await api('recover', { adapter: 'sc2', fields, fullGui: false })).status, 400);
  fields.output = path.join(temporary, 'new-output');
  const started = await api('recover', { adapter: 'sc2', fields, fullGui: false });
  assert.equal(started.value.phase, 'running');
  assert.equal((await api('recover', { adapter: 'sc2', fields, fullGui: false })).status, 400);
  const finished = await eventually(async () => {
    const { value } = await api('state');
    return value.phase === 'failed' && value;
  }, 'invalid archive refusal');
  assert.notEqual(finished.exitCode, 0);
  assert(finished.log.includes('trigger-recovery:'));
  assert(finished.error.includes('trigger-recovery:') === false);
  assert(finished.progress.percent >= 0 && finished.progress.percent < 100);
  assert.equal(await fs.readFile(original, 'utf8'), 'deliberately invalid archive');
  // An immediate cancellation must stop the owned CLI process, leave the bridge
  // responsive and allow explicit shutdown. Never target an Editor/game process.
  fields.output = path.join(temporary, 'cancel-output');
  assert.equal((await api('recover', { adapter: 'sc2', fields, fullGui: false })).status, 200);
  assert.equal((await api('cancel', {})).status, 200);
  await eventually(async () => {
    const { value } = await api('state');
    return value.phase === 'cancelled' && value.exitCode !== undefined;
  }, 'process cancellation');
  assert.equal(await fs.readFile(original, 'utf8'), 'deliberately invalid archive');
  assert.equal((await api('shutdown', {})).status, 200);
  await exited;
  console.log(
    'GUI bridge passed: types, adapter argv, origin/token isolation, output guards, concurrent-job refusal, worker failure, immutable input and shutdown.',
  );
} finally {
  if (child.exitCode === null) child.kill();
}

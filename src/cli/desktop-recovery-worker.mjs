import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { runTriggerRecovery } from '../../trigger-recovery.mjs';
import { BlizzardLibraryCache } from './blizzard-library-cache.mjs';

let installationKey, libraries;
let busy = false;
let loading, warming;
const flush = (stream) => new Promise((resolve) => stream.write('', resolve));

async function selectInstallation(installation) {
  let location, digest;
  try {
    location = await realpath(installation);
    digest = createHash('sha256')
      .update(await readFile(path.join(location, '.build.info')))
      .digest('hex');
  } catch {
    // The recovery command reports installation errors.
  }
  const key = digest === undefined ? undefined : JSON.stringify([location, digest]);
  if (installationKey !== key) {
    await libraries?.dispose();
    libraries = key && new BlizzardLibraryCache({ expectedBuild: digest });
    installationKey = key;
  }
  return location;
}

async function preload(installation) {
  const location = await selectInstallation(installation);
  if (!libraries) return;
  const { Sc2DesktopContentSources } = await import(
    '../sdk/production-preparation/modules/game/battlenet/content-sources/local-content-sources.js'
  );
  const sources = new Sc2DesktopContentSources({ installationDirectory: location });
  const source = sources.locals.get('local:casc');
  const cache = libraries;
  cache.attach(sources);
  const isIdle = () => process.connected && !busy && libraries === cache;
  warming = Promise.allSettled([
    (async () => {
      try {
        if (!source) return;
        await source.open();
        if (!isIdle()) return;
        const { preloadBlizzardLibraries } = await import('./preload-blizzard-libraries.mjs');
        await preloadBlizzardLibraries(sources, cache, isIdle);
      } finally {
        await sources.dispose();
      }
    })(),
    import('./prepare-map.mjs'),
    import('./convert.mjs'),
  ]);
}

process.on('message', async ({ type, args, installation } = {}) => {
  if (type === 'preload' && !busy && !loading) {
    loading = preload(installation).catch(() => {});
    return;
  }
  if (type !== 'recover' || busy) return;
  busy = true;
  process.exitCode = undefined;
  try {
    await loading;
    await selectInstallation(installation);
    await runTriggerRecovery(args, { retainedLibraries: libraries, publishTriggers: true });
  } catch (error) {
    console.error('trigger-recovery: ' + error.message);
    process.exitCode = 1;
  }
  const code = process.exitCode ?? 0;
  process.exitCode = undefined;
  await Promise.all([flush(process.stdout), flush(process.stderr)]);
  busy = false;
  if (process.connected) process.send({ type: 'recovery-done', code });
});
process.once('disconnect', async () => {
  await loading;
  await warming;
  await libraries?.dispose().catch((error) => console.error(error.message));
});

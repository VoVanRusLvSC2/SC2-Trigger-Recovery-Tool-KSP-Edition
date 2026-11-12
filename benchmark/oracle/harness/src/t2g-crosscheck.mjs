// Triggers -> Galaxy as its own benchmark: every converter's Triggers (and the map's own Triggers) go
// through each chosen Triggers -> Galaxy compiler in a fresh process, and the result is compared with the
// original MapScript.galaxy. The source run may be a galaxy-to-triggers or a galaxy-triggers-roundtrip run.
// Usage: node src/t2g-crosscheck.mjs <run directory | --latest <manifest name>>
//          [--ksp-run <run directory>] [--leak-run <run directory>] [--compilers modkit,ksp]
//          [--sources original,modkit,ksp,ksp-full-map] [--cases id,id] [--repetitions N] [--name <manifest name>] [--run]
// --ksp-run takes KSP's Triggers from another run; --leak-run adds the KSP Triggers of an older run that
// gave KSP the full map (with its Triggers).
import { existsSync, readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { runBenchmark } from './benchmark.mjs';

const root = path.resolve(import.meta.dirname, '..');
const runsRoot = path.join(root, '.benchmark-runs');

function latestRun(name) {
  const candidates = readdirSync(runsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith(`${name}-2`) && existsSync(path.join(runsRoot, entry.name, 'summary.json')))
    .map(entry => entry.name).sort();
  if (!candidates.length) throw new Error(`no finished run of ${name} under ${runsRoot}`);
  return path.join(runsRoot, candidates.at(-1));
}

const outputFile = (run, caseId, converter, file) => {
  const target = path.join(run, 'cases', caseId, converter, 'attempt-01', 'output', file);
  return existsSync(target) ? target : undefined;
};

async function runManifest(runDirectory) {
  const summaryPath = path.join(runDirectory, 'summary.json');
  if (existsSync(summaryPath)) {
    const summary = JSON.parse(await readFile(summaryPath, 'utf8'));
    return { path: summary.manifestPath, manifest: JSON.parse(await readFile(summary.manifestPath, 'utf8')) };
  }
  throw new Error(`${runDirectory} has no summary.json`);
}

export async function buildCrosscheckManifest(runDirectory, {
  kspRun, leakRun, compilers = ['modkit', 'ksp'], cases: onlyCases, repetitions = 1, name,
  sources = ['original', 'modkit', 'ksp', 'ksp-full-map'],
} = {}) {
  const { path: manifestPath, manifest } = await runManifest(runDirectory);
  const manifestDirectory = path.dirname(manifestPath);
  const relative = file => path.relative(manifestDirectory, file).replaceAll(path.sep, '/');
  const kspSource = kspRun ?? runDirectory;
  const cases = [];
  for (const source of manifest.cases.filter(item => !onlyCases || onlyCases.includes(item.id))) {
    const packageInput = source.inputs.find(input => input.role === 'package');
    const originalStrings = source.inputs.filter(input => ['trigger-strings', 'game-strings'].includes(input.role));
    const base = (id, triggerData, strings, tags) => ({
      id: `${source.id}.${id}`, documentKind: source.documentKind, operation: 'triggers-to-galaxy',
      tags: [...new Set([...(source.tags ?? []), ...tags])],
      inputs: [
        { role: 'package', id: 'map-package', path: packageInput.path },
        { role: 'expected-script', fromPackage: 'map-package', path: 'MapScript.galaxy' },
        { role: 'trigger-data', path: triggerData },
        ...strings,
      ],
      options: { libraryId: source.options?.libraryId ?? 'Map' },
    });
    const originalTriggers = source.inputs.find(input => input.role === 'expected-trigger-data')?.path;
    if (originalTriggers && sources.includes('original')) cases.push(base('original-triggers', originalTriggers, originalStrings, ['triggers-source-original']));
    const modkitTriggers = outputFile(runDirectory, source.id, 'modkit', 'Triggers');
    if (modkitTriggers && sources.includes('modkit')) {
      // Modkit writes the strings its Triggers name; without them the elements lose their names.
      const own = [['trigger-strings', 'TriggerStrings.txt'], ['game-strings', 'GameStrings.txt']].flatMap(([role, file]) => {
        const found = outputFile(runDirectory, source.id, 'modkit', file);
        return found ? [{ role, path: relative(found) }] : originalStrings.filter(input => input.role === role);
      });
      cases.push(base('modkit-triggers', relative(modkitTriggers), own, ['triggers-source-modkit']));
    }
    const kspTriggers = outputFile(kspSource, source.id, 'ksp', 'Triggers');
    if (kspTriggers && sources.includes('ksp')) cases.push(base('ksp-triggers', relative(kspTriggers), originalStrings, ['triggers-source-ksp']));
    const leaked = leakRun && outputFile(leakRun, source.id, 'ksp', 'Triggers');
    if (leaked && sources.includes('ksp-full-map')) cases.push(base('ksp-triggers-full-map', relative(leaked), originalStrings, ['triggers-source-ksp', 'ksp-saw-original-triggers']));
  }
  const converters = [];
  const modkit = manifest.converters.find(converter => converter.id === 'modkit');
  if (compilers.includes('modkit') && modkit) converters.push({ ...modkit, id: 'modkit-t2g', timeoutMs: 900000 });
  // KSP's own compiler needs its adapter; a Modkit-only source run carries none, so take the final one.
  if (compilers.includes('ksp')) {
    // A Modkit-only source run carries no KSP adapter settings: take them from the KSP run when it finished.
    const kspManifest = kspRun && existsSync(path.join(kspRun, 'summary.json')) ? (await runManifest(kspRun)).manifest : undefined;
    const ksp = manifest.converters.find(converter => converter.id === 'ksp')
      ?? kspManifest?.converters.find(converter => converter.id === 'ksp')
      ?? { id: 'ksp', command: 'node', args: ['adapters/ksp.mjs', '{request}'], env: { KSP_MIN_FREE_VIRTUAL_GB: '1.5' } };
    converters.push({ ...ksp, id: 'ksp-t2g', timeoutMs: 900000 });
  }
  return {
    schemaVersion: 1,
    name: name ?? `${manifest.name}-t2g`,
    astOracleModule: manifest.astOracleModule,
    repetitions,
    timeoutMs: 3600000,
    converters,
    cases,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const take = flag => {
    const index = args.indexOf(flag);
    if (index < 0) return undefined;
    const [, value] = args.splice(index, 2);
    return value;
  };
  const latest = take('--latest');
  const leakRun = take('--leak-run');
  const kspRun = take('--ksp-run');
  const compilers = take('--compilers')?.split(',');
  const cases = take('--cases')?.split(',');
  const sources = take('--sources')?.split(',');
  const repetitions = Number(take('--repetitions') ?? 1);
  const name = take('--name');
  const run = args.includes('--run');
  const runDirectory = latest ? latestRun(latest) : args.find(arg => !arg.startsWith('--'));
  if (!runDirectory) {
    console.error('Usage: node src/t2g-crosscheck.mjs <run directory | --latest <manifest name>> [--ksp-run <dir>] [--leak-run <dir>] [--compilers modkit,ksp] [--cases id,id] [--repetitions N] [--name <name>] [--run]');
    process.exitCode = 2;
    return;
  }
  const manifest = await buildCrosscheckManifest(path.resolve(runDirectory), {
    ...(kspRun ? { kspRun: path.resolve(kspRun) } : {}), ...(leakRun ? { leakRun: path.resolve(leakRun) } : {}),
    ...(compilers ? { compilers } : {}), ...(cases ? { cases } : {}), ...(sources ? { sources } : {}), repetitions, ...(name ? { name } : {}),
  });
  const manifestPath = path.join(root, `benchmark.${manifest.name}.json`);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`${manifestPath}: ${manifest.cases.length} cases × ${manifest.converters.length} compilers × ${manifest.repetitions}`);
  if (!run) return;
  const summary = await runBenchmark(manifestPath, path.join(root, '.benchmark-runs'));
  console.log(JSON.stringify({ runDirectory: summary.runDirectory, counts: summary.counts }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

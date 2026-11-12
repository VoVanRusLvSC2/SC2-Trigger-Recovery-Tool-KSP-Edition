import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { excludedDependency } from './excluded-dependents.mjs';

const dependencyIdPattern = /^[A-Za-z0-9._-]+$/u;

export function buildMapManifest(census, {
  count = 100,
  modCount = 0,
  baseDirectory = process.cwd(),
  manifestDirectory = process.cwd(),
  dependencies = [],
  selection = 'spread',
} = {}) {
  if (!['spread', 'complex'].includes(selection)) throw new TypeError('selection must be spread or complex');
  if (!Array.isArray(dependencies)) throw new TypeError('dependencies must be an array');
  const dependencyConfigs = dependencies.map(dependency => dependency && typeof dependency === 'object' && !Array.isArray(dependency)
    ? { ...dependency, group: dependency.group ?? dependency.id }
    : dependency);
  const dependencyIds = new Set(['map-package']);
  for (const dependency of dependencyConfigs) {
    if (!dependency || typeof dependency !== 'object' || Array.isArray(dependency)
        || typeof dependency.id !== 'string' || !dependencyIdPattern.test(dependency.id)
        || dependencyIds.has(dependency.id) || typeof dependency.packagePath !== 'string'
        || typeof dependency.triggerDataPath !== 'string' || !dependency.triggerDataPath) {
      throw new TypeError('each dependency needs a unique id, packagePath, and triggerDataPath');
    }
    dependencyIds.add(dependency.id);
    if (typeof dependency.group !== 'string' || !dependency.group) throw new TypeError(`${dependency.id}.group must be a non-empty string`);
    for (const key of ['triggerStringsPath', 'gameStringsPath']) {
      if (dependency[key] !== undefined && (typeof dependency[key] !== 'string' || !dependency[key])) {
        throw new TypeError(`${dependency.id}.${key} must be a non-empty path string`);
      }
    }
  }
  const candidates = census.packages
    .filter(item => item.kind === 'map' && item.mapScripts.length === 1)
    .map(item => ({
      ...item,
      sourceScripts: item.galaxyFiles.filter(file => !/_h\.galaxy$/iu.test(file)),
      scriptBytes: item.galaxyFileBytes?.[item.mapScripts[0]] ?? 0,
    }))
    .sort((a, b) => a.scriptBytes - b.scriptBytes || a.packagePath.localeCompare(b.packagePath));
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(modCount) || modCount < 0 || modCount >= count) {
    throw new RangeError('count must be positive and modCount must be between 0 and count - 1');
  }
  const mapCount = count - modCount;
  if (candidates.length < mapCount) {
    throw new RangeError(`requested ${mapCount} map cases, but census has ${candidates.length} usable map scripts`);
  }
  const selectedMaps = (selection === 'complex' ? candidates.slice(-mapCount) : Array.from({ length: mapCount }, (_, index) =>
    candidates[Math.round(index * (candidates.length - 1) / Math.max(1, mapCount - 1))]))
    .map(item => ({ ...item, kind: 'map', script: item.mapScripts[0] }));
  let selectedMods = [];
  if (modCount > 0) {
    const modCandidates = census.packages
      .filter(item => item.kind === 'mod' && item.triggerDataFiles.length === 1)
      .map(item => ({
        ...item,
        sourceScripts: item.galaxyFiles.filter(file => !/_h\.galaxy$/iu.test(file)),
      }))
      .filter(item => item.sourceScripts.length > 0)
      .map(item => {
        const script = [...item.sourceScripts].sort((a, b) =>
          (item.galaxyFileBytes?.[b] ?? 0) - (item.galaxyFileBytes?.[a] ?? 0) || a.localeCompare(b))[0];
        return { ...item, script, scriptBytes: item.galaxyFileBytes?.[script] ?? 0 };
      })
      .sort((a, b) => a.scriptBytes - b.scriptBytes || a.packagePath.localeCompare(b.packagePath));
    if (modCandidates.length < modCount) {
      throw new RangeError(`requested ${modCount} mod cases, but census has ${modCandidates.length} mods with Galaxy scripts and TriggerData`);
    }
    selectedMods = selection === 'complex' ? modCandidates.slice(-modCount) : Array.from({ length: modCount }, (_, index) =>
      modCandidates[Math.round(index * (modCandidates.length - 1) / Math.max(1, modCount - 1))]);
  }
  const selected = [...selectedMaps, ...selectedMods]
    .sort((a, b) => a.scriptBytes - b.scriptBytes || a.kind.localeCompare(b.kind) || a.packagePath.localeCompare(b.packagePath));
  const cases = selected.map((item, index) => {
    const packagePath = path.relative(manifestDirectory, path.resolve(baseDirectory, item.packagePath)).split(path.sep).join('/');
    const sourcePackageId = item.kind === 'map' ? 'map-package' : 'mod-package';
    const inputs = [
      { role: 'package', id: sourcePackageId, path: packagePath },
      { role: 'script', fromPackage: sourcePackageId, path: item.script },
    ];
    const scriptBase = path.posix.basename(item.script).replace(/\.galaxy$/iu, '');
    const header = item.galaxyFiles.find(file => path.posix.basename(file).toLowerCase() === `${scriptBase}_h.galaxy`.toLowerCase());
    if (header) inputs.push({ role: 'header', fromPackage: sourcePackageId, path: header });
    const hasIndependentGuiBaseline = item.triggerDataFiles.length === 1 && item.sourceScripts.length === 1;
    if (hasIndependentGuiBaseline) {
      inputs.push({ role: 'expected-trigger-data', fromPackage: sourcePackageId, path: item.triggerDataFiles[0] });
    }
    if (item.triggerDataFiles.length === 1) {
      inputs.push({ role: 'original-trigger-data', fromPackage: sourcePackageId, path: item.triggerDataFiles[0] });
    }
    if (item.triggerStringsFiles.length) {
      const strings = item.triggerStringsFiles.find(file => file.toLowerCase().includes('enus')) ?? item.triggerStringsFiles[0];
      inputs.push({ role: 'trigger-strings', fromPackage: sourcePackageId, path: strings });
    }
    if (item.gameStringsFiles?.length) {
      const strings = item.gameStringsFiles.find(file => file.toLowerCase().includes('enus')) ?? item.gameStringsFiles[0];
      inputs.push({ role: 'game-strings', fromPackage: sourcePackageId, path: strings });
    }
    for (const dependency of dependencyConfigs) {
      const dependencyPath = path.relative(manifestDirectory, path.resolve(baseDirectory, dependency.packagePath)).split(path.sep).join('/');
      inputs.push({ role: 'package', id: dependency.id, path: dependencyPath });
      inputs.push({ role: 'dependency-trigger-data', group: dependency.group, fromPackage: dependency.id, path: dependency.triggerDataPath });
      if (dependency.triggerStringsPath) {
        inputs.push({ role: 'dependency-trigger-strings', group: dependency.group, fromPackage: dependency.id, path: dependency.triggerStringsPath });
      }
      if (dependency.gameStringsPath) {
        inputs.push({ role: 'dependency-game-strings', group: dependency.group, fromPackage: dependency.id, path: dependency.gameStringsPath });
      }
    }
    const sizeTier = Math.min(4, Math.floor(index * 5 / count));
    const multiLibraryPackage = item.kind === 'mod' && item.sourceScripts.length > 1;
    return {
      id: `${selection === 'complex' ? 'complex' : 'real'}-${item.kind}-${String(index + 1).padStart(3, '0')}`,
      documentKind: item.kind,
      operation: 'galaxy-triggers-roundtrip',
      tags: [
        'real-package', `${item.kind}-script`,
        ...(item.kind === 'mod' ? ['mod-library', multiLibraryPackage ? 'multi-library-package' : 'single-library-package'] : []),
        ...(header ? ['has-galaxy-header'] : []),
        ...(item.triggerStringsFiles.length ? ['has-trigger-strings'] : []),
        ...(item.gameStringsFiles?.length ? ['has-game-strings'] : []),
        `script-size-tier-${sizeTier + 1}`,
        ...(hasIndependentGuiBaseline ? ['gui-baseline'] : ['no-gui-baseline']),
      ],
      inputs,
      options: {
        libraryId: item.kind === 'map' ? 'Map' : scriptBase.replace(/^Lib/iu, ''),
        // The benchmark performs the reverse stage itself; avoid doing it twice.
        verification: 'semantic',
      },
    };
  });
  const sizeTierCounts = Object.fromEntries(Array.from({ length: 5 }, (_, tier) => [
    `script-size-tier-${tier + 1}`,
    cases.filter(item => item.tags.includes(`script-size-tier-${tier + 1}`)).length,
  ]));
  const minTags = {
    'real-package': count,
    'map-script': mapCount,
    'mod-script': modCount,
    'mod-library': modCount,
    ...sizeTierCounts,
  };
  const guiBaselineCases = cases.filter(item => item.tags.includes('gui-baseline')).length;
  if (guiBaselineCases > 0) minTags['gui-baseline'] = guiBaselineCases;
  for (const tag of ['multi-library-package', 'single-library-package', 'has-galaxy-header', 'has-trigger-strings', 'has-game-strings']) {
    const taggedCases = cases.filter(item => item.tags.includes(tag)).length;
    if (taggedCases > 0) minTags[tag] = taggedCases;
  }
  return {
    schemaVersion: 1,
    name: `real-${modCount > 0 ? 'mixed' : 'map'}-${count}${selection === 'complex' ? '-complex' : ''}`,
    astOracleModule: '../modkit-extensions-blizzard/starcraft2/dist/modules/triggers/services/galaxy-conversion/index.js',
    repetitions: 1,
    timeoutMs: 60000,
    coverageRequirements: {
      minCases: count,
      // Each shared dependency is repeated in every case but contributes one
      // unique digest, so require enough additional unique primary packages.
      minUniquePackages: count + dependencies.length,
      minDocumentKinds: { map: mapCount, mod: modCount },
      minOperations: { 'galaxy-triggers-roundtrip': count },
      minTags,
    },
    converters: [{
      id: 'modkit',
      command: 'node',
      args: ['adapters/modkit.mjs', '{request}'],
      env: { MODKIT_CONVERSION_MODULE: '../modkit-extensions-blizzard/starcraft2/dist/modules/triggers/services/galaxy-conversion/index.js' },
    }],
    cases,
  };
}

async function main(args) {
  const [censusPath, outputPath, countText, dependenciesPath, modCountText, selection] = args;
  if (!censusPath || !outputPath) throw new TypeError('usage: node src/package-manifest.mjs <census.json> <manifest.json> [case-count] [dependencies.json|-] [mod-count] [spread|complex]');
  const census = JSON.parse(await readFile(censusPath, 'utf8'));
  // Owner decisions 2026-09-25 and 2026-09-28: the mods of EXCLUDED_MODS (tib-data, ARC, UEDFL) are not
  // benchmarked, nor is anything that depends on them.
  census.packages = census.packages.filter(item => !excludedDependency(path.resolve(item.packagePath)));
  const dependencies = dependenciesPath && dependenciesPath !== '-' ? JSON.parse(await readFile(dependenciesPath, 'utf8')) : [];
  const output = path.resolve(outputPath);
  const manifest = buildMapManifest(census, {
    count: countText === undefined ? 100 : Number(countText),
    modCount: modCountText === undefined ? 0 : Number(modCountText),
    baseDirectory: process.cwd(),
    manifestDirectory: path.dirname(output),
    dependencies,
    selection,
  });
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`wrote ${manifest.cases.length} cases to ${output}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  });
}

/** Build the worker's hash-bound observation from a real map and installed SC2.
 * The original archive is read-only; unresolved dependencies/includes fail closed. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { MapSession } from '../conversion/partition-declaration-identity/map-session-fixed.mjs';
import { openSc2Package, verifyComponentSource, packComponentSnapshot } from './sc2-package.mjs';
export { safeComponentPath } from './sc2-package.mjs';
import { safeComponentPath } from './sc2-package.mjs';
import { removeEmptyDependencyDocuments } from '../libraries/preparation/empty-dependency-documents.mjs';
import { xmlTree } from '../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
import { parseGalaxySource } from '../conversion/runtime-event-public-alias/galaxy-to-trigger.standard-getter.mjs';
import { SyntaxKind } from '../sdk/core/modules/galaxy/language-core/types.js';
import { attributeUseInGalaxy } from '../verification/attribute-use-evidence.mjs';
import { normalizeLibraryRoots } from '../libraries/local-roots.mjs';
import { BoundedLocalModSources } from '../libraries/extensions/bounded-local-mod-sources.mjs';
import { modLibraryUnits } from './mod-library-units.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const save = (file, data) => fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
const require = createRequire(import.meta.url);
const isTriggerInput = (name) =>
  /^(?:MapScript|LibMap_h|ai[0-9a-f]{8})\.galaxy$/iu.test(name) ||
  /^(?:Triggers|CustomAI|Attributes)$/iu.test(name) ||
  /^[a-z]{4}\.SC2Data\/LocalizedData\/(?:TriggerStrings|GameStrings)\.txt$/iu.test(name);

export function loadTriggerWorkspace() {
  // This adapter path is pinned by the runtime revision and exercised by the release smoke.
  const workspace = new URL(
    '../workspace/mod-libraries.js',
    pathToFileURL(require.resolve('@modkit/blizzard-starcraft2/triggers/conversion')),
  );
  return import(workspace.href);
}

export async function prepareMap({
  original,
  installation,
  resourceSnapshot,
  output,
  mpq,
  guiRecoveryMode = 'preserve-source',
  attributeIndex,
  recoverAttributes = true,
  libraryRoots = [],
  blizzardLibraries,
  onProgress = () => {},
}) {
  assert.equal(typeof recoverAttributes, 'boolean', 'Invalid attribute recovery option');
  libraryRoots = await normalizeLibraryRoots(libraryRoots);
  original = await fs.realpath(original);
  assert(!(installation && resourceSnapshot), 'Choose either --sc2 or --resources');
  const publicResources = resourceSnapshot !== undefined;
  installation = await fs.realpath(publicResources ? resourceSnapshot : installation);
  const sourceIdentityFile = path.join(
    installation,
    publicResources ? 'RESOURCE_MANIFEST.json' : '.build.info',
  );
  if (publicResources) {
    const manifest = JSON.parse(await fs.readFile(sourceIdentityFile, 'utf8'));
    assert(
      manifest.resourceType === 'public-snapshot-not-installed-game' &&
        manifest.verifiedGitBlobs === true &&
        manifest.revision === '6dd323aae4209a01f110719a00b4e8f7a88389bc',
      'Unsupported or incomplete public resource snapshot',
    );
  }
  if (attributeIndex !== undefined) {
    attributeIndex = await fs.realpath(attributeIndex);
    assert((await fs.stat(attributeIndex)).isFile(), 'Expected an attribute index file');
  }
  assert(/\.sc2(map|mod)$/iu.test(original), 'Expected a .SC2Map or .SC2Mod package');
  const documentKind = /\.sc2mod$/i.test(original) ? 'mod' : 'map';
  const sourceDirectory = (await fs.stat(original)).isDirectory();
  const sourcePath = original;
  const parent = await fs.realpath(path.dirname(path.resolve(output)));
  output = path.join(parent, path.basename(path.resolve(output)));
  const inputRelative = path.relative(output, original);
  assert(
    inputRelative && (inputRelative.startsWith('..' + path.sep) || path.isAbsolute(inputRelative)),
    'Output would contain original',
  );
  const root = path.resolve(import.meta.dirname, '../..');
  for (const protectedPath of [
    original,
    installation,
    path.join(root, 'src'),
    path.join(root, '.runtime'),
    path.join(root, 'node_modules'),
  ]) {
    const relative = path.relative(protectedPath, output);
    assert(
      relative && (relative.startsWith('..' + path.sep) || path.isAbsolute(relative)),
      'Output overlaps protected input or application',
    );
  }
  // Exclusive creation prevents mixing a previous map's observations with this run.
  await fs.mkdir(output);
  const pkg = path.join(output, 'package');
  await fs.mkdir(pkg);
  onProgress({ stage: 'Reading package', percent: 1 });
  const reader = await openSc2Package(original, {
    maxArchiveBytes: 1024 ** 3,
    maxEntries: 100000,
    maxEntryBytes: 256 * 1024 ** 2,
  });
  const entries = [],
    names = new Set();
  const deferred = new Map();
  const writeComponent = async (entry, payload) => {
    assert.equal(payload.length, entry.bytes, 'Prepared component size differs: ' + entry.path);
    const file = path.join(pkg, ...entry.path.split('/'));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, payload, { flag: 'wx' });
    entry.sha256 = sha(payload);
  };
  const writeDeferredComponent = async (name, payload) => {
    const key = name.replaceAll('\\', '/').toLowerCase();
    const entry = deferred.get(key);
    if (entry) {
      await writeComponent(entry, payload);
      deferred.delete(key);
    }
  };
  const selectiveMap =
    documentKind === 'map' &&
    !sourceDirectory &&
    !publicResources &&
    !reader.recovered &&
    !reader.headerRepaired;
  let total = 0;
  let reportedPercent = -1;
  try {
    for (const [index, entry] of reader.entries.entries()) {
      const name = safeComponentPath(entry.path),
        canonical = name.toLowerCase();
      assert(!names.has(canonical), 'Ambiguous case-insensitive component: ' + name);
      names.add(canonical);
      if (selectiveMap && !isTriggerInput(name)) {
        assert(entry.size <= 256 * 1024 ** 2, 'Map component exceeds preparation budget');
        total += entry.size;
        assert(total <= 4 * 1024 ** 3, 'Expanded map exceeds preparation budget');
        const record = { path: name, bytes: entry.size };
        entries.push(record);
        deferred.set(canonical, record);
        continue;
      }
      const payload = Buffer.from(await reader.read(entry.id));
      total += payload.length;
      assert(total <= 4 * 1024 ** 3, 'Expanded map exceeds preparation budget');
      const record = { path: name, bytes: payload.length };
      await writeComponent(record, payload);
      entries.push(record);
      const percent = 1 + Math.floor((9 * (index + 1)) / reader.entries.length);
      if (percent !== reportedPercent) {
        reportedPercent = percent;
        onProgress({ stage: 'Reading package', percent });
      }
    }
  } finally {
    reader.dispose();
  }
  const sourcePackage = sourceDirectory
    ? { path: reader.componentRoot, requestedPath: sourcePath, kind: 'components', entries }
    : undefined;
  if (sourceDirectory) {
    // The existing archive worker receives an immutable, byte-for-byte component
    // snapshot. The user's original folder has its own separately checked proof.
    const snapshotDirectory = path.join(output, 'source');
    await fs.mkdir(snapshotDirectory);
    original = path.join(snapshotDirectory, path.basename(sourcePath));
    await packComponentSnapshot(path.resolve(mpq), pkg, original, entries);
  }
  const originalSha256 = sourceDirectory ? sha(await fs.readFile(original)) : reader.archiveSha256;
  onProgress({ stage: 'Loading SC2 metadata', percent: 11 });

  const session = new MapSession({
    installation,
    blizzardLibraries,
    ...(libraryRoots.length || publicResources
      ? {
          sources: new BoundedLocalModSources({
            installationDirectory: installation,
            ...(publicResources
              ? {
                  documentsDirectory: path.join(installation, '.unused-user-data'),
                  battleNetCacheDirectory: path.join(installation, '.unused-bnet-cache'),
                  sc2MapsCacheDirectory: path.join(installation, '.unused-map-cache'),
                }
              : {}),
            sources: libraryRoots.map((p) => ({ type: 'mods', path: p, priority: -100 })),
          }),
        }
      : {}),
    sourceIdentityFile,
    maxAstEntries: 0,
    maxAstBytes: 0,
  });
  const sourceInput = async (text, label) => {
    const digest = sha(text),
      folder = path.join(output, 'inputs', digest);
    await fs.mkdir(folder, { recursive: true });
    const file = path.join(
      folder,
      path.basename(label.replaceAll('\\', '/')).replace(/[<>:"/\\|?*\x00-\x1f]/gu, '_'),
    );
    await fs.writeFile(file, text);
    return { path: file, sha256: digest, bytes: Buffer.byteLength(text), sourceLabel: label };
  };
  try {
    const { readTriggerDependencies, readTriggerDeclarations } = await loadTriggerWorkspace();
    const beforeBuild = await session.installationStamp();
    blizzardLibraries?.confirmBuild(beforeBuild);
    const context = await session.open({ schemaVersion: 1, target: original });
    const primary = context.layers.at(-1);
    const libraryUnits =
      documentKind === 'mod' ? modLibraryUnits(entries.map((entry) => entry.path)) : [];
    assert(
      documentKind === 'map' || libraryUnits.length,
      'No generated Galaxy library body/header pairs found in this mod',
    );
    const primaryPaths =
      documentKind === 'map'
        ? ['MapScript.galaxy']
        : libraryUnits.flatMap((unit) => [unit.body, unit.header]);
    const primarySources = await Promise.all(
      primaryPaths.map(async (fileName) => {
        const bytes = Buffer.from(
          await session.readPrimary(context, primary.id, fileName, 64 * 1024 ** 2),
        );
        return { fileName, bytes, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
      }),
    );
    const scriptBytes =
      documentKind === 'map'
        ? primarySources[0].bytes
        : Buffer.from(primarySources.map((source) => source.text).join('\n'));
    const objects = deferred.get('objects');
    if (objects && primarySources[0].text.includes('DoodadFromId'))
      await writeDeferredComponent(
        objects.path,
        await session.readPrimary(context, primary.id, objects.path, 256 * 1024 ** 2),
      );
    // Both readers use the same mounted closure and neither changes it.
    // Drain the reads before disposing it, even if one fails.
    const [declarationRead, dependencyRead] = await Promise.allSettled([
      readTriggerDeclarations(context, { sources: primarySources.map((source) => source.text) }),
      readTriggerDependencies(context),
    ]);
    if (declarationRead.status === 'rejected') throw declarationRead.reason;
    const declarations = declarationRead.value;
    onProgress({ stage: 'Resolving include closure', percent: 16 });
    if (dependencyRead.status === 'rejected') throw dependencyRead.reason;
    const { retained, omitted } = removeEmptyDependencyDocuments(
      dependencyRead.value,
      xmlTree,
      blizzardLibraries?.classifyPreparedDocument.bind(blizzardLibraries),
    );
    const prepared = {
      schema: 1,
      documentKind,
      libraryUnits,
      id: originalSha256.slice(0, 16),
      name: path.basename(original),
      status: 'READY_STANDARD_SOURCE_INPUT',
      original,
      originalSha256,
      archive: original,
      archiveSha256: originalSha256,
      package: pkg,
      originalScriptSha256: sha(scriptBytes),
      ...(selectiveMap ? { selectiveMapInputs: true } : {}),
      cascBuildInfoSha256: beforeBuild,
      sourceKind: publicResources ? 'public-resource-snapshot' : 'installed-casc',
      libraryRoots,
      ...(publicResources
        ? {
            snapshotRevision: '6dd323aae4209a01f110719a00b4e8f7a88389bc',
            snapshotAuthority: 'UNVERIFIED_NOT_INSTALLED_GAME',
            snapshotFilesReverifiedAtPreparation: false,
          }
        : {}),
      actualChain: context.layers,
      omittedEmptyDependencyDocuments: omitted,
      declarationInputs: [],
      dependencyInputs: [],
      includeEvidence: [],
      editorVerified: false,
      ...(sourcePackage ? { sourcePackage } : {}),
    };
    for (const d of declarations)
      prepared.declarationInputs.push(await sourceInput(d.text, d.fileName));
    for (const [i, d] of retained.entries()) {
      const row = {
        group: /NativeLib\.TriggerLib$/iu.test(d.sourcePath) ? 'NativeLib' : 'library-' + i,
        triggerData: await sourceInput(d.triggerData, d.sourcePath),
      };
      for (const [key, name] of [
        ['triggerStrings', 'TriggerStrings.txt'],
        ['gameStrings', 'GameStrings.txt'],
      ])
        if (d[key] !== undefined) row[key] = await sourceInput(d[key], name);
      prepared.dependencyInputs.push(row);
    }
    const sourceKey = (source) => source.fileName.toLowerCase() + '\0' + sha(source.text);
    const pending = [...primarySources, ...declarations].map((source) => ({
      source,
      key: sourceKey(source),
    }));
    const pendingKeys = new Set(pending.map(({ key }) => key));
    const seen = new Set(),
      attributeSources = [],
      declarationKeys = new Set(declarations.map(sourceKey));
    for (let i = 0; i < pending.length; i++) {
      assert(pending.length <= 4096, 'Include closure exceeds source limit');
      const { source, key } = pending[i];
      if (seen.has(key)) continue;
      seen.add(key);
      const ast = parseGalaxySource(source.text, source.fileName);
      if (ast.parseDiagnostics.length) {
        const diagnostics = ast.parseDiagnostics.slice(0, 8).map((d) => {
          const start = d.start ?? 0;
          const prefix = source.text.slice(0, start).split(/\r\n|\r|\n/);
          return {
            file: source.fileName,
            line: prefix.length,
            column: prefix.at(-1).length + 1,
            message: d.messageText,
          };
        });
        await save(path.join(output, 'SOURCE_DIAGNOSTICS.json'), {
          status: 'INVALID_SOURCE_GALAXY',
          total: ast.parseDiagnostics.length,
          diagnostics,
        });
        const first = diagnostics[0];
        throw Error(
          `Invalid source Galaxy: ${first.file}:${first.line}:${first.column}: ${first.message}. ${ast.parseDiagnostics.length} parser diagnostics; see SOURCE_DIAGNOSTICS.json. No triggers were recovered.`,
        );
      }
      attributeSources.push(attributeUseInGalaxy(ast, source.fileName));
      for (const node of ast.statements.filter((n) => n.kind === SyntaxKind.IncludeStatement)) {
        const name = safeComponentPath(node.path.value).replace(/\.galaxy$/iu, '');
        let found;
        for (const candidate of [
          name + '.galaxy',
          name + '_h.galaxy',
          'Base.SC2Data/' + name + '.galaxy',
          'Base.SC2Data/' + name + '_h.galaxy',
        ]) {
          found = await context.locate(candidate);
          if (found) break;
        }
        assert(found, 'Unresolved actual Galaxy include: ' + name);
        prepared.includeEvidence.push({
          from: source.fileName,
          include: name,
          layerId: found.layerId,
          path: found.path,
        });
        const bytes = await context.read(found.layerId, found.path, 64 * 1024 ** 2);
        if (found.layerId === primary.id) await writeDeferredComponent(found.path, bytes);
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        const next = { fileName: found.path, text },
          nextKey = sourceKey(next);
        if (!pendingKeys.has(nextKey)) {
          pendingKeys.add(nextKey);
          pending.push({ source: next, key: nextKey });
        }
        if (!declarationKeys.has(nextKey)) {
          declarationKeys.add(nextKey);
          prepared.declarationInputs.push(await sourceInput(text, found.path));
        }
      }
    }
    const originalAttributesPresent = entries.some(
      (entry) => entry.path.toLowerCase() === 'attributes',
    );
    const attributeCalls = attributeSources.flatMap((item) =>
      item.calls.map((call) => ({ source: item.source, ...call })),
    );
    prepared.attributeUseEvidence = {
      scannedSources: attributeSources.length,
      calls: attributeCalls,
      originalAttributesPresent,
      assumeNoUsedAttributes: !originalAttributesPresent && attributeCalls.length === 0,
      assumptionOnly: true,
      limitations: [
        'Unused lobby definitions cannot be excluded by script inspection',
        'Dynamic or external code and data-driven behavior are not proven',
      ],
    };
    await session.verifyDependencyFiles();
    await verifyComponentSource(sourcePackage);
    assert.equal(await session.installationStamp(), beforeBuild, 'SC2 changed during preparation');
    assert.equal(
      sha(await fs.readFile(original)),
      originalSha256,
      'Original changed during preparation',
    );
    await save(path.join(output, 'config.json'), {
      installation,
      libraryRoots,
      entries,
      ...(publicResources ? { resourceSnapshot: true } : {}),
    });
    const preparationResult = path.join(output, 'preparation.json');
    await save(preparationResult, prepared);
    const row = {
      id: prepared.id,
      documentKind,
      name: prepared.name,
      original,
      originalSha256,
      archive: original,
      archiveSha256: originalSha256,
      package: pkg,
      config: path.join(output, 'config.json'),
      preparationResult,
      preparationResultSha256: sha(await fs.readFile(preparationResult)),
      outputRoot: path.join(output, 'candidates'),
      job: path.join(output, 'candidates', 'recovered'),
      mpq: path.resolve(mpq),
      guiRecoveryMode,
      recoverAttributes,
      ...(attributeIndex === undefined ? {} : { attributeIndex }),
    };
    const jobFile = path.join(output, 'job.json');
    await save(jobFile, row);
    onProgress({ stage: 'Preparation complete', percent: 25 });
    return {
      jobFile,
      originalUnchanged: true,
      entries: entries.length,
      includeEdges: prepared.includeEvidence.length,
    };
  } finally {
    await session.dispose();
  }
}

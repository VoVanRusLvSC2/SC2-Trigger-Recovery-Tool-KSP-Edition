/** Build the worker's hash-bound observation from a real map and installed SC2.
 * The original archive is read-only; unresolved dependencies/includes fail closed. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { MapSession } from '../conversion/partition-declaration-identity/map-session-fixed.mjs';
import { openMpqReader } from '../vendor/@modkit/blizzard-mpq/src/mpq/codec.js';
import { removeEmptyDependencyDocuments } from '../libraries/preparation/empty-dependency-documents.mjs';
import { xmlTree } from '../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
import { parseGalaxySource } from '../conversion/runtime-event-public-alias/galaxy-to-trigger.standard-getter.mjs';
import { SyntaxKind } from '../sdk/core/modules/galaxy/language-core/types.js';
import { attributeUseInGalaxy } from '../verification/attribute-use-evidence.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const save = (file, data) => fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
const require = createRequire(import.meta.url);

export function safeComponentPath(name) {
  const normalized = name.replaceAll('\\', '/');
  assert(
    normalized && !normalized.includes(':') && !/[\x00-\x1f]/u.test(normalized),
    'Unsafe component path',
  );
  assert(
    !normalized.split('/').some((p) => !p || p === '..' || p === '.'),
    'Unsafe component path',
  );
  return normalized;
}

export async function prepareMap({
  original,
  installation,
  resourceSnapshot,
  output,
  mpq,
  guiRecoveryMode = 'preserve-source',
  attributeIndex,
}) {
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
  assert(
    /\.sc2map$/iu.test(original),
    'The archive worker accepts .SC2Map files; use the API for mod libraries',
  );
  assert((await fs.stat(original)).isFile(), 'Expected a packed map file');
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
  const bytes = await fs.readFile(original),
    originalSha256 = sha(bytes);
  const reader = await openMpqReader(bytes, {
    maxArchiveBytes: 1024 ** 3,
    maxEntries: 100000,
    maxEntryBytes: 256 * 1024 ** 2,
  });
  const entries = [],
    names = new Set();
  let total = 0;
  try {
    for (const entry of reader.entries) {
      const name = safeComponentPath(entry.path),
        canonical = name.toLowerCase();
      assert(!names.has(canonical), 'Ambiguous case-insensitive component: ' + name);
      names.add(canonical);
      const payload = Buffer.from(await reader.read(entry.id));
      total += payload.length;
      assert(total <= 4 * 1024 ** 3, 'Expanded map exceeds preparation budget');
      const file = path.join(pkg, ...name.split('/'));
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, payload, { flag: 'wx' });
      entries.push({ path: name, sha256: sha(payload), bytes: payload.length });
    }
  } finally {
    reader.dispose();
  }

  const session = new MapSession({
    installation,
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
    // This adapter path is pinned by the public runtime revision and exercised by
    // the real-archive release smoke, rather than guessed from a newer workspace.
    const workspace = new URL(
      '../workspace/mod-libraries.js',
      pathToFileURL(require.resolve('@modkit/blizzard-starcraft2/triggers/conversion')),
    );
    const { readTriggerDependencies, readTriggerDeclarations } = await import(workspace.href);
    const beforeBuild = await session.installationStamp();
    const context = await session.open({ schemaVersion: 1, target: original });
    const primary = context.layers.at(-1);
    const scriptBytes = Buffer.from(
      await session.readPrimary(context, primary.id, 'MapScript.galaxy', 64 * 1024 ** 2),
    );
    const script = new TextDecoder('utf-8', { fatal: true }).decode(scriptBytes);
    const declarations = await readTriggerDeclarations(context, { sources: [script] });
    const { retained, omitted } = removeEmptyDependencyDocuments(
      await readTriggerDependencies(context),
      xmlTree,
    );
    const prepared = {
      schema: 1,
      id: originalSha256.slice(0, 16),
      name: path.basename(original),
      status: 'READY_STANDARD_SOURCE_INPUT',
      original,
      originalSha256,
      archive: original,
      archiveSha256: originalSha256,
      package: pkg,
      originalScriptSha256: sha(scriptBytes),
      cascBuildInfoSha256: beforeBuild,
      sourceKind: publicResources ? 'public-resource-snapshot' : 'installed-casc',
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
    const pending = [{ fileName: 'MapScript.galaxy', text: script }, ...declarations];
    const seen = new Set(),
      attributeSources = [],
      declarationKeys = new Set(
        declarations.map((d) => d.fileName.toLowerCase() + '\0' + sha(d.text)),
      );
    for (let i = 0; i < pending.length; i++) {
      assert(pending.length <= 4096, 'Include closure exceeds source limit');
      const source = pending[i],
        key = source.fileName.toLowerCase() + '\0' + sha(source.text);
      if (seen.has(key)) continue;
      seen.add(key);
      const ast = parseGalaxySource(source.text, source.fileName);
      assert.equal(
        ast.parseDiagnostics.length,
        0,
        'Cannot establish include closure: ' + source.fileName,
      );
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
        const text = new TextDecoder('utf-8', { fatal: true }).decode(
          await context.read(found.layerId, found.path, 64 * 1024 ** 2),
        );
        const next = { fileName: found.path, text },
          nextKey = next.fileName.toLowerCase() + '\0' + sha(text);
        if (
          !seen.has(nextKey) &&
          !pending.some((d) => d.fileName.toLowerCase() + '\0' + sha(d.text) === nextKey)
        )
          pending.push(next);
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
    assert.equal(await session.installationStamp(), beforeBuild, 'SC2 changed during preparation');
    assert.equal(
      sha(await fs.readFile(original)),
      originalSha256,
      'Original changed during preparation',
    );
    await save(path.join(output, 'config.json'), {
      installation,
      entries,
      ...(publicResources ? { resourceSnapshot: true } : {}),
    });
    const preparationResult = path.join(output, 'preparation.json');
    await save(preparationResult, prepared);
    const row = {
      id: prepared.id,
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
      ...(attributeIndex === undefined ? {} : { attributeIndex }),
    };
    const jobFile = path.join(output, 'job.json');
    await save(jobFile, row);
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

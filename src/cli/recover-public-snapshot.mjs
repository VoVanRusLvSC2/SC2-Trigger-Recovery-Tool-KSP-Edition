/** Explicitly unverified recovery using a public resource snapshot, never CASC authority. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { convertGalaxyToTriggers, createTriggerConversionContext } from '../conversion/index.mjs';
import {
  normalizeTriggerLibrary,
  serializeTriggerLibrary,
} from '../conversion/implicit-gui-localization/trigger-xml.mjs';
import { createUnverifiedPreviewMap } from './unverified-preview-map.mjs';
import { xmlTree } from '../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
import { verifyComponentSource } from './sc2-package.mjs';
import {
  hasMissingDependencies,
  recoverWithMissingDependencies,
} from './recover-incomplete-dependencies.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const writeJson = (file, data) =>
  writeFile(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const checked = async (item) => {
  const bytes = await readFile(item.path);
  assert.equal(sha(bytes), item.sha256, `Prepared source changed: ${item.sourceLabel}`);
  return bytes.toString('utf8');
};

export async function recoverPublicSnapshot(jobFile) {
  const row = await readJson(jobFile);
  assert(
    row.attributeIndex === undefined,
    'Public snapshot mode cannot apply attribute evidence yet',
  );
  assert.equal(
    sha(await readFile(row.preparationResult)),
    row.preparationResultSha256,
    'Preparation changed',
  );
  const prepared = await readJson(row.preparationResult),
    cfg = await readJson(row.config);
  await verifyComponentSource(prepared.sourcePackage);
  assert.equal(prepared.sourceKind, 'public-resource-snapshot', 'Expected public snapshot job');
  assert.equal(cfg.resourceSnapshot, true, 'Expected public snapshot config');
  const manifest = path.join(cfg.installation, 'RESOURCE_MANIFEST.json');
  assert.equal(
    sha(await readFile(manifest)),
    prepared.cascBuildInfoSha256,
    'Snapshot manifest changed',
  );
  assert.equal(sha(await readFile(row.original)), row.originalSha256, 'Original map changed');
  if (hasMissingDependencies(prepared.dependencyWarnings)) {
    await mkdir(row.job, { recursive: true });
    const report = await recoverWithMissingDependencies({ row, prepared, cfg });
    await writeJson(path.join(row.job, 'RESULT.json'), report);
    return report;
  }
  const originalGui = cfg.entries.find(
    (item) => item.path.replaceAll('\\', '/').toLowerCase() === 'triggers',
  );
  assert(
    !originalGui || originalGui.bytes === 0,
    'Existing GUI requires incremental recovery; snapshot preview refuses to rebuild it',
  );
  const scriptBytes = await readFile(path.join(row.package, 'MapScript.galaxy'));
  assert.equal(
    sha(scriptBytes),
    prepared.originalScriptSha256,
    'Extracted Galaxy differs from original',
  );
  const libraries = [];
  for (const dep of prepared.dependencyInputs) {
    const item = {
      sourcePath: dep.triggerData.sourceLabel,
      triggerData: await checked(dep.triggerData),
    };
    for (const key of ['triggerStrings', 'gameStrings'])
      if (dep[key]) item[key] = await checked(dep[key]);
    libraries.push(item);
  }
  const declarations = [];
  for (const item of prepared.declarationInputs)
    declarations.push({ fileName: item.sourceLabel, text: await checked(item) });
  await mkdir(row.outputRoot, { recursive: true });
  await mkdir(row.job); // exclusive: no replacement of an existing result
  const preview = path.join(row.job, 'UNVERIFIED_PREVIEW');
  await mkdir(preview);
  await writeJson(path.join(row.job, 'SOURCE_GUI_INPUT.json'), {
    present: false,
    source: 'public-snapshot-diagnostic',
  });
  const conversionContext = createTriggerConversionContext({
    maxDependencyCacheEntries: 0,
    maxDependencyCacheSourceBytes: 0,
  });
  let triggerData,
    names = [],
    failure,
    lastProgress;
  try {
    const result = await convertGalaxyToTriggers({
      documentKind: 'map',
      libraryId: 'Map',
      script: scriptBytes.toString('utf8'),
      header: '',
      dependencyLibraries: libraries,
      galaxyDeclarations: declarations,
      strictSymbols: true,
      guiRecoveryMode: row.guiRecoveryMode ?? 'preserve-source',
      allowTransparentConditionFunctions: true,
      conversionContext,
      onProgress: (value) => {
        const key = `${value.phase}:${value.stage ?? ''}`;
        if (key !== lastProgress) {
          lastProgress = key;
          console.log(JSON.stringify({ phase: value.phase, stage: value.stage }));
        }
      },
    });
    triggerData = result.output.triggerData;
    const strings = result.output.triggerStrings ?? '';
    names = strings
      .replace(/^\ufeff/u, '')
      .split(/\r?\n/u)
      .filter((line) => line.includes('='));
  } catch (error) {
    failure = { message: error.message, code: error.code ?? null };
    if (error.unverifiedGuiSnapshot) {
      const model = normalizeTriggerLibrary({ ...error.unverifiedGuiSnapshot, implicit: true });
      triggerData = serializeTriggerLibrary(model);
      names = Object.values(model.elements)
        .filter((item) => item.id && item.type && (item.displayName || item.name))
        .map(
          (item) =>
            `${item.type}/Name/${item.id}=${String(item.displayName || item.name).replace(/[\r\n]/gu, ' ')}`,
        )
        .sort();
    }
  } finally {
    conversionContext.clear();
  }
  let map;
  if (triggerData) {
    await writeFile(path.join(preview, 'Triggers'), triggerData, { flag: 'wx' });
    await writeFile(path.join(preview, 'TriggerStrings.txt'), `\ufeff${names.join('\n')}\n`, {
      flag: 'wx',
    });
    try {
      map = await createUnverifiedPreviewMap({ row, preview, triggerData, names });
    } catch (error) {
      failure ??= { message: error.message, code: 'PREVIEW_PACK_FAILED' };
    }
  }
  assert.equal(
    sha(await readFile(row.original)),
    row.originalSha256,
    'Original map changed during recovery',
  );
  assert.equal(
    sha(await readFile(manifest)),
    prepared.cascBuildInfoSha256,
    'Snapshot manifest changed during recovery',
  );
  let guiInventory;
  if (triggerData) {
    guiInventory = { triggers: 0, localNative: 0, customScript: 0, functionScriptCode: 0 };
    const visit = (node) => {
      if (node.tag === 'Element') {
        const type = node.attributes.Type;
        if (type === 'Trigger') guiInventory.triggers++;
        if (type === 'CustomScript') guiInventory.customScript++;
        if (type === 'FunctionDef') {
          if (node.children.some((child) => child.tag === 'FlagNative')) guiInventory.localNative++;
          if (node.children.some((child) => child.tag === 'ScriptCode'))
            guiInventory.functionScriptCode++;
        }
      }
      for (const child of node.children ?? []) visit(child);
    };
    visit(xmlTree(triggerData));
  }
  const report = {
    status: 'UNVERIFIED_PUBLIC_SNAPSHOT',
    guiInventory,
    accepted: false,
    strictBenchmarkPassed: false,
    snapshotFilesReverifiedAtPreparation: false,
    editorVerified: false,
    attributesRecovered: false,
    attributeUseEvidence: prepared.attributeUseEvidence ?? null,
    snapshotRevision: prepared.snapshotRevision,
    sourceArchiveSha256: row.originalSha256,
    previewMap: map,
    guiMarkup: triggerData ? path.join(preview, 'Triggers') : null,
    failure: failure ?? null,
    warning:
      'Public resource version and GUI reconstruction are unverified; GUI may include generated Native or Custom Script. Map uses original Galaxy until Editor recompilation; semantics and attributes are not proven. Do not treat this as an accepted map.',
  };
  await verifyComponentSource(prepared.sourcePackage);
  await writeJson(path.join(row.job, 'RESULT.json'), report);
  await writeJson(path.join(preview, 'PREVIEW_REPORT.json'), report);
  return report;
}

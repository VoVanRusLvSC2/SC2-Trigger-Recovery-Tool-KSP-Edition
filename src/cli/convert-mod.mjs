import { composeGeneratedHeader } from '../conversion/exact-function-signatures/generated-header-composition.mjs';
import { primaryLocalizedTable } from '../libraries/gui/primary-localized-table.mjs';
/** Explicit-library archive worker: no synthetic MapScript or startup wrappers. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  convertGalaxyToTriggers,
  convertTriggersToGalaxy,
  createTriggerConversionContext,
} from '../conversion/index.mjs';
import { openPinnedUserOracle } from '../verification/pinned-user-oracle.mjs';
import { verifyComponentSource, openSc2Package } from './sc2-package.mjs';
import { writePackageCandidate } from './package-candidate.mjs';
import { mergeLibrary, mergeStringTable, assertNoNewRawGui } from './mod-document.mjs';
import { auditNativeCustomScriptLayout } from '../verification/native-custom-script-layout.mjs';
import { readConversionJob } from './job-input.mjs';
import { assertPreparedLibraryRoots } from '../libraries/local-roots.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const save = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
const hash = async (file) => sha(await fs.readFile(file));
const progress = (stage, percent) =>
  console.log(JSON.stringify({ type: 'progress', stage, percent }));
const row = await readConversionJob(process.argv[2]);
const result = { status: 'FAILED', variants: [], editorVerified: false, libraries: [] };
const context = createTriggerConversionContext({
  maxDependencyCacheEntries: 0,
  maxDependencyCacheSourceBytes: 0,
});
let sourceProof;
try {
  await fs.mkdir(row.job, { recursive: true });

  assert.equal(await hash(row.preparationResult), row.preparationResultSha256);
  const prepared = await json(row.preparationResult),
    config = await json(row.config);
  assertPreparedLibraryRoots(config, prepared);
  const snapshot = prepared.sourceKind === 'public-resource-snapshot';
  assert.equal(config.resourceSnapshot === true, snapshot, 'Resource source changed');
  assert(snapshot || prepared.sourceKind === 'installed-casc');
  assert.equal(row.documentKind, prepared.documentKind);
  const map = row.documentKind === 'map';
  assert(row.documentKind === 'mod' || (map && snapshot), 'Unexpected package worker');
  const identity = path.join(
    config.installation,
    snapshot ? 'RESOURCE_MANIFEST.json' : '.build.info',
  );
  const mapHeader =
    map &&
    config.entries.find((entry) => /^(?:Base\.SC2Data\/)?LibMap_h\.galaxy$/i.test(entry.path))
      ?.path;
  const units = map
    ? [{ libraryId: 'Map', body: 'MapScript.galaxy', header: mapHeader }]
    : prepared.libraryUnits;
  const documentKind = map ? 'map' : 'library';
  const mode = map ? 'snapshot-map' : 'mod-libraries';
  result.sourceKind = prepared.sourceKind;
  if (snapshot) {
    assert(
      !row.attributeIndex,
      'Applying external attribute headers requires the Installed-SC2 edition.',
    );
    result.snapshotRevision = prepared.snapshotRevision;
  }
  sourceProof = prepared.sourcePackage;
  await verifyComponentSource(sourceProof);
  assert.equal(await hash(row.original), row.originalSha256);
  assert.equal(await hash(row.archive), row.archiveSha256);
  assert.equal(await hash(identity), prepared.cascBuildInfoSha256);

  const checked = async (item) => {
    const bytes = await fs.readFile(item.path);
    assert.equal(sha(bytes), item.sha256, 'Prepared input changed');
    return bytes.toString('utf8');
  };
  const component = async (name) => {
    if (!name) return '';
    const entry = config.entries.find((entry) => entry.path.toLowerCase() === name.toLowerCase());
    if (!entry) return '';
    const bytes = await fs.readFile(path.join(row.package, ...entry.path.split('/')));
    assert.equal(sha(bytes), entry.sha256, 'Extracted source changed: ' + name);
    return bytes.toString('utf8');
  };
  const dependencies = [];
  for (const input of prepared.dependencyInputs) {
    const library = {
      sourcePath: input.triggerData.sourceLabel,
      triggerData: await checked(input.triggerData),
    };
    for (const field of ['triggerStrings', 'gameStrings'])
      if (input[field]) library[field] = await checked(input[field]);
    dependencies.push(library);
  }
  const declarations = [];
  for (const input of prepared.declarationInputs)
    declarations.push({ fileName: input.sourceLabel, text: await checked(input) });
  const owned = new Set(
    units
      .flatMap((unit) => [unit.body, unit.header].filter(Boolean))
      .map((name) => name.toLowerCase()),
  );
  const external = declarations.filter((input) => !owned.has(input.fileName.toLowerCase()));
  const headers = await Promise.all(
    units
      .filter((unit) => unit.header)
      .map(async (unit) => ({
        fileName: unit.header,
        text: await component(unit.header),
      })),
  );
  const locales = [
    ...new Set(
      config.entries.flatMap(
        (entry) =>
          /^([^/]+\.SC2Data)\/LocalizedData\/(?:TriggerStrings|GameStrings)\.txt$/i.exec(
            entry.path,
          )?.[1] ?? [],
      ),
    ),
  ].filter((name) => name.toLowerCase() !== 'base.sc2data');
  if (!locales.length) locales.push('enUS.SC2Data');
  const tables = await Promise.all(
    locales.map(async (folder) => ({
      locale: folder.slice(0, -8),
      folder,
      triggerStrings: await component(folder + '/LocalizedData/TriggerStrings.txt'),
      gameStrings: await component(folder + '/LocalizedData/GameStrings.txt'),
    })),
  );
  const primary = primaryLocalizedTable(tables);
  result.primaryLocale = primary.locale;
  const originalXml = await component('Triggers');
  let markup = originalXml;
  const options = new Map();
  const oracle = process.env.SC2_TRIGGER_BENCHMARK_ROOT ? await openPinnedUserOracle() : undefined;
  for (const [index, unit] of units.entries()) {
    progress('Recovering library ' + unit.libraryId, 25 + Math.floor((45 * index) / units.length));
    const input = {
      libraryId: unit.libraryId,
      documentKind,
      script: await component(unit.body),
      header: await component(unit.header),
      existingTriggerData: markup || undefined,
      dependencyLibraries: dependencies,
      galaxyDeclarations: [
        ...external,
        ...headers.filter((header) => header.fileName !== unit.header),
      ],
      strictSymbols: true,
      allowTransparentConditionFunctions: map,
      guiRecoveryMode: row.guiRecoveryMode,
      conversionContext: context,
      locale: primary.locale,
      triggerStrings: primary.triggerStrings,
      gameStrings: primary.gameStrings,
      localizedStrings: tables,
      primaryGalaxyIncludeFiles: prepared.includeEvidence
        .filter((edge) => edge.from.toLowerCase() === unit.body.toLowerCase())
        .map((edge) => edge.include + '.galaxy'),
      onProgress: (event) => {
        const phases = [
          'input',
          'dependencies',
          'parse',
          'index',
          'declarations',
          'bodies',
          'initialization',
          'events',
          'finalize',
        ];
        const phase = event.phase === 'reconstruct' ? event.stage : event.phase;
        const at = phases.indexOf(phase);
        if (at < 0) return;
        const fraction =
          event.total > 0 ? Math.max(0, Math.min(1, event.completed / event.total)) : 0;
        progress(
          'Library ' + unit.libraryId + ': ' + phase,
          25 + Math.floor((45 * (index + (at + fraction) / phases.length)) / units.length),
        );
      },
    };
    // The map archive contains the source checkpoint for incremental edits.
    // Re-emission from the final packed GUI is checked independently below.
    if (map && markup)
      input.sourceCheckpoint = {
        xmlSha256: sha(markup),
        stringsSha256: sha(primary.triggerStrings),
        galaxySha256: sha(input.script),
        galaxy: input.script,
      };
    const recovered = await convertGalaxyToTriggers(input);
    const errors = (recovered.diagnostics ?? recovered.fidelity?.diagnostics ?? []).filter(
      (item) => item.severity === 'error',
    );
    assert.equal(errors.length, 0, JSON.stringify(errors.slice(0, 4)));
    assert(recovered.output?.triggerData, 'Library recovery returned no markup');
    markup = map
      ? recovered.output.triggerData
      : mergeLibrary(markup, recovered.output.triggerData, unit.libraryId);
    assertNoNewRawGui(originalXml, markup);
    for (const table of tables) {
      const update = recovered.output.localizedStrings?.find(
        (item) => item.locale === table.locale,
      );
      table.triggerStrings = mergeStringTable(
        table.triggerStrings,
        update?.triggerStrings ?? (table === primary ? recovered.output.triggerStrings : ''),
      );
      table.gameStrings = mergeStringTable(
        table.gameStrings,
        update?.gameStrings ?? (table === primary ? recovered.output.gameStrings : ''),
      );
    }
    options.set(unit.libraryId, {
      ...recovered.output.generationOptions,
      primaryGalaxyIncludeFiles: input.primaryGalaxyIncludeFiles,
    });
    result.libraries.push({
      libraryId: unit.libraryId,
      incremental: recovered.incremental,
      recovered: true,
    });
  }
  const directory = path.join(row.job, mode);
  await fs.mkdir(directory);
  const changes = new Map([['Triggers', Buffer.from(markup)]]);
  for (const table of tables)
    for (const [field, name] of [
      ['triggerStrings', 'TriggerStrings.txt'],
      ['gameStrings', 'GameStrings.txt'],
    ]) {
      const file = table.folder + '/LocalizedData/' + name;
      if (table[field] !== (await component(file))) changes.set(file, Buffer.from(table[field]));
    }
  progress('Packing recovered package', 72);
  const packed = await writePackageCandidate(row, directory, changes, config.entries);
  result.packedCandidate = packed.candidate;
  const reader = await openSc2Package(packed.candidate);
  let allMatched = !!oracle;
  let layoutQualified = false;
  try {
    const text = async (name) => {
      const entry = reader.find(name);
      return entry ? Buffer.from(await reader.read(entry.id)).toString('utf8') : '';
    };
    const actualMarkup = await text('Triggers');
    assert.equal(actualMarkup, markup);
    const actualTables = await Promise.all(
      tables.map(async (table) => ({
        ...table,
        triggerStrings: await text(table.folder + '/LocalizedData/TriggerStrings.txt'),
        gameStrings: await text(table.folder + '/LocalizedData/GameStrings.txt'),
      })),
    );
    const actualPrimary = primaryLocalizedTable(actualTables, primary.locale);
    for (const [index, unit] of units.entries()) {
      progress(
        'Verifying packed library ' + unit.libraryId,
        80 + Math.floor((15 * index) / units.length),
      );
      const forward = await convertTriggersToGalaxy(actualMarkup, {
        ...options.get(unit.libraryId),
        libraryId: unit.libraryId,
        documentKind,
        dependencyLibraries: dependencies,
        galaxyDeclarations: external,
        strictSymbols: true,
        conversionContext: context,
        locale: actualPrimary.locale,
        triggerStrings: actualPrimary.triggerStrings,
        gameStrings: actualPrimary.gameStrings,
        localizedStrings: actualTables,
      });
      const script = await component(unit.body),
        header = await component(unit.header);
      const comparison = map
        ? oracle?.compare(
            composeGeneratedHeader({ script, header, libraryId: unit.libraryId }).text,
            composeGeneratedHeader({ ...forward.output, libraryId: unit.libraryId }).text,
          )
        : oracle?.compare(
            header + '\n' + script,
            forward.output.header + '\n' + forward.output.script,
          );
      const passed = comparison?.syntaxValid === true && comparison.exact === true;
      allMatched &&= passed;
      const proof = {
        libraryId: unit.libraryId,
        passed,
        comparison,
        originalBodySha256: sha(await component(unit.body)),
        generatedBodySha256: sha(forward.output.script),
        editorVerified: false,
      };
      await save(path.join(directory, unit.libraryId + '-STRICT_BENCHMARK.json'), proof);
      result.libraries[index].benchmarkPassed = passed;
    }
    const layout = auditNativeCustomScriptLayout(actualMarkup);
    await save(path.join(directory, 'NATIVE_GUI_LAYOUT.json'), layout);
    layoutQualified = !layout.requiresNativeEvidence;
  } finally {
    reader.dispose();
  }
  if (oracle) await oracle.verify();
  // Mods retain original attributes and runtime files. Missing attribute recovery
  // is not qualified by this package worker and cannot be promoted to PASS.
  const packageSources = new Set(
    config.entries
      .filter((entry) => /\.galaxy$/i.test(entry.path))
      .map((entry) => entry.path.toLowerCase()),
  );
  const attributeQueries =
    prepared.attributeUseEvidence?.calls?.some((call) =>
      packageSources.has(call.source.toLowerCase()),
    ) === true;
  const attributes = {
    status: 'ORIGINAL_COMPONENTS_PRESERVED',
    missingRecoveryQualified: false,
    queriesPresent: attributeQueries,
    recoveryRequested: row.recoverAttributes !== false,
  };
  await save(path.join(directory, 'ATTRIBUTE_SCOPE.json'), attributes);
  await verifyComponentSource(sourceProof);
  assert.equal(await hash(row.original), row.originalSha256);
  assert.equal(await hash(identity), prepared.cascBuildInfoSha256);
  const benchmark = {
    enabled: !!oracle,
    passed: allMatched,
    manifestSha256: oracle?.manifestSha256,
    assets: oracle?.assets,
  };
  await save(path.join(directory, 'STRICT_BENCHMARK.json'), {
    ...benchmark,
    libraries: result.libraries,
  });
  result.status = 'GENERATED';
  result.originalUnchanged = true;
  result.variants.push({
    mode,
    status:
      !snapshot && allMatched && layoutQualified && !attributeQueries
        ? 'PASS_OFFLINE_EDITOR_PENDING'
        : 'REVIEW_REQUIRED_EDITOR_PENDING',
    reviewReasons: [
      snapshot && 'PUBLIC_SNAPSHOT_EDITOR_VERSION_UNKNOWN',
      !oracle && 'STRICT_BENCHMARK_NOT_ENABLED',
      oracle && !allMatched && 'STRICT_BENCHMARK_MISMATCH',
      !layoutQualified && 'GUI_TEXT_LAYOUT_REQUIRES_EDITOR',
      attributeQueries &&
        (map
          ? 'SNAPSHOT_ATTRIBUTE_RECOVERY_NOT_QUALIFIED'
          : 'MOD_ATTRIBUTE_RECOVERY_NOT_QUALIFIED'),
    ].filter(Boolean),
    candidate: packed.candidate,
    benchmark,
    attributes,
    ...packed,
  });
  progress('Finalizing recovery evidence', 98);
} catch (error) {
  if (error.declarationDelta)
    await save(path.join(row.job, 'DECLARATION_DIFF.json'), error.declarationDelta);
  process.exitCode = 1;
  result.error = String(error.stack ?? error);
  console.error(result.error);
} finally {
  context.clear();
  result.finished = new Date().toISOString();
  await save(path.join(row.job, 'RESULT.json'), result);
  console.log(
    JSON.stringify({
      status: result.status,
      error: result.error?.split('\n')[0],
      variants: result.variants.map((variant) => ({ status: variant.status })),
    }),
  );
}

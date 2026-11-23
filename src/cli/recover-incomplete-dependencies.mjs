import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { convertGalaxyToTriggers, createTriggerConversionContext } from '../conversion/index.mjs';
import {
  normalizeTriggerLibrary,
  serializeTriggerLibrary,
} from '../conversion/implicit-gui-localization/trigger-xml.mjs';
import { primaryLocalizedTable } from '../libraries/gui/primary-localized-table.mjs';
import { xmlTree } from '../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
import { mergeStringTable } from './mod-document.mjs';
import { writeTriggerDraft } from './package-candidate.mjs';
import { verifyPublishedFiles } from './published-dependencies.mjs';
import { verifyComponentSource } from './sc2-package.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const progress = (stage, percent) =>
  console.log(JSON.stringify({ type: 'progress', stage, percent }));
export const hasMissingDependencies = (warnings) =>
  !!(warnings?.packages.length || warnings?.includes.length);
export function onlyExplicitLibraries(markup) {
  if (!markup.trim()) return false;
  const root = xmlTree(markup);
  return (
    root.tag === 'TriggerData' &&
    root.children.length > 0 &&
    root.children.every(
      (node) => node.tag === 'Library' && node.attributes.Id && node.attributes.Id !== 'Map',
    )
  );
}
const includeKey = (name) =>
  name
    .replaceAll('\\', '/')
    .replace(/\.galaxy$/iu, '')
    .toLowerCase();

// Keep the original Galaxy in the MPQ. The temporary parser view drops only
// known missing includes so the rest of the script can still be analyzed.
export function omitMissingIncludes(text, file, warnings) {
  const missing = new Set(
    warnings.includes
      .filter(({ from }) => includeKey(from) === includeKey(file))
      .map(({ include }) => includeKey(include)),
  );
  if (!missing.size) return text;
  return text.replace(/^[^\S\r\n]*include\s+"([^"\r\n]+)"[^\S\r\n]*;?/gimu, (line, name) =>
    missing.has(includeKey(name)) ? line.replace(/[^\t \r\n]/gu, ' ') : line,
  );
}

export async function recoverWithMissingDependencies({ row, prepared, cfg, fallback }) {
  const warnings = prepared.dependencyWarnings;
  assert(fallback || hasMissingDependencies(warnings));
  const identity = path.resolve(
    path.dirname(row.config),
    cfg.installation,
    cfg.resourceSnapshot ? 'RESOURCE_MANIFEST.json' : '.build.info',
  );
  const verify = async () => {
    assert.equal(sha(await readFile(row.original)), row.originalSha256, 'Original archive changed');
    assert.equal(sha(await readFile(row.archive)), row.archiveSha256, 'Prepared archive changed');
    assert.equal(
      sha(await readFile(identity)),
      prepared.cascBuildInfoSha256,
      'SC2 resources changed',
    );
    await verifyPublishedFiles(warnings.substitutions);
    await verifyComponentSource(prepared.sourcePackage);
  };
  await verify();
  const checked = async (item) => {
    const bytes = await readFile(item.path);
    assert.equal(sha(bytes), item.sha256, 'Prepared dependency changed: ' + item.path);
    return bytes.toString('utf8');
  };
  const component = async (name) => {
    const entry = cfg.entries.find(({ path: file }) => file.toLowerCase() === name.toLowerCase());
    if (!entry?.sha256) return '';
    return checked({ ...entry, path: path.join(row.package, ...entry.path.split('/')) });
  };
  const script = await component('MapScript.galaxy');
  assert.equal(sha(script), prepared.originalScriptSha256, 'Prepared Galaxy changed');
  const originalGui = await component('Triggers');
  const backupAuthoredGui = () =>
    writeFile(path.join(row.job, 'ORIGINAL_AUTHORED_TRIGGERS.xml'), originalGui, { flag: 'wx' });
  if (!fallback && onlyExplicitLibraries(originalGui))
    fallback = {
      kind: 'AUTHORED_MAP_SCOPE_MISSING',
      message:
        'The original GUI only has explicit libraries. The draft uses the available Galaxy and the authored GUI is saved separately.',
    };
  if (fallback && originalGui.trim()) await backupAuthoredGui();
  const header = await component('LibMap_h.galaxy');
  const tables = new Map();
  for (const { path: filename } of cfg.entries) {
    const match = /^([a-z]{4})\.SC2Data\/LocalizedData\/(Trigger|Game)Strings\.txt$/iu.exec(
      filename,
    );
    if (!match) continue;
    const [, locale, type] = match;
    const table = tables.get(locale) ?? { locale };
    table[type.toLowerCase() + 'Strings'] = await component(filename);
    tables.set(locale, table);
  }
  if (!tables.size) tables.set('enUS', { locale: 'enUS' });
  const localized = [...tables.values()];
  const primary = primaryLocalizedTable(localized);
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
  for (const item of prepared.declarationInputs) {
    const fileName = item.sourceLabel;
    declarations.push({
      fileName,
      text: omitMissingIncludes(await checked(item), fileName, warnings),
    });
  }
  const context = createTriggerConversionContext();
  const recover = (useAuthoredGui) =>
    convertGalaxyToTriggers({
      documentKind: 'map',
      libraryId: 'Map',
      guiRecoveryMode: 'preserve-source',
      ...(useAuthoredGui ? { existingTriggerData: originalGui } : {}),
      script: omitMissingIncludes(script, 'MapScript.galaxy', warnings),
      header: omitMissingIncludes(header, 'LibMap_h.galaxy', warnings),
      dependencyLibraries: libraries,
      galaxyDeclarations: declarations,
      strictSymbols: false,
      locale: primary.locale,
      localizedStrings: localized,
      triggerStrings: primary.triggerStrings,
      gameStrings: primary.gameStrings,
      conversionContext: context,
    });
  let markup, output, diagnostics, failure, origin;
  try {
    progress('Recovering with available dependencies', 35);
    const useAuthoredGui = !fallback && !!originalGui.trim();
    let response;
    try {
      response = await recover(useAuthoredGui);
    } catch (error) {
      if (!useAuthoredGui || error.context?.conversionCode !== 'UNRESOLVED_REFERENCE') throw error;
      const reference = error.context.reference;
      fallback = {
        kind: 'AUTHORED_DEPENDENCY_REFERENCE_MISSING',
        reference,
        message: `The authored GUI refers to unavailable ${reference?.library ?? ''}:${reference?.id ?? ''}. The draft uses the available Galaxy and the authored GUI is saved separately.`,
      };
      await backupAuthoredGui();
      response = await recover(false);
    }
    output = response.output;
    markup = output?.triggerData;
    diagnostics = response.diagnostics ?? response.fidelity?.diagnostics;
    origin = markup ? 'available-dependencies' : undefined;
  } catch (error) {
    failure = { message: error.message, code: error.context?.conversionCode ?? error.code };
    if ((fallback || !originalGui.trim()) && error.unverifiedGuiSnapshot) {
      markup = serializeTriggerLibrary(
        normalizeTriggerLibrary({
          ...error.unverifiedGuiSnapshot,
          implicit: true,
        }),
      );
      origin = 'diagnostic-reconstruction';
    }
  } finally {
    context.clear();
  }
  if (!markup && originalGui.trim()) {
    markup = originalGui;
    origin = 'original-authored';
  }

  let packedCandidate, draftPackingError, triggerCount;
  if (markup) {
    const root = xmlTree(markup);
    assert.equal(root.tag, 'TriggerData');
    const countTriggers = (node) =>
      Number(node.tag === 'Element' && node.attributes.Type === 'Trigger') +
      node.children.reduce((count, child) => count + countTriggers(child), 0);
    triggerCount = countTriggers(root);
    await writeFile(path.join(row.job, 'Triggers'), markup, { flag: 'wx' });
    progress('Packing draft and preserving original map files', 75);
    try {
      const updatedStrings = localized.flatMap((table) => {
        const update = output?.localizedStrings?.find(({ locale }) => locale === table.locale);
        const text = mergeStringTable(
          table.triggerStrings ?? '',
          update?.triggerStrings ?? (table.locale === primary.locale ? output?.triggerStrings : ''),
        );
        return text === (table.triggerStrings ?? '')
          ? []
          : [
              {
                path: table.locale + '.SC2Data/LocalizedData/TriggerStrings.txt',
                text,
              },
            ];
      });
      const draft = await writeTriggerDraft(
        row,
        path.join(row.job, 'DRAFT'),
        markup,
        updatedStrings,
      );
      packedCandidate = draft.candidate;
      await writeFile(
        path.join(row.job, 'DRAFT', 'PACKAGE_VERIFICATION.json'),
        JSON.stringify(draft.verification, null, 2) + '\n',
        { flag: 'wx' },
      );
    } catch (error) {
      draftPackingError = error.message;
    }
  }
  await verify();
  process.exitCode = markup ? 0 : 1;
  return {
    status: markup ? 'PARTIAL_DEPENDENCY_RECOVERY' : 'FAILED',
    originalUnchanged: true,
    dependencyWarnings: warnings,
    draftTriggerSource: origin,
    triggerCount,
    packedCandidate,
    draftPackingError,
    diagnostics,
    fallback,
    recoveryFailure: failure,
    ...(markup ? {} : { error: failure?.message ?? 'No editable triggers could be recovered' }),
    staticEquivalent: false,
    editorVerified: false,
    warning:
      fallback && origin === 'original-authored'
        ? 'The original GUI was preserved in the draft because reconstruction could not be completed. See the dependency warnings.'
        : (fallback?.message ??
          'Some dependencies are unavailable. Inspect the draft and its warnings before using it.'),
  };
}

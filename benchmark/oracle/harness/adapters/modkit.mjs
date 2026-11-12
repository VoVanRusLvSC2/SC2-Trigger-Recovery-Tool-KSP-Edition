import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { guiLibrarySignature } from '../src/gui-signature.mjs';

const request = JSON.parse(await readFile(process.argv[2], 'utf8'));
const moduleSpec = process.env.MODKIT_CONVERSION_MODULE;
if (!moduleSpec) throw new Error('MODKIT_CONVERSION_MODULE must name the public ModKit conversion module');
const moduleUrl = moduleSpec.startsWith('file:')
  ? moduleSpec
  : /[\\/]/u.test(moduleSpec)
    ? pathToFileURL(path.resolve(process.cwd(), moduleSpec)).href
    : moduleSpec;
const publicApi = await import(moduleUrl);
const { convertGalaxyToTriggers, convertTriggersToGalaxy } = publicApi;
if (typeof convertGalaxyToTriggers !== 'function' || typeof convertTriggersToGalaxy !== 'function') {
  throw new TypeError('ModKit module does not export both conversion directions');
}
let parseGalaxySource = publicApi.parseGalaxySource;
if (typeof parseGalaxySource !== 'function' && moduleUrl.startsWith('file:')) {
  try {
    ({ parseGalaxySource } = await import(new URL('./internal/galaxy-to-trigger.js', moduleUrl)));
  } catch {}
}
const compareGalaxyPrograms = typeof publicApi.compareGalaxyPrograms === 'function' && typeof parseGalaxySource === 'function'
  ? (expected, actual, options) => publicApi.compareGalaxyPrograms(
      parseGalaxySource(expected, 'benchmark-expected.galaxy'),
      parseGalaxySource(actual, 'benchmark-actual.galaxy'),
      options,
    )
  : null;
let triggerDocumentApi = null;
if (moduleUrl.startsWith('file:')) {
  try { triggerDocumentApi = await import(new URL('../../shared/trigger-document/index.js', moduleUrl)); }
  catch {}
}

/** SC2 install that supplies NativeLib and the stock libraries: explicit env first, then common locations. */
function sc2ContentRoot() {
  const candidates = [process.env.MODKIT_SC2_CONTENT_ROOT, process.env.MODKIT_SC2_ROOT,
    'C:/Program Files (x86)/StarCraft II', 'C:/Apps/StarCraft II'];
  return candidates.find(candidate => candidate && existsSync(path.join(candidate, '.build.info')));
}

/**
 * The dependency libraries and Galaxy declarations of a mod chain, read through ModKit's one mod
 * loader. MODKIT_SC2_CONTENT_ROOT names a CASC-like folder holding `mods/core.sc2mod` and the
 * rest; MODKIT_SC2_BASE_MOD picks the chain inside it, Void by default. Without the variable the
 * adapter falls back to the NativeLib bundled beside the module.
 */
/**
 * The mod loader of the ModKit build the conversion module belongs to. A conversion module outside a
 * ModKit build (the harness's own test fixtures) has none. An explicit loader module must exist.
 */
function modkitLoaderUrls() {
  if (!moduleUrl.startsWith('file:')) return null;
  const loaderModuleUrl = process.env.MODKIT_SC2_LOADER_MODULE
    ? pathToFileURL(path.resolve(process.cwd(), process.env.MODKIT_SC2_LOADER_MODULE)).href
    : moduleUrl;
  const urls = [
    new URL('../../../game/battlenet/content-sources/local-content-sources.js', loaderModuleUrl),
    new URL('../workspace/mod-libraries.js', loaderModuleUrl),
  ];
  if (urls.every(url => existsSync(fileURLToPath(url)))) return urls;
  if (process.env.MODKIT_SC2_LOADER_MODULE) throw new Error(`MODKIT_SC2_LOADER_MODULE has no mod loader beside it: ${urls.map(String).join(', ')}`);
  return null;
}
const loaderUrls = modkitLoaderUrls();

async function chainDependencies(sources) {
  const contentRoot = sc2ContentRoot();
  if (!contentRoot || !loaderUrls) return null;
  const [{ Sc2DesktopContentSources }, { readTriggerDeclarations, readTriggerDependencies }] = await Promise.all(loaderUrls.map(url => import(url)));
  const contentSources = new Sc2DesktopContentSources({ installationDirectory: contentRoot });
  // The case's own package is the subject: opening it lets the loader resolve the chain the
  // package declares, exactly as the editor does. Only a case without one falls back to a base mod.
  const subject = request.inputs.find(input => input.role === 'package')?.path;
  const baseMod = path.resolve(contentRoot, process.env.MODKIT_SC2_BASE_MOD ?? 'mods/void.sc2mod');
  // A rooted .SC2Map resolves its declared package chain and ignores baseMods.
  // Open the requested base separately, then merge its libraries and headers
  // with the subject's chain. This also works for stripped benchmark packages
  // that contain Galaxy but no DocumentInfo dependencies.
  const targets = subject === undefined ? [baseMod]
    : process.env.MODKIT_SC2_BASE_MOD ? [baseMod, path.resolve(subject)] : [path.resolve(subject)];
  const opened = [];
  try {
    for (const target of targets) opened.push(await contentSources.openModContext({ schemaVersion: 1, target, baseMods: [baseMod] }));
    const libraries = [];
    const seenLibraries = new Set();
    const declarations = [];
    const seenDeclarations = new Set();
    // A mod converts one of its libraries; the others of its Triggers are dependencies of it, handed over
    // marked as the same document so the converter leaves out the library it reconstructs.
    // Trimmed: `set VAR=1 && …` in cmd leaves a trailing space, and the WMI-launched runs of 28.09 lost the flag.
    const ownLibraries = process.env.MODKIT_ADAPTER_OWN_LIBRARIES?.trim() === '1' && request.documentKind === 'mod';
    for (const context of opened) {
      for (const library of await readTriggerDependencies(context, { ownLibraries })) {
        // The primary Triggers document is already supplied to the converter.
        // Do not load it again as a dependency, including multi-library XML,
        // unless it comes as the same document (above).
        if (!library.sameDocument && library.sourcePath === 'Triggers' && [textByRole.get('trigger-data'), textByRole.get('original-trigger-data'), expectedByRole.get('expected-trigger-data')].includes(library.triggerData)) continue;
        const hash = createHash('sha256').update(library.triggerData).digest('hex');
        if (seenLibraries.has(hash)) continue;
        seenLibraries.add(hash);
        libraries.push(library);
      }
      for (const declaration of await readTriggerDeclarations(context, { sources })) {
        const key = `${declaration.fileName}\0${declaration.text}`;
        if (seenDeclarations.has(key)) continue;
        seenDeclarations.add(key);
        declarations.push(declaration);
      }
    }
    return {
      libraries,
      declarations,
      chain: [...new Set(opened.flatMap(context => context.layers.map(layer => layer.sourcePath)))],
      sources: libraries.map(library => ({
        file: library.sourcePath,
        sha256: createHash('sha256').update(library.triggerData).digest('hex'),
      })),
    };
  } finally {
    for (const context of opened) await context.dispose();
    await contentSources.dispose();
  }
}

async function bundledDependencies() {
  if (!moduleUrl.startsWith('file:')) return null;
  const triggerDataUrl = new URL('../../../../../assets/sc2-data-triggers/mods/core.sc2mod/base.sc2data/TriggerLibs/NativeLib.TriggerLib', moduleUrl);
  let triggerData;
  try { triggerData = await readFile(triggerDataUrl, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const triggerStringsUrl = new URL('../../../../../assets/sc2-data-triggers/mods/core.sc2mod/enus.sc2data/LocalizedData/TriggerStrings.txt', moduleUrl);
  let triggerStrings;
  try { triggerStrings = await readFile(triggerStringsUrl, 'utf8'); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const sources = [{
    file: 'NativeLib.TriggerLib',
    sha256: createHash('sha256').update(triggerData).digest('hex'),
  }];
  if (triggerStrings !== undefined) sources.push({
    file: 'TriggerStrings.txt',
    sha256: createHash('sha256').update(triggerStrings).digest('hex'),
  });
  return {
    libraries: [{ triggerData, ...(triggerStrings !== undefined ? { triggerStrings } : {}) }],
    sources,
  };
}

function inspectTriggerDataCounts(triggerData) {
  const typeCounts = {};
  for (const [, , type] of triggerData.matchAll(/<Element\b[^>]*\bType\s*=\s*(['"])([^'"]+)\1[^>]*>/giu)) {
    typeCounts[type] = (typeCounts[type] ?? 0) + 1;
  }
  return {
    status: 'parsed-elements',
    elementCount: Object.values(typeCounts).reduce((total, count) => total + count, 0),
    typeCounts,
    guiTriggerCount: typeCounts.Trigger ?? 0,
    customScriptTagCount: [...triggerData.matchAll(/<ScriptCode(?:\s[^>]*)?>[\s\S]*?<\/ScriptCode\s*>/giu)].length,
    triggerLocalVariableCount: null,
  };
}

async function inspectTriggerData(triggerData, triggerStrings) {
  if (typeof triggerData !== 'string') return { status: 'unavailable' };
  if (typeof triggerDocumentApi?.readTriggerLibraryFast !== 'function') return inspectTriggerDataCounts(triggerData);
  // A map that defines libraries of its own keeps them in <Library> blocks beside its own content, and
  // the reader returns one library: count the whole document instead.
  if (request.documentKind === 'map' && /<Library\s/u.test(triggerData)) return inspectTriggerDataCounts(triggerData);
  try {
    const parsed = await triggerDocumentApi.readTriggerLibraryFast(triggerData, triggerStrings);
    const library = parsed.library;
    const elements = Object.values(library?.elements ?? {});
    const typeCounts = triggerDocumentApi.triggerLibraryTypeCounts?.(library)
      ?? elements.reduce((counts, element) => {
        counts[element.type] = (counts[element.type] ?? 0) + 1;
        return counts;
      }, {});
    const localVariableIds = new Set();
    for (const element of elements) {
      if (element.type === 'Trigger' || element.type === 'FunctionDef') {
        for (const ref of element.localVariables ?? []) localVariableIds.add(ref.id);
      }
    }
    return {
      status: 'parsed',
      elementCount: elements.length,
      typeCounts,
      semanticHash: guiLibrarySignature(library),
      guiTriggerCount: typeCounts.Trigger ?? 0,
      customScriptTagCount: elements.filter(element => typeof element.scriptCode === 'string' && element.scriptCode.length > 0).length,
      triggerLocalVariableCount: localVariableIds.size,
    };
  } catch (error) {
    if (String(error).includes('No libraries found in trigger XML')) return inspectTriggerDataCounts(triggerData);
    return { status: 'invalid', error: String(error) };
  }
}

function compareGuiFidelity(expected, actual) {
  if (expected.status.startsWith('invalid') || actual.status.startsWith('invalid')
      || expected.status === 'unavailable' || actual.status === 'unavailable') {
    return { status: 'inconclusive', expectedStatus: expected.status, actualStatus: actual.status };
  }
  const nonSemantic = new Set(['Category', 'Param', 'ParamDef']);
  const types = new Set([...Object.keys(expected.typeCounts ?? {}), ...Object.keys(actual.typeCounts ?? {})]);
  const typeDifferences = Object.fromEntries([...types].sort().flatMap(type => {
    if (nonSemantic.has(type)) return [];
    const before = expected.typeCounts?.[type] ?? 0;
    const after = actual.typeCounts?.[type] ?? 0;
    return before === after ? [] : [[type, { expected: before, actual: after }]];
  }));
  const differences = {
    ...(Object.keys(typeDifferences).length ? { typeCounts: typeDifferences } : {}),
    ...(expected.customScriptTagCount !== actual.customScriptTagCount
      ? { customScriptTagCount: { expected: expected.customScriptTagCount, actual: actual.customScriptTagCount } }
      : {}),
    ...(Number.isFinite(expected.triggerLocalVariableCount) && Number.isFinite(actual.triggerLocalVariableCount)
      && expected.triggerLocalVariableCount !== actual.triggerLocalVariableCount
      ? { triggerLocalVariableCount: { expected: expected.triggerLocalVariableCount, actual: actual.triggerLocalVariableCount } }
      : {}),
  };
  const metrics = {
    typeCounts: expected.typeCounts,
    customScriptTagCount: expected.customScriptTagCount,
    triggerLocalVariableCount: expected.triggerLocalVariableCount,
    semanticHash: expected.semanticHash,
  };
  const actualMetrics = {
    typeCounts: actual.typeCounts,
    customScriptTagCount: actual.customScriptTagCount,
    triggerLocalVariableCount: actual.triggerLocalVariableCount,
    semanticHash: actual.semanticHash,
  };
  if (!expected.semanticHash || !actual.semanticHash) {
    return {
      status: Object.keys(differences).length === 0 ? 'inconclusive' : 'different',
      reason: 'semantic-trigger-structure-unavailable',
      differences,
      expected: metrics,
      actual: actualMetrics,
    };
  }
  if (expected.semanticHash !== actual.semanticHash) {
    differences.semanticStructure = { expectedHash: expected.semanticHash, actualHash: actual.semanticHash };
  }
  return {
    status: Object.keys(differences).length === 0 ? 'equivalent-structure' : 'different',
    differences,
    expected: metrics,
    actual: actualMetrics,
  };
}

function phaseTimings(events, finishedAt) {
  const timings = {};
  for (let index = 0; index < events.length; index += 1) {
    const current = events[index];
    const next = events[index + 1]?.at ?? finishedAt;
    timings[current.phase] = (timings[current.phase] ?? 0) + Math.max(0, next - current.at);
  }
  return timings;
}

const textByRole = new Map();
const expectedByRole = new Map();
const declarations = [];
// Other Galaxy files of the document; the converter turns them into triggers only with the case
// option convertAdditionalScripts (off by default).
const additionalScripts = [];
const dependencies = new Map();
for (const [index, input] of request.inputs.entries()) {
  if (input.role === 'package') continue;
  const text = await readFile(input.path, 'utf8');
  if (input.role === 'galaxy-declaration') {
    declarations.push({ fileName: path.basename(input.path), text });
    continue;
  }
  if (input.role === 'additional-script') {
    additionalScripts.push({ fileName: path.basename(input.path), text });
    continue;
  }
  if (input.role.startsWith('dependency-')) {
    const group = input.group ?? `dependency-${index}`;
    const dependency = dependencies.get(group) ?? {};
    const field = {
      'dependency-trigger-data': 'triggerData',
      'dependency-trigger-strings': 'triggerStrings',
      'dependency-game-strings': 'gameStrings',
    }[input.role];
    if (!field) throw new TypeError(`unsupported ModKit input role: ${input.role}`);
    dependency[field] = text;
    dependencies.set(group, dependency);
    continue;
  }
  if (input.role.startsWith('expected-')) {
    expectedByRole.set(input.role, text);
    continue;
  }
  if (!['script', 'header', 'trigger-strings', 'game-strings', 'trigger-data', 'original-trigger-data'].includes(input.role)) {
    throw new TypeError(`unsupported ModKit input role: ${input.role}`);
  }
  if (textByRole.has(input.role)) throw new TypeError(`duplicate ModKit input role: ${input.role}`);
  textByRole.set(input.role, text);
}
// Every locale of the case's package: the converter reads names and texts from all of them and writes
// each back. The trigger-strings input names the primary locale.
const localeOf = name => /^([a-z]{2})([a-z]{2})\.sc2data$/iu.exec(name)?.slice(1).map((part, at) => at ? part.toUpperCase() : part.toLowerCase()).join('');
const packagePath = request.inputs.find(input => input.role === 'package')?.path;
const localizedStrings = [];
if (packagePath && (await stat(packagePath).catch(() => undefined))?.isDirectory()) {
  for (const entry of await readdir(packagePath, { withFileTypes: true })) {
    const locale = entry.isDirectory() ? localeOf(entry.name) : undefined;
    if (!locale) continue;
    const text = async file => readFile(path.join(packagePath, entry.name, 'LocalizedData', file), 'utf8').catch(() => undefined);
    const [triggerStrings, gameStrings] = await Promise.all([text('TriggerStrings.txt'), text('GameStrings.txt')]);
    if (triggerStrings !== undefined || gameStrings !== undefined) {
      localizedStrings.push({ locale, ...(triggerStrings !== undefined ? { triggerStrings } : {}), ...(gameStrings !== undefined ? { gameStrings } : {}) });
    }
  }
  localizedStrings.sort((left, right) => left.locale.localeCompare(right.locale));
}
// The map's generated AI scripts (ai<Id>.galaxy): the converter reads the Custom AI document back from
// them and the script instead of turning that code into triggers.
const customAiScripts = [];
if (packagePath && (await stat(packagePath).catch(() => undefined))?.isDirectory()) {
  for (const entry of await readdir(packagePath, { withFileTypes: true })) {
    if (entry.isFile() && /^ai[0-9A-F]{8}\.galaxy$/iu.test(entry.name)) {
      customAiScripts.push({ fileName: entry.name, text: await readFile(path.join(packagePath, entry.name), 'utf8') });
    }
  }
  customAiScripts.sort((left, right) => left.fileName.localeCompare(right.fileName));
}
const primaryLocale = localeOf(path.basename(path.dirname(path.dirname(request.inputs.find(input => input.role === 'trigger-strings')?.path ?? '')))) ?? 'enUS';
const localeOptions = localizedStrings.length > 1 ? { locale: primaryLocale, localizedStrings } : {};
const operation = request.operation ?? 'galaxy-to-triggers';
const roundtrip = operation === 'galaxy-triggers-roundtrip';
if (['galaxy-to-triggers', 'galaxy-triggers-roundtrip'].includes(operation) && !textByRole.has('script')) {
  throw new TypeError('Galaxy conversion requires one script input');
}
if (operation === 'triggers-to-galaxy' && !textByRole.has('trigger-data')) throw new TypeError('ModKit forward conversion requires one TriggerData input');
if (!['galaxy-to-triggers', 'triggers-to-galaxy', 'galaxy-triggers-roundtrip'].includes(operation)) throw new TypeError(`unsupported ModKit operation: ${operation}`);
const hasExplicitNativeLibrary = [...dependencies.keys()].some(group => ['nativelib', 'ntve'].includes(group.toLowerCase()));
// MODKIT_ADAPTER_SELF_CHECK=0: the harness recomputes every comparison with its shared oracle after
// the process exits, so skipping them here keeps oracle work out of the converter's time and memory.
const selfCheck = process.env.MODKIT_ADAPTER_SELF_CHECK !== '0';
// performance.now() counts from process start: Node startup, module imports and input reads.
const dependencyLoadStarted = performance.now();
const startupMs = dependencyLoadStarted;
const chain = hasExplicitNativeLibrary ? null : await chainDependencies(
  [textByRole.get('script') ?? expectedByRole.get('expected-script'),
    textByRole.get('header') ?? expectedByRole.get('expected-header')].filter(text => typeof text === 'string'),
);
const bundled = chain ?? (hasExplicitNativeLibrary ? null : await bundledDependencies());
const dependencyLoadMs = performance.now() - dependencyLoadStarted;
// A real ModKit build without NativeLib would silently turn every native call into CustomScript.
if (loaderUrls && !chain && !bundled && !hasExplicitNativeLibrary) {
  throw new Error('No NativeLib source: set MODKIT_SC2_CONTENT_ROOT to a StarCraft II install, or pass an explicit NativeLib dependency. Without it every native call becomes CustomScript.');
}
const dependencyLibraries = [...(bundled?.libraries ?? []), ...dependencies.values()];
declarations.push(...(chain?.declarations ?? []));
if (dependencyLibraries.some(dependency => typeof dependency.triggerData !== 'string')) {
  throw new TypeError('every dependency group needs dependency-trigger-data');
}

const started = performance.now();
const commonOptions = {
  ...request.options,
  documentKind: request.documentKind === 'mod' ? 'library' : request.documentKind,
  triggerStrings: textByRole.get('trigger-strings'),
  gameStrings: textByRole.get('game-strings'),
  galaxyDeclarations: declarations,
  dependencyLibraries,
  ...localeOptions,
  ...(additionalScripts.length ? { additionalScripts } : {}),
  ...(customAiScripts.length ? { customAiScripts } : {}),
};
let converted;
let forward;
let reverse;
let originalConversion;
let roundtripConversion;
let stageTimes;
let stagePhases;
if (roundtrip) {
  if (/<Element\b/iu.test(textByRole.get('original-trigger-data') ?? '')) {
    const originalStarted = performance.now();
    try {
      const original = await convertTriggersToGalaxy(textByRole.get('original-trigger-data'), commonOptions);
      originalConversion = {
        status: 'completed',
        wallTimeMs: performance.now() - originalStarted,
        script: original.output?.script,
        header: original.output?.header,
        fidelity: original.fidelity,
      };
      if (typeof originalConversion.script !== 'string') throw new TypeError('ModKit returned no Galaxy script from original Triggers');
    } catch (error) {
      originalConversion = { status: 'failed', wallTimeMs: performance.now() - originalStarted, error: String(error) };
    }
  }
  try {
  const forwardProgress = [];
  const forwardStarted = performance.now();
  forward = await convertGalaxyToTriggers({
      ...commonOptions,
      onProgress: event => forwardProgress.push({ phase: event.phase, at: performance.now() }),
      script: textByRole.get('script'),
      header: textByRole.get('header') ?? '',
    });
  const forwardFinished = performance.now();
  const forwardMs = forwardFinished - forwardStarted;
  if (typeof forward?.output?.triggerData !== 'string') throw new TypeError('ModKit returned no TriggerData for roundtrip');
  // Keep the first stage inspectable when regeneration fails.
  await mkdir(request.outputDirectory, { recursive: true });
  await writeFile(path.join(request.outputDirectory, 'Triggers'), forward.output.triggerData);
  const reverseProgress = [];
  const reverseStarted = performance.now();
  reverse = await convertTriggersToGalaxy(forward.output.triggerData, {
    ...commonOptions,
    ...forward.output.generationOptions,
    onProgress: event => reverseProgress.push({ phase: event.phase, at: performance.now() }),
    triggerStrings: forward.output.triggerStrings ?? commonOptions.triggerStrings,
    gameStrings: forward.output.gameStrings ?? commonOptions.gameStrings,
    ...(forward.output.customAi ? { customAi: forward.output.customAi } : {}),
  });
  const reverseFinished = performance.now();
  const reverseMs = reverseFinished - reverseStarted;
  stagePhases = {
    galaxyToTriggers: phaseTimings(forwardProgress, forwardFinished),
    triggersToGalaxy: phaseTimings(reverseProgress, reverseFinished),
  };
  if (typeof reverse?.output?.script !== 'string') throw new TypeError('ModKit returned no roundtrip Galaxy script');
  if (textByRole.has('header') && typeof reverse.output.header !== 'string') {
    throw new TypeError('ModKit returned no roundtrip Galaxy header');
  }
  stageTimes = { galaxyToTriggersMs: forwardMs, triggersToGalaxyMs: reverseMs };
  converted = {
    output: {
      ...reverse.output,
      triggerData: forward.output.triggerData,
      triggerStrings: forward.output.triggerStrings,
      gameStrings: forward.output.gameStrings,
      generationOptions: forward.output.generationOptions,
      localizedStrings: forward.output.localizedStrings,
      customAi: forward.output.customAi,
      recoveredAttributes: forward.output.recoveredAttributes,
      replacedScripts: forward.output.replacedScripts,
      roundtripScript: reverse.output.script,
      roundtripHeader: reverse.output.header,
      originalScript: originalConversion?.script,
      originalHeader: originalConversion?.header,
    },
    fidelity: {
      completeness: forward.fidelity?.completeness === 'complete' && reverse.fidelity?.completeness === 'complete' ? 'complete' : 'partial',
      preserved: { count: (forward.fidelity?.preserved?.count ?? 0) + (reverse.fidelity?.preserved?.count ?? 0) },
      rewritten: { count: (forward.fidelity?.rewritten?.count ?? 0) + (reverse.fidelity?.rewritten?.count ?? 0) },
      dropped: { count: (forward.fidelity?.dropped?.count ?? 0) + (reverse.fidelity?.dropped?.count ?? 0) },
      unsupported: { count: (forward.fidelity?.unsupported?.count ?? 0) + (reverse.fidelity?.unsupported?.count ?? 0) },
      forward: forward.fidelity,
      reverse: reverse.fidelity,
    },
    diagnostics: [
      ...(forward.diagnostics ?? forward.fidelity?.diagnostics ?? []).map(item => ({ ...item, conversionStage: 'galaxy-to-triggers' })),
      ...(reverse.diagnostics ?? reverse.fidelity?.diagnostics ?? []).map(item => ({ ...item, conversionStage: 'triggers-to-galaxy' })),
    ],
    provenance: { forward: forward.provenance, reverse: reverse.provenance },
  };
  } catch (error) {
    roundtripConversion = { status: 'failed', error: String(error) };
    converted = {
      output: {
        originalScript: originalConversion?.script,
        originalHeader: originalConversion?.header,
        triggerData: forward?.output?.triggerData,
      },
      fidelity: { completeness: 'partial', preserved: { count: 0 }, rewritten: { count: 0 }, dropped: { count: 1 }, unsupported: { count: 0 } },
      diagnostics: [{ severity: 'error', code: 'ROUNDTRIP_FAILED', message: String(error), conversionStage: 'galaxy-to-triggers' }],
    };
  }
} else {
  // A single direction in its own process: its phases are the whole conversion.
  const progress = [];
  const onProgress = event => progress.push({ phase: event.phase, at: performance.now() });
  converted = operation === 'galaxy-to-triggers'
    ? await convertGalaxyToTriggers({
        ...commonOptions,
        onProgress,
        script: textByRole.get('script'),
        header: textByRole.get('header') ?? '',
      })
    : await convertTriggersToGalaxy(textByRole.get('trigger-data'), { ...commonOptions, onProgress });
  stagePhases = { [operation === 'galaxy-to-triggers' ? 'galaxyToTriggers' : 'triggersToGalaxy']: phaseTimings(progress, performance.now()) };
}
const conversionWallTimeMs = performance.now() - started;
const outputFields = roundtrip
  ? [
      // TriggerData is compared by normalized GUI structure below, not raw XML:
      // XML formatting and generated IDs are not semantic conversion failures.
      ['trigger-data', 'triggerData', 'Triggers', null],
      ['trigger-strings', 'triggerStrings', 'TriggerStrings.txt', null],
      ['game-strings', 'gameStrings', 'GameStrings.txt', null],
      ['roundtrip-script', 'roundtripScript', 'Roundtrip.galaxy', 'script'],
      ['roundtrip-header', 'roundtripHeader', 'Roundtrip_h.galaxy', 'header'],
      ['original-script', 'originalScript', 'OriginalTriggers.galaxy', null],
      ['original-header', 'originalHeader', 'OriginalTriggers_h.galaxy', null],
    ]
  : operation === 'galaxy-to-triggers'
  ? [['trigger-data', 'triggerData', 'Triggers'], ['trigger-strings', 'triggerStrings', 'TriggerStrings.txt'], ['game-strings', 'gameStrings', 'GameStrings.txt']]
  : [['script', 'script', 'Galaxy.galaxy'], ['header', 'header', 'Galaxy_h.galaxy']];
const requiredOutputKey = operation === 'galaxy-triggers-roundtrip' && roundtripConversion?.status === 'failed'
  ? originalConversion?.status === 'completed' ? 'originalScript' : null
  : ['galaxy-to-triggers', 'galaxy-triggers-roundtrip'].includes(operation) ? 'triggerData' : 'script';
if (requiredOutputKey && typeof converted?.output?.[requiredOutputKey] !== 'string') throw new TypeError(`ModKit returned no ${requiredOutputKey} text`);

await mkdir(request.outputDirectory, { recursive: true });
const artifacts = [];
const goldenComparison = {};
const structuralComparison = {};
for (const [role, key, fileName, comparisonRole = role] of outputFields) {
  if (typeof converted.output[key] !== 'string') continue;
  const target = path.join(request.outputDirectory, fileName);
  await writeFile(target, converted.output[key]);
  artifacts.push({ role, path: fileName });
  const expected = !selfCheck ? undefined : expectedByRole.get(`expected-${comparisonRole}`)
    ?? (roundtrip ? textByRole.get(comparisonRole) : undefined);
  if (expected !== undefined) goldenComparison[comparisonRole] = {
    byteExact: converted.output[key] === expected,
    exact: converted.output[key].replaceAll('\r\n', '\n').trimEnd() === expected.replaceAll('\r\n', '\n').trimEnd(),
    expectedBytes: Buffer.byteLength(expected),
    actualBytes: Buffer.byteLength(converted.output[key]),
  };
  if (expected !== undefined && ['script', 'header'].includes(comparisonRole)) {
    if (!compareGalaxyPrograms) {
      structuralComparison[comparisonRole] = { status: 'unavailable', reason: 'ModKit AST parser/comparator is not exported by this module' };
    } else {
      const comparison = compareGalaxyPrograms(expected, converted.output[key], {
        libraryId: request.options?.libraryId,
        implicitLibrary: request.options?.implicitLibrary,
      });
      structuralComparison[comparisonRole] = {
        status: comparison.syntaxValid === false ? 'invalid-syntax' : comparison.exact ? 'equivalent' : 'different',
        syntaxValid: comparison.syntaxValid,
        exact: comparison.exact,
        differenceSamples: comparison.functions?.differenceSamples ?? [],
      };
    }
  }
}
// Each locale's names and texts in the folder the editor keeps them in.
for (const item of converted.output.localizedStrings ?? []) {
  for (const [key, fileName] of [['triggerStrings', 'TriggerStrings.txt'], ['gameStrings', 'GameStrings.txt']]) {
    if (typeof item[key] !== 'string') continue;
    const relative = path.join(`${item.locale}.SC2Data`, 'LocalizedData', fileName);
    await mkdir(path.join(request.outputDirectory, path.dirname(relative)), { recursive: true });
    await writeFile(path.join(request.outputDirectory, relative), item[key]);
    artifacts.push({ role: `localized-${key === 'triggerStrings' ? 'trigger' : 'game'}-strings`, path: relative.split(path.sep).join('/'), locale: item.locale });
  }
}
// The Custom AI document read back from the generated code, and the AI scripts generated from it again.
if (typeof converted.output.customAi?.document === 'string') {
  await writeFile(path.join(request.outputDirectory, 'CustomAI'), converted.output.customAi.document);
  artifacts.push({ role: 'custom-ai', path: 'CustomAI' });
  await writeFile(path.join(request.outputDirectory, 'custom-ai.json'), JSON.stringify({ ...converted.output.customAi, document: undefined, replacedScripts: converted.output.replacedScripts }, null, 2));
  artifacts.push({ role: 'custom-ai-options', path: 'custom-ai.json' });
}
for (const file of converted.output.customAiScripts ?? []) {
  const relative = path.join('ai-scripts', file.fileName);
  await mkdir(path.join(request.outputDirectory, 'ai-scripts'), { recursive: true });
  await writeFile(path.join(request.outputDirectory, relative), file.text);
  artifacts.push({ role: 'roundtrip-ai-script', path: relative.split(path.sep).join('/') });
}
// The map documents the converter reads back from Galaxy, against the package's own when it has them.
// Trigger ids are fresh in the conversion, and Color/RepeatShow are in no script, so they are masked.
const mapDocuments = {};
const packageText = async name => packagePath ? readFile(path.join(packagePath, name), 'utf8').catch(() => undefined) : undefined;
const maskCustomAi = xml => xml.replace(/\r\n/gu, '\n').replace(/ (Trigger|Color)="[^"]*"/gu, '').replace(/<ConfigTrigger Value="[^"]*"\/>/gu, '<ConfigTrigger/>').replace(/\n\s*<RepeatShow [^>]*\/>/gu, '').trimEnd();
if (typeof converted.output.customAi?.document === 'string') {
  const expected = await packageText('CustomAI');
  mapDocuments.customAi = { definitions: (converted.output.customAi.document.match(/<Definition /gu) ?? []).length,
    ...(expected !== undefined ? { exactMasked: maskCustomAi(expected) === maskCustomAi(converted.output.customAi.document) } : {}) };
}
if ((converted.output.customAiScripts ?? []).length) {
  mapDocuments.aiScripts = await Promise.all(converted.output.customAiScripts.map(async file => {
    const expected = await packageText(file.fileName);
    return { fileName: file.fileName, ...(expected !== undefined ? { byteExact: expected === file.text } : {}) };
  }));
}
if (typeof converted.output.recoveredAttributes?.document === 'string') {
  await writeFile(path.join(request.outputDirectory, 'Attributes.recovered'), converted.output.recoveredAttributes.document);
  artifacts.push({ role: 'recovered-attributes', path: 'Attributes.recovered' });
  const expected = await packageText('Attributes');
  const ids = xml => [...xml.matchAll(/<Attribute>\s*<Id Value="(\d+)"\/>\s*<Type Value="(\w+)"\/>/gu)].map(match => `${match[1]}:${match[2]}`);
  const recovered = ids(converted.output.recoveredAttributes.document);
  mapDocuments.attributes = { recovered, inferred: converted.output.recoveredAttributes.inferred.length,
    ...(expected !== undefined ? { packageHasAttributes: true, missingFromPackage: recovered.filter(id => !ids(expected).includes(id)) } : { packageHasAttributes: false }) };
}
if (converted.output.generationOptions !== undefined) {
  await writeFile(path.join(request.outputDirectory, 'generation-options.json'), JSON.stringify(converted.output.generationOptions, null, 2));
  artifacts.push({ role: 'generation-options', path: 'generation-options.json' });
}
const triggerDataText = roundtrip || operation === 'galaxy-to-triggers'
  ? converted.output.triggerData
  : textByRole.get('trigger-data');
const triggerStringsText = roundtrip || operation === 'galaxy-to-triggers'
  ? [converted.output.triggerStrings, converted.output.gameStrings].filter(value => value !== undefined).join('\n')
  : [textByRole.get('trigger-strings'), textByRole.get('game-strings')].filter(value => value !== undefined).join('\n');
const guiFidelity = selfCheck && typeof triggerDataText === 'string'
  ? await inspectTriggerData(triggerDataText, triggerStringsText) : undefined;
const expectedTriggerData = expectedByRole.get('expected-trigger-data');
const guiComparison = expectedTriggerData === undefined || guiFidelity === undefined
  || !/<Element\b/iu.test(expectedTriggerData)
  ? undefined
  : compareGuiFidelity(await inspectTriggerData(expectedTriggerData), guiFidelity);

const result = {
  schemaVersion: 1,
  status: 'completed',
  artifacts,
  diagnostics: converted.diagnostics ?? converted.fidelity?.diagnostics ?? [],
  goldenComparison,
  structuralComparison,
  ...(Object.keys(mapDocuments).length ? { mapDocuments } : {}),
  ...(originalConversion ? { originalConversion: {
    status: originalConversion.status,
    wallTimeMs: originalConversion.wallTimeMs,
    ...(originalConversion.error ? { error: originalConversion.error } : {}),
    ...(originalConversion.fidelity ? { fidelity: originalConversion.fidelity } : {}),
  } } : {}),
  ...(roundtripConversion ? { roundtripConversion } : {}),
  ...(guiComparison ? { guiComparison } : {}),
  conversionQuality: {
    completeness: converted.fidelity?.completeness ?? 'unknown',
    preserved: converted.fidelity?.preserved?.count,
    rewritten: converted.fidelity?.rewritten?.count,
    dropped: converted.fidelity?.dropped?.count,
    unsupported: converted.fidelity?.unsupported?.count,
    galaxyScriptCanonicalExact: converted.fidelity?.verification?.galaxyScriptCanonicalExact,
    galaxyHeaderCanonicalExact: converted.fidelity?.verification?.galaxyHeaderCanonicalExact,
    galaxyValidation: converted.fidelity?.verification?.galaxyValidation?.status,
  },
  metrics: {
    conversionWallTimeMs,
    startupMs,
    dependencyLoadMs,
    processMemory: { maxRssMiB: Math.round(process.resourceUsage().maxRSS / 1024), heapUsedMiB: Math.round(process.memoryUsage().heapUsed / 1048576) },
    ...stageTimes,
    ...(stagePhases ? { stagePhases } : {}),
    convertedScripts: (roundtrip ? forward?.output?.convertedScripts : converted.output.convertedScripts) ?? [],
    elements: roundtrip ? forward?.output?.elements : converted.output.elements,
    typeCounts: roundtrip ? forward?.output?.typeCounts : converted.output.typeCounts,
    guiFidelity,
  },
  converterReport: {
    fidelity: converted.fidelity,
    provenance: converted.provenance,
    dependencySources: bundled?.sources ?? [],
    dependencyChain: chain?.chain ?? [],
  },
};
const temporary = `${request.resultPath}.tmp-${process.pid}`;
await writeFile(temporary, JSON.stringify(result));
await rename(temporary, request.resultPath);

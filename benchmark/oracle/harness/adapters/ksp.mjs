import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// KSP trigger-revize converter (Java). Galaxy -> Triggers via ConvertMapRunner on the packed map,
// then Triggers -> Galaxy via SemanticRoundTripRunner with those Triggers provided.
const request = JSON.parse(await readFile(process.argv[2], 'utf8'));
const buildDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.benchmark-ksp-build');
const classpath = [path.join(buildDirectory, 'target', 'trigger-revize-ksp-0.1.0.jar'),
  (await readFile(path.join(buildDirectory, 'target', 'classpath.txt'), 'utf8')).trim()].join(path.delimiter);
// triggers-to-galaxy runs only KSP's Triggers -> Galaxy stage on provided Triggers (for example another
// converter's output); SemanticRoundTripRunner also needs the original Galaxy, which it checks against.
const operation = request.operation ?? 'galaxy-triggers-roundtrip';
const inputPath = role => request.inputs.find(input => input.role === role)?.path;
// Manifest paths are relative to the manifest (the harness's cwd); java runs in the build directory.
const packedMap = typeof request.options?.kspMap === 'string' ? path.resolve(request.options.kspMap) : undefined;
if (operation !== 'triggers-to-galaxy' && (!packedMap || !existsSync(packedMap))) throw new TypeError('KSP needs options.kspMap: the packed .SC2Map');
// ConvertMapRunner reads the script from the map itself; the script input names the file for the roundtrip check.
const script = operation === 'triggers-to-galaxy' ? inputPath('expected-script') : inputPath('script');
if (!script) throw new TypeError(`KSP ${operation} needs ${operation === 'triggers-to-galaxy' ? 'an expected-script' : 'a script'} input`);
if (operation === 'triggers-to-galaxy' && !inputPath('trigger-data')) throw new TypeError('KSP triggers-to-galaxy needs a trigger-data input');

// KSP is built and profiled with JDK 25; PATH may hold a newer java first.
const JDK = process.env.KSP_JDK ?? 'C:/Program Files/Eclipse Adoptium/jdk-25.0.3.9-hotspot';
const javaExecutable = existsSync(path.join(JDK, 'bin', 'java.exe')) ? path.join(JDK, 'bin', 'java.exe') : 'java';
const HEAP = process.env.KSP_HEAP ?? '6g';

// A JVM that cannot commit its heap dies with "insufficient memory" (Windows error 1455) — an
// environment failure, not a KSP result. Refuse up front instead of failing twenty minutes in.
if (process.platform === 'win32') {
  const freeVirtualKb = await new Promise(resolve => {
    const probe = spawn('powershell.exe', ['-NoProfile', '-Command', '(Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory'],
      { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    let text = '';
    probe.stdout.on('data', chunk => { text += chunk; });
    probe.once('close', () => resolve(Number(text.trim())));
    probe.once('error', () => resolve(Number.NaN));
  });
  // The heap is committed as it grows: KSP peaked at 1.2 GB (AllRacesTester, 2026-09-26), so the
  // default leaves room for that plus the JVM itself.
  const neededKb = Number(process.env.KSP_MIN_FREE_VIRTUAL_GB ?? 3) * 1024 * 1024;
  if (Number.isFinite(freeVirtualKb) && freeVirtualKb < neededKb) {
    throw new Error(`KSP needs ${neededKb / 1024 / 1024} GB of free virtual memory, the system has ${(freeVirtualKb / 1024 / 1024).toFixed(1)} GB`);
  }
}

/** Resolves with the output and exit code; code 2 is KSP's own verdict, not a crash. */
function java(mainClass, args, acceptedCodes = [0]) {
  return new Promise((resolve, reject) => {
    const child = spawn(javaExecutable, [`-Xmx${HEAP}`, '-cp', classpath, `ru.ksp.triggerrevize.${mainClass}`, ...args],
      { cwd: buildDirectory, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => { output = (output + chunk).slice(-4000); });
    child.once('error', reject);
    child.once('close', code => acceptedCodes.includes(code)
      ? resolve({ output, code })
      : reject(new Error(`${mainClass} exited with code ${code}\n${output}`)));
  });
}

const output = request.outputDirectory;
const convertDirectory = path.join(output, 'ksp-convert');
const roundtripDirectory = path.join(output, 'ksp-roundtrip');

async function blockingDiagnostics() {
  try { return JSON.parse(await readFile(path.join(roundtripDirectory, 'manifest.json'), 'utf8')).blockingDiagnostics ?? []; }
  catch { return []; }
}

if (operation === 'triggers-to-galaxy') {
  await mkdir(roundtripDirectory, { recursive: true });
  const providedTriggers = path.resolve(inputPath('trigger-data'));
  const reverseStarted = performance.now();
  const reverse = await java('SemanticRoundTripRunner', [path.resolve(script), 'strict', roundtripDirectory, providedTriggers], [0, 2]);
  const triggersToGalaxyMs = performance.now() - reverseStarted;
  const kspState = /^STATE=(\S+)/mu.exec(reverse.output)?.[1] ?? 'unknown';
  const regenerated = path.join(roundtripDirectory, 'regenerated.galaxy');
  const artifacts = [];
  const diagnostics = [];
  if (existsSync(regenerated)) {
    await copyFile(regenerated, path.join(output, 'Galaxy.galaxy'));
    artifacts.push({ role: 'script', path: 'Galaxy.galaxy' });
  } else {
    const blocking = await blockingDiagnostics();
    diagnostics.push({ code: 'ksp/no-regenerated-galaxy', severity: 'error',
      message: `KSP STATE=${kspState}; ${blocking.length} blocking diagnostics: ${blocking.slice(0, 5).join('; ')}` });
  }
  if (reverse.code !== 0) diagnostics.push({ code: 'ksp/self-verification-failed', severity: 'warning', message: `KSP SemanticRoundTripRunner reported STATE=${kspState} (exit code ${reverse.code})` });
  const resultTemporary = `${request.resultPath}.tmp`;
  await writeFile(resultTemporary, JSON.stringify({
    schemaVersion: 1, status: 'completed', artifacts, diagnostics,
    metrics: { conversionWallTimeMs: triggersToGalaxyMs, triggersToGalaxyMs, kspState, javaExecutable, heap: HEAP,
      kspBlockingDiagnostics: existsSync(regenerated) ? undefined : (await blockingDiagnostics()).length },
  }));
  await rename(resultTemporary, request.resultPath);
  process.exit(0);
}

await mkdir(convertDirectory, { recursive: true });
if (operation === 'galaxy-to-triggers') {
  // Galaxy -> Triggers alone: ConvertMapRunner in its own JVM; Triggers -> Galaxy is measured apart.
  const forwardStarted = performance.now();
  await java('ConvertMapRunner', ['--generate-triggers-only-from-script', packedMap, convertDirectory]);
  const galaxyToTriggersMs = performance.now() - forwardStarted;
  let summary = {};
  try {
    const summaryName = (await readdir(convertDirectory)).find(name => name.endsWith('.convert-summary.json'));
    if (summaryName) summary = JSON.parse(await readFile(path.join(convertDirectory, summaryName), 'utf8'));
  } catch {}
  await copyFile(path.join(convertDirectory, 'generated.xml'), path.join(output, 'Triggers'));
  const resultTemporary = `${request.resultPath}.tmp`;
  await writeFile(resultTemporary, JSON.stringify({
    schemaVersion: 1, status: 'completed', artifacts: [{ role: 'trigger-data', path: 'Triggers' }], diagnostics: [],
    metrics: {
      conversionWallTimeMs: galaxyToTriggersMs, galaxyToTriggersMs, javaExecutable, heap: HEAP,
      kspExtractMs: summary.extractMs, kspTotalConvertMs: summary.totalConvertMs,
      kspConversionState: summary.conversionState, kspDependencyObservations: summary.dependencyObservations,
      kspDependencyCatalogs: summary.dependencyCatalogs,
    },
  }));
  await rename(resultTemporary, request.resultPath);
  process.exit(0);
}
const started = performance.now();
await java('ConvertMapRunner', ['--generate-triggers-only-from-script', packedMap, convertDirectory]);
const galaxyToTriggersMs = performance.now() - started;
// KSP's own stage split: extractMs covers reading the map and its dependency sources.
let convertSummary = {};
try {
  const summaryName = (await readdir(convertDirectory)).find(name => name.endsWith('.convert-summary.json'));
  if (summaryName) convertSummary = JSON.parse(await readFile(path.join(convertDirectory, summaryName), 'utf8'));
} catch {}
const generatedXml = path.join(convertDirectory, 'generated.xml');
await copyFile(generatedXml, path.join(output, 'Triggers'));

const reverseStarted = performance.now();
// Exit code 2 = KSP's STATE ROUNDTRIP_FAILED or INTERNAL_FAILED (SemanticRoundTripRunner): its own
// strict self-check did not match, yet the regenerated Galaxy is written. The benchmark oracle judges
// that output the same way as Modkit's, so the attempt completes and KSP's verdict is reported.
const reverse = await java('SemanticRoundTripRunner', [script, 'strict', roundtripDirectory, generatedXml], [0, 2]);
const triggersToGalaxyMs = performance.now() - reverseStarted;
const kspState = /^STATE=(\S+)/mu.exec(reverse.output)?.[1] ?? 'unknown';
const regenerated = path.join(roundtripDirectory, 'regenerated.galaxy');
const artifacts = [{ role: 'trigger-data', path: 'Triggers' }];
if (existsSync(regenerated)) {
  await copyFile(regenerated, path.join(output, 'Roundtrip.galaxy'));
  artifacts.push({ role: 'roundtrip-script', path: 'Roundtrip.galaxy' });
}
// KSP accepts provided Triggers only in its strict mode, which refuses to emit Galaxy for Triggers
// with a CustomScript or an unproven library include. Its Triggers still count; the reverse stage
// is reported as failed with KSP's own blocking reasons, the same way the Modkit adapter does.
let blocking = [];
try { blocking = JSON.parse(await readFile(path.join(roundtripDirectory, 'manifest.json'), 'utf8')).blockingDiagnostics ?? []; }
catch {}
const diagnostics = [];
if (!existsSync(regenerated)) diagnostics.push({ code: 'ksp/no-regenerated-galaxy', severity: 'error', message: `KSP produced no regenerated Galaxy from the Triggers: ${blocking.slice(0, 3).join('; ')}` });
if (reverse.code !== 0) diagnostics.push({ code: 'ksp/self-verification-failed', severity: 'warning', message: `KSP SemanticRoundTripRunner reported STATE=${kspState} (exit code ${reverse.code})` });
const resultTemporary = `${request.resultPath}.tmp`;
await writeFile(resultTemporary, JSON.stringify({
  schemaVersion: 1,
  status: 'completed',
  artifacts,
  diagnostics,
  ...(existsSync(regenerated) ? {} : { roundtripConversion: { status: 'failed', error: `KSP STATE=${kspState}: ${blocking.join('; ')}` } }),
  metrics: {
    conversionWallTimeMs: galaxyToTriggersMs + triggersToGalaxyMs, galaxyToTriggersMs, triggersToGalaxyMs, kspState, javaExecutable, heap: HEAP,
    kspExtractMs: convertSummary.extractMs, kspTotalConvertMs: convertSummary.totalConvertMs,
    kspConversionState: convertSummary.conversionState, kspDependencyObservations: convertSummary.dependencyObservations,
  },
}));
await rename(resultTemporary, request.resultPath);

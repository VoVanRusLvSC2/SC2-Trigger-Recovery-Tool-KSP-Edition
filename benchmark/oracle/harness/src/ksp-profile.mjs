import { spawn, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Profiles one KSP run without modifying KSP: samples the JVM's working set from the OS, its heap via jcmd,
// and the main thread's stack via jcmd Thread.print, attributing wall time to the method ConvertMapRunner /
// SemanticRoundTripRunner is currently executing.
const JDK = process.env.KSP_JDK ?? 'C:/Program Files/Eclipse Adoptium/jdk-25.0.3.9-hotspot';
const buildDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.benchmark-ksp-build');
const [label, packedMap, galaxy, outputRoot] = process.argv.slice(2);
if (!outputRoot) {
  console.error('Usage: node src/ksp-profile.mjs <label> <packed.SC2Map> <script.galaxy> <output directory>');
  process.exit(2);
}
const classpath = [path.join(buildDirectory, 'target', 'trigger-revize-ksp-0.1.0.jar'),
  (await readFile(path.join(buildDirectory, 'target', 'classpath.txt'), 'utf8')).trim()].join(path.delimiter);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function workingSetMiB(pid) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command',
    `(Get-Process -Id ${pid} -ErrorAction SilentlyContinue | ForEach-Object { [math]::Round($_.WorkingSet64/1MB,1), [math]::Round($_.PrivateMemorySize64/1MB,1) }) -join ','`],
  { encoding: 'utf8', windowsHide: true });
  const [workingSet, privateBytes] = result.stdout.trim().split(',').map(Number);
  return { workingSet, privateBytes };
}

function jcmd(pid, ...args) {
  return spawnSync(path.join(JDK, 'bin', 'jcmd.exe'), [String(pid), ...args], { encoding: 'utf8', windowsHide: true, timeout: 20000 }).stdout ?? '';
}

// The frame ConvertMapRunner.main called into, e.g. ConvertMapRunner.loadDependencySources.
function activePhase(threadDump, mainClass) {
  const main = /"main"[\s\S]*?(?=\n\n|$)/u.exec(threadDump)?.[0];
  if (!main) return 'unknown';
  const frames = [...main.matchAll(/at ([\w.$]+)\(/gu)].map(match => match[1]);
  const mainAt = frames.findIndex(frame => frame.startsWith(`ru.ksp.triggerrevize.${mainClass}.main`));
  if (mainAt < 1) return frames[0] ?? 'unknown';
  return frames[mainAt - 1].replace('ru.ksp.triggerrevize.', '');
}

function heapUsedMiB(text) {
  const match = /used\s+(\d+)K/u.exec(text) ?? /(\d+)K\s*\(\d+%\)\s*used/u.exec(text);
  return match ? Math.round(Number(match[1]) / 1024) : null;
}

async function profile(stage, mainClass, args) {
  const started = performance.now();
  const child = spawn(path.join(JDK, 'bin', 'java.exe'), ['-Xmx6g', '-cp', classpath, `ru.ksp.triggerrevize.${mainClass}`, ...args],
    { cwd: buildDirectory, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const stdout = [];
  child.stdout.on('data', chunk => stdout.push({ at: performance.now() - started, text: String(chunk) }));
  child.stderr.on('data', chunk => stdout.push({ at: performance.now() - started, text: String(chunk) }));
  let exited = false;
  const closed = new Promise(resolve => child.once('close', code => { exited = true; resolve(code); }));
  const samples = [];
  await sleep(1500);
  while (!exited) {
    const at = performance.now() - started;
    const memory = workingSetMiB(child.pid);
    const heap = heapUsedMiB(jcmd(child.pid, 'GC.heap_info'));
    const phase = activePhase(jcmd(child.pid, 'Thread.print'), mainClass);
    samples.push({ atMs: Math.round(at), ...memory, heapUsedMiB: heap, phase });
    await sleep(1500);
  }
  const exitCode = await closed;
  const wallMs = performance.now() - started;
  const phaseMs = {};
  for (let index = 0; index < samples.length; index++) {
    const next = samples[index + 1]?.atMs ?? wallMs;
    phaseMs[samples[index].phase] = (phaseMs[samples[index].phase] ?? 0) + (next - samples[index].atMs);
  }
  const peak = key => Math.max(...samples.map(sample => sample[key] ?? 0));
  return {
    stage, mainClass, exitCode, wallMs: Math.round(wallMs),
    peakWorkingSetMiB: peak('workingSet'), peakPrivateMiB: peak('privateBytes'), peakHeapUsedMiB: peak('heapUsedMiB'),
    phaseMs: Object.fromEntries(Object.entries(phaseMs).map(([key, value]) => [key, Math.round(value)]).sort((a, b) => b[1] - a[1])),
    progress: stdout.filter(item => /^\d+\/\d+ /u.test(item.text.trim())).map(item => ({ atMs: Math.round(item.at), line: item.text.trim() })),
    samples,
  };
}

await mkdir(outputRoot, { recursive: true });
const convert = await profile('galaxy-to-triggers', 'ConvertMapRunner', ['--generate-triggers-only-from-script', packedMap, path.join(outputRoot, 'convert')]);
const generated = path.join(outputRoot, 'convert', 'generated.xml');
const stages = [convert];
if (convert.exitCode === 0 && existsSync(generated)) {
  stages.push(await profile('triggers-to-galaxy', 'SemanticRoundTripRunner', [galaxy, 'strict', path.join(outputRoot, 'roundtrip'), generated]));
}
await writeFile(path.join(outputRoot, `profile-${label}.json`), JSON.stringify({ label, packedMap, jdk: JDK, stages }, null, 1));
for (const stage of stages) {
  console.log(`${label} ${stage.stage}: exit ${stage.exitCode}, ${(stage.wallMs / 1000).toFixed(1)} s, ws ${stage.peakWorkingSetMiB} MiB, heap ${stage.peakHeapUsedMiB} MiB`);
  for (const [phase, ms] of Object.entries(stage.phaseMs).slice(0, 8)) console.log(`   ${(ms / 1000).toFixed(1).padStart(7)} s  ${phase}`);
}

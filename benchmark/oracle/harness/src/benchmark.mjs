import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { appendFile, cp, mkdir, readFile, readdir, realpath, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { finished } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConversionOracle, readGalaxyComparisonPair } from './conversion-oracle.mjs';
import { openReport, writeReport } from './report.mjs';
import { writeRunHistory } from './compare-runs.mjs';

const ID = /^[A-Za-z0-9._-]+$/u;

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}

function validateManifest(value) {
  const manifest = requireObject(value, 'manifest');
  if (manifest.schemaVersion !== 1) throw new TypeError('manifest.schemaVersion must be 1');
  if (manifest.astOracleModule !== undefined && (typeof manifest.astOracleModule !== 'string' || !manifest.astOracleModule)) {
    throw new TypeError('manifest.astOracleModule must be a non-empty path string');
  }
  if (!Array.isArray(manifest.converters) || manifest.converters.length === 0) throw new TypeError('manifest.converters must not be empty');
  if (!Array.isArray(manifest.cases) || manifest.cases.length === 0) throw new TypeError('manifest.cases must not be empty');
  const repetitions = manifest.repetitions ?? 1;
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 20) throw new RangeError('manifest.repetitions must be between 1 and 20');
  const timeoutMs = manifest.timeoutMs ?? 120_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3_600_000) throw new RangeError('manifest.timeoutMs must be between 1 and 3600000');

  for (const [label, values] of [['converter', manifest.converters], ['case', manifest.cases]]) {
    const ids = new Set();
    for (const entry of values) {
      requireObject(entry, label);
      if (typeof entry.id !== 'string' || !ID.test(entry.id)) throw new TypeError(`${label}.id must contain only letters, numbers, dot, underscore, or dash`);
      if (ids.has(entry.id)) throw new TypeError(`duplicate ${label}.id: ${entry.id}`);
      ids.add(entry.id);
    }
  }
  for (const converter of manifest.converters) {
    if (typeof converter.command !== 'string' || converter.command.length === 0) throw new TypeError(`${converter.id}.command must be a non-empty string`);
    if (converter.args !== undefined && (!Array.isArray(converter.args) || converter.args.some(value => typeof value !== 'string'))) {
      throw new TypeError(`${converter.id}.args must be an array of strings`);
    }
  }
  for (const benchmarkCase of manifest.cases) {
    if (benchmarkCase.tags !== undefined && (!Array.isArray(benchmarkCase.tags)
        || benchmarkCase.tags.some(tag => typeof tag !== 'string' || tag.length === 0)
        || new Set(benchmarkCase.tags).size !== benchmarkCase.tags.length)) {
      throw new TypeError(`${benchmarkCase.id}.tags must be unique non-empty strings`);
    }
    if (!Array.isArray(benchmarkCase.inputs) || benchmarkCase.inputs.length === 0) throw new TypeError(`${benchmarkCase.id}.inputs must not be empty`);
    const packageIds = new Set();
    for (const input of benchmarkCase.inputs) {
      requireObject(input, `${benchmarkCase.id}.input`);
      if (typeof input.role !== 'string' || typeof input.path !== 'string') throw new TypeError(`${benchmarkCase.id} input needs string role and path`);
      if (input.role === 'package') {
        if (input.fromPackage !== undefined) throw new TypeError(`${benchmarkCase.id} package input cannot use fromPackage`);
        if (input.id !== undefined && (typeof input.id !== 'string' || !ID.test(input.id))) {
          throw new TypeError(`${benchmarkCase.id} package input id must contain only letters, numbers, dot, underscore, or dash`);
        }
        if (input.id !== undefined && packageIds.has(input.id)) throw new TypeError(`${benchmarkCase.id} has duplicate package input id: ${input.id}`);
        if (input.id !== undefined) packageIds.add(input.id);
      } else if (input.id !== undefined) {
        throw new TypeError(`${benchmarkCase.id} only package inputs may have an id`);
      }
    }
    for (const input of benchmarkCase.inputs) {
      if (input.fromPackage !== undefined && (input.role === 'package'
          || typeof input.fromPackage !== 'string' || !packageIds.has(input.fromPackage))) {
        throw new TypeError(`${benchmarkCase.id} input fromPackage must reference a package input id`);
      }
    }
  }
  if (manifest.coverageRequirements !== undefined) {
    const requirements = requireObject(manifest.coverageRequirements, 'manifest.coverageRequirements');
    if (requirements.minCases !== undefined && (!Number.isInteger(requirements.minCases) || requirements.minCases < 1)) {
      throw new RangeError('coverageRequirements.minCases must be a positive integer');
    }
    if (requirements.minUniquePackages !== undefined
        && (!Number.isInteger(requirements.minUniquePackages) || requirements.minUniquePackages < 1)) {
      throw new RangeError('coverageRequirements.minUniquePackages must be a positive integer');
    }
    for (const field of ['minDocumentKinds', 'minOperations', 'minTags']) {
      if (requirements[field] === undefined) continue;
      const minima = requireObject(requirements[field], `coverageRequirements.${field}`);
      for (const [key, count] of Object.entries(minima)) {
        if (!key || !Number.isInteger(count) || count < 0) {
          throw new RangeError(`coverageRequirements.${field} values must be non-negative integers`);
        }
      }
    }
  }
  return { ...manifest, repetitions, timeoutMs };
}

async function hashFile(file) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = createReadStream(file);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

async function hashPath(target) {
  const details = await stat(target);
  if (details.isFile()) return { kind: 'file', bytes: details.size, sha256: await hashFile(target) };
  if (!details.isDirectory()) throw new TypeError(`unsupported artifact type: ${target}`);
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) files.push(full);
      else throw new TypeError(`unsupported artifact entry: ${full}`);
    }
  }
  await visit(target);
  files.sort((left, right) => left.localeCompare(right));
  const hash = createHash('sha256');
  let bytes = 0;
  for (const file of files) {
    const relative = path.relative(target, file).replaceAll(path.sep, '/');
    const item = await hashPath(file);
    bytes += item.bytes;
    hash.update(`${relative}\0${item.sha256}\0`);
  }
  return { kind: 'directory', bytes, files: files.length, sha256: hash.digest('hex') };
}

function resolveCommand(command, baseDirectory) {
  return /[\\/]/u.test(command) ? path.resolve(baseDirectory, command) : command;
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function validateInputPaths(cases, manifestDirectory) {
  let packageCount = 0;
  let fileCount = 0;
  for (const benchmarkCase of cases) {
    const packages = new Map();
    for (const input of benchmarkCase.inputs.filter(item => item.role === 'package')) {
      const absolute = path.resolve(manifestDirectory, input.path);
      const [details, canonical] = await Promise.all([stat(absolute), realpath(absolute)]);
      if (!details.isDirectory() && !details.isFile()) throw new TypeError(`${benchmarkCase.id} package input is not a file or directory`);
      if (input.id !== undefined) packages.set(input.id, { absolute, canonical });
      packageCount += 1;
    }
    for (const input of benchmarkCase.inputs.filter(item => item.role !== 'package')) {
      let absolute;
      if (input.fromPackage !== undefined) {
        const sourcePackage = packages.get(input.fromPackage);
        if (!sourcePackage) throw new TypeError(`${benchmarkCase.id} references an unavailable package input`);
        absolute = path.resolve(sourcePackage.absolute, input.path);
        const relative = path.relative(sourcePackage.absolute, absolute);
        if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
          throw new RangeError(`${benchmarkCase.id} package-linked path must stay inside its package`);
        }
        const canonical = await realpath(absolute);
        if (!inside(sourcePackage.canonical, canonical)) {
          throw new RangeError(`${benchmarkCase.id} package-linked path resolves outside its package`);
        }
      } else absolute = path.resolve(manifestDirectory, input.path);
      if (!(await stat(absolute)).isFile()) throw new TypeError(`${benchmarkCase.id} input must resolve to a file: ${input.path}`);
      fileCount += 1;
    }
  }
  return { packageInputsChecked: packageCount, fileInputsChecked: fileCount };
}

async function terminate(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    // ponytail: taskkill is sufficient for the first Windows-only milestone;
    // replace with a Job Object when exact process-tree memory accounting lands.
    spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } else child.kill('SIGKILL');
}

async function startWindowsMemoryMonitor() {
  if (process.platform !== 'win32') return null;
  const monitor = spawn('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', path.join(path.dirname(fileURLToPath(import.meta.url)), 'memory-monitor.ps1'),
  ], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  let output = '';
  monitor.stdout.setEncoding('utf8');
  monitor.stdout.on('data', chunk => { output += chunk; });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('memory monitor startup timed out')), 5000);
    const check = () => {
      if (output.startsWith('ready\r\n') || output.startsWith('ready\n')) {
        clearTimeout(timer);
        resolve();
      }
    };
    monitor.stdout.on('data', check);
    monitor.once('error', error => { clearTimeout(timer); reject(error); });
    monitor.once('close', code => {
      if (!output.startsWith('ready')) {
        clearTimeout(timer);
        reject(new Error(`memory monitor exited during startup (${code})`));
      }
    });
  }).catch(error => { monitor.kill(); throw error; });
  const metrics = new Promise(resolve => {
    monitor.once('close', () => {
      const jsonLine = output.split(/\r?\n/u).find(line => line.startsWith('{'));
      try { resolve(jsonLine ? JSON.parse(jsonLine) : null); }
      catch { resolve(null); }
    });
  });
  return {
    attach(pid) { monitor.stdin.end(`${pid}\n`); },
    metrics,
    stop() { monitor.stdin.end(); monitor.kill(); },
  };
}

async function execute(command, args, options) {
  const stdout = createWriteStream(options.stdout);
  const stderr = createWriteStream(options.stderr);
  let memoryMonitor = null;
  let monitorError = null;
  try { memoryMonitor = await startWindowsMemoryMonitor(); }
  catch (error) { monitorError = String(error); }
  const started = process.hrtime.bigint();
  let timedOut = false;
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  if (child.pid) memoryMonitor?.attach(child.pid);
  else memoryMonitor?.stop();
  const logsClosed = Promise.all([finished(stdout), finished(stderr)]);
  const timer = setTimeout(() => {
    timedOut = true;
    void terminate(child);
  }, options.timeoutMs);
  const closed = await new Promise(resolve => {
    child.once('error', error => resolve({ code: null, signal: null, error: String(error) }));
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timer);
  await logsClosed;
  const memory = await memoryMonitor?.metrics;
  return {
    ...closed,
    timedOut,
    wallTimeMs: Number(process.hrtime.bigint() - started) / 1_000_000,
    // The converter's whole process tree (KSP converts in java under its node adapter); the adapter
    // process alone stays in rootPeakWorkingSetBytes.
    peakWorkingSetBytes: memory?.treePeakWorkingSetBytes ?? memory?.peakWorkingSetBytes ?? null,
    rootPeakWorkingSetBytes: memory?.peakWorkingSetBytes ?? null,
    peakPagedMemorySizeBytes: memory?.peakPagedMemorySizeBytes ?? null,
    treePeakPrivateBytes: memory?.treePeakPrivateBytes ?? null,
    treeProcessNames: memory?.treeProcessNames ?? null,
    ...(monitorError ? { memoryMonitorError: monitorError } : {}),
  };
}

async function appendEvent(file, event) {
  await appendFile(file, `${JSON.stringify({ timestamp: new Date().toISOString(), ...event })}\n`);
}

async function runAttempt(context, converter, benchmarkCase, attempt) {
  const attemptDirectory = path.join(context.runDirectory, 'cases', benchmarkCase.id, converter.id, `attempt-${String(attempt).padStart(2, '0')}`);
  const outputDirectory = path.join(attemptDirectory, 'output');
  const resultPath = path.join(outputDirectory, 'result.json');
  await mkdir(outputDirectory, { recursive: true });

  const inputArtifacts = [];
  const inputs = [];
  const stagedPackages = new Map();
  const stagedPackagesByIndex = new Map();
  for (const [index, input] of benchmarkCase.inputs.entries()) {
    if (input.role !== 'package') continue;
    const absolute = path.resolve(context.manifestDirectory, input.path);
    const digest = await hashPath(absolute);
    const source = await realpath(absolute);
    const requestPath = path.join(attemptDirectory, 'inputs', `${String(index).padStart(2, '0')}-${path.basename(source)}`);
    await mkdir(path.dirname(requestPath), { recursive: true });
    await cp(source, requestPath, { recursive: true, force: false, errorOnExist: true });
    const stagedPackage = { source, staged: requestPath, absolute, digest };
    if (input.id !== undefined) stagedPackages.set(input.id, stagedPackage);
    stagedPackagesByIndex.set(index, stagedPackage);
  }
  for (const [index, input] of benchmarkCase.inputs.entries()) {
    if (input.role === 'package') {
      const stagedPackage = stagedPackagesByIndex.get(index);
      inputs.push({ ...input, path: stagedPackage.staged });
      inputArtifacts.push({ role: input.role, path: stagedPackage.absolute, stagedPath: stagedPackage.staged, ...stagedPackage.digest });
      continue;
    }
    let absolute = path.resolve(context.manifestDirectory, input.path);
    let requestPath = absolute;
    if (input.fromPackage !== undefined) {
      const linkedPackage = stagedPackages.get(input.fromPackage);
      const relative = path.relative(linkedPackage.source, path.resolve(linkedPackage.source, input.path));
      if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new RangeError(`${benchmarkCase.id} package-linked path must stay inside its package`);
      }
      const sourcePath = await realpath(path.resolve(linkedPackage.source, input.path));
      const sourceRelative = path.relative(linkedPackage.source, sourcePath);
      if (sourceRelative === '..' || sourceRelative.startsWith(`..${path.sep}`) || path.isAbsolute(sourceRelative)) {
        throw new RangeError(`${benchmarkCase.id} package-linked path resolves outside its package`);
      }
      if (!(await stat(sourcePath)).isFile()) throw new TypeError(`${benchmarkCase.id} package-linked path must be a file`);
      absolute = sourcePath;
      requestPath = path.resolve(linkedPackage.staged, input.path);
      const stagedRelative = path.relative(linkedPackage.staged, requestPath);
      if (stagedRelative === '..' || stagedRelative.startsWith(`..${path.sep}`) || path.isAbsolute(stagedRelative)) {
        throw new RangeError(`${benchmarkCase.id} package-linked path must stay inside its staged package`);
      }
    }
    const digest = await hashPath(absolute);
    inputs.push({ ...input, path: requestPath });
    inputArtifacts.push({ role: input.role, path: absolute, ...(requestPath !== absolute ? { stagedPath: requestPath } : {}), ...digest });
  }
  const request = {
    schemaVersion: 1,
    benchmarkName: context.manifest.name ?? path.basename(context.manifestPath),
    caseId: benchmarkCase.id,
    documentKind: benchmarkCase.documentKind,
    operation: benchmarkCase.operation,
    inputs,
    options: benchmarkCase.options ?? {},
    outputDirectory,
    resultPath,
  };
  const requestPath = path.join(attemptDirectory, 'request.json');
  await writeFile(requestPath, JSON.stringify(request, null, 2));

  const replace = value => value
    .replaceAll('{request}', requestPath)
    .replaceAll('{output}', outputDirectory)
    .replaceAll('{caseId}', benchmarkCase.id);
  const command = resolveCommand(replace(converter.command), context.manifestDirectory);
  const args = (converter.args ?? []).map(replace);
  const stdoutLog = path.join(attemptDirectory, 'stdout.log');
  const stderrLog = path.join(attemptDirectory, 'stderr.log');
  const startedEvent = { type: 'attempt-started', caseId: benchmarkCase.id, converterId: converter.id, attempt };
  await appendEvent(context.eventsPath, startedEvent);

  const execution = await execute(command, args, {
    cwd: converter.cwd ? path.resolve(context.manifestDirectory, converter.cwd) : context.manifestDirectory,
    env: { ...process.env, ...(converter.env ?? {}) },
    timeoutMs: benchmarkCase.timeoutMs ?? converter.timeoutMs ?? context.manifest.timeoutMs,
    stdout: stdoutLog,
    stderr: stderrLog,
  });

  let status = execution.timedOut ? 'timeout' : execution.error ? 'spawn-failed' : execution.code === 0 ? 'checking-output' : 'process-failed';
  let response;
  let error = execution.error;
  const outputArtifacts = [];
  if (status === 'process-failed') {
    let stderr = '';
    try { stderr = (await readFile(stderrLog, 'utf8')).trim(); } catch {}
    const excerpt = stderr.length > 2000
      ? `${stderr.slice(0, 1000)}\n... ${stderr.length - 2000} stderr characters omitted ...\n${stderr.slice(-1000)}`
      : stderr;
    error = `converter exited with code ${execution.code}${excerpt ? `: ${excerpt}` : ''}`;
  }
  if (status === 'checking-output') {
    try {
      response = requireObject(JSON.parse(await readFile(resultPath, 'utf8')), 'converter result');
      if (response.schemaVersion !== 1 || response.status !== 'completed' || !Array.isArray(response.artifacts)) {
        throw new TypeError('converter result must have schemaVersion 1, completed status, and artifacts');
      }
      const requiredRoles = benchmarkCase.operation === 'triggers-to-galaxy'
        ? ['script']
        : benchmarkCase.operation === 'galaxy-triggers-roundtrip'
          ? response.roundtripConversion?.status === 'failed' && response.originalConversion?.status === 'completed'
            ? ['original-script'] : response.roundtripConversion?.status === 'failed' ? [] : ['trigger-data', 'roundtrip-script']
          : ['trigger-data'];
      for (const role of requiredRoles) {
        if (!response.artifacts.some(artifact => artifact?.role === role)) {
          throw new TypeError(`converter result is missing required ${role} artifact`);
        }
      }
      for (const artifact of response.artifacts) {
        requireObject(artifact, 'artifact');
        if (typeof artifact.role !== 'string' || typeof artifact.path !== 'string') throw new TypeError('artifact needs string role and path');
        const absolute = path.resolve(outputDirectory, artifact.path);
        if (!inside(outputDirectory, absolute)) throw new TypeError(`artifact escapes output directory: ${artifact.path}`);
        const [canonicalRoot, canonicalArtifact] = await Promise.all([realpath(outputDirectory), realpath(absolute)]);
        if (!inside(canonicalRoot, canonicalArtifact)) throw new TypeError(`artifact link escapes output directory: ${artifact.path}`);
        outputArtifacts.push({ role: artifact.role, path: absolute, ...await hashPath(absolute) });
      }
      status = 'completed';
    } catch (caught) {
      status = 'invalid-output';
      error = String(caught);
    }
  }
  const result = {
    caseId: benchmarkCase.id,
    documentKind: benchmarkCase.documentKind ?? 'unspecified',
    tags: benchmarkCase.tags ?? [],
    operation: benchmarkCase.operation ?? 'galaxy-to-triggers',
    converterId: converter.id,
    attempt,
    status,
    ...execution,
    inputArtifacts,
    outputArtifacts,
    logFiles: { stdout: stdoutLog, stderr: stderrLog },
    diagnostics: response?.diagnostics ?? [],
    converterMetrics: response?.metrics,
    conversionQuality: response?.conversionQuality,
    originalConversion: response?.originalConversion,
    roundtripConversion: response?.roundtripConversion,
    goldenComparison: response?.goldenComparison,
    structuralComparison: response?.structuralComparison,
    guiComparison: response?.guiComparison,
    converterReport: response?.converterReport,
    ...(error ? { error } : {}),
  };
  if (status === 'completed' && !context.conversionOracle) {
    result.converterReport = {
      ...(result.converterReport ?? {}),
      selfReportedStructuralComparison: response?.structuralComparison,
      selfReportedGuiComparison: response?.guiComparison,
    };
    result.structuralComparison = undefined;
    result.guiComparison = ['galaxy-to-triggers', 'galaxy-triggers-roundtrip'].includes(result.operation)
      ? { status: 'inconclusive', reason: 'shared-oracle-not-configured' }
      : undefined;
  }
  if (context.conversionOracle && status === 'completed') {
    const inputsByRole = new Map(inputArtifacts.map(item => [item.role, item.path]));
    const outputsByRole = new Map(outputArtifacts.map(item => [item.role, item.path]));
    const isRoundtrip = result.operation === 'galaxy-triggers-roundtrip';
    const sourceRoles = isRoundtrip
      ? [['script', 'roundtrip-script'], ['header', 'roundtrip-header'],
          ['script', 'original-script'], ['header', 'original-header']]
      : result.operation === 'triggers-to-galaxy'
        ? [['expected-script', 'script'], ['expected-header', 'header']]
        : [];
    const comparisons = {};
    for (const [sourceRole, outputRole] of sourceRoles) {
      const sourcePath = inputsByRole.get(sourceRole);
      if (!sourcePath || (outputRole.startsWith('original-') && !inputsByRole.has('original-trigger-data'))) continue;
      const outputPath = outputsByRole.get(outputRole);
      if (!outputPath) {
        if (outputRole.startsWith('original-') && result.originalConversion?.status === 'failed') continue;
        comparisons[outputRole.startsWith('original-') ? (outputRole.endsWith('script') ? 'originalScript' : 'originalHeader')
          : outputRole === 'roundtrip-script' || outputRole === 'script' ? 'script' : 'header'] = {
          status: 'different', syntaxValid: true, exact: false, differenceSamples: [`missing ${outputRole} artifact`],
        };
        continue;
      }
      let comparison;
      try {
        const { expected, actual } = await readGalaxyComparisonPair(
          inputsByRole, outputsByRole, sourceRole, outputRole, benchmarkCase.options?.libraryId,
        );
        comparison = context.conversionOracle.compareGalaxy(
          expected, actual, {
            libraryId: benchmarkCase.options?.libraryId,
            implicitLibrary: benchmarkCase.options?.implicitLibrary,
          },
        );
      } catch (error) {
        comparison = { syntaxValid: false, exact: false, functions: { differenceSamples: [String(error)] } };
      }
      if (!comparison) continue;
      comparisons[outputRole.startsWith('original-') ? (outputRole.endsWith('script') ? 'originalScript' : 'originalHeader')
        : outputRole === 'roundtrip-script' || outputRole === 'script' ? 'script' : 'header'] = {
        status: !comparison.syntaxValid ? 'invalid-syntax' : comparison.exact ? 'equivalent' : 'different',
        syntaxValid: comparison.syntaxValid,
        exact: comparison.exact,
        // Equal only up to the forms the GUI writes for hand-written code: a difference, not an error.
        ...(comparison.tolerated === true ? { tolerated: true, equivalentFunctions: comparison.functions?.equivalent?.length ?? 0 } : {}),
        differenceSamples: comparison.functions?.differenceSamples ?? [],
      };
    }
    result.structuralComparison = comparisons;
    const expectedTriggerPath = inputsByRole.get('expected-trigger-data');
    const inputTriggerPath = inputsByRole.get('trigger-data');
    const outputTriggerPath = outputsByRole.get('trigger-data');
    const actualTriggerPath = result.operation === 'triggers-to-galaxy' ? inputTriggerPath : outputTriggerPath;
    const inputStringsPath = inputsByRole.get('trigger-strings');
    const actualStringsPath = result.operation === 'triggers-to-galaxy'
      ? inputStringsPath
      : outputsByRole.get('trigger-strings') ?? inputStringsPath;
    if (actualTriggerPath) {
      const [triggerData, triggerStrings] = await Promise.all([
        readFile(actualTriggerPath, 'utf8'), actualStringsPath ? readFile(actualStringsPath, 'utf8') : undefined,
      ]);
      const actualGui = await context.conversionOracle.inspectTriggerData(triggerData, triggerStrings);
      result.converterMetrics = { ...(result.converterMetrics ?? {}), guiFidelity: actualGui };
      if (expectedTriggerPath && outputTriggerPath) {
        const [expectedData, expectedStrings] = await Promise.all([
          readFile(expectedTriggerPath, 'utf8'), inputStringsPath ? readFile(inputStringsPath, 'utf8') : undefined,
        ]);
        const expectedGui = await context.conversionOracle.inspectTriggerData(expectedData, expectedStrings);
        result.guiComparison = expectedGui.elementCount === 0
          ? { status: 'inconclusive', reason: 'empty-trigger-data-baseline' }
          : context.conversionOracle.compareGuiFidelity(expectedGui, actualGui);
      } else if (['galaxy-to-triggers', 'galaxy-triggers-roundtrip'].includes(result.operation)) {
        result.guiComparison = { status: 'inconclusive', reason: 'independent-trigger-data-baseline-unavailable' };
      }
    } else if (['galaxy-to-triggers', 'galaxy-triggers-roundtrip'].includes(result.operation)) {
      result.guiComparison = { status: 'inconclusive', reason: 'trigger-data-output-unavailable' };
    }
  }
  result.correctness = assessCorrectness(result);
  await appendEvent(context.eventsPath, { type: 'attempt-finished', ...result });
  return result;
}

function counts(results, converters) {
  return Object.fromEntries(converters.map(converter => {
    const own = results.filter(result => result.converterId === converter.id);
    return [converter.id, own.reduce((summary, result) => {
      summary[result.status] = (summary[result.status] ?? 0) + 1;
      return summary;
    }, {})];
  }));
}

function qualityCounts(results, converters) {
  return Object.fromEntries(converters.map(converter => {
    const own = results.filter(result => result.converterId === converter.id);
    return [converter.id, own.reduce((summary, result) => {
      const quality = result.conversionQuality?.completeness ?? 'not-reported';
      summary[quality] = (summary[quality] ?? 0) + 1;
      for (const [role, comparison] of Object.entries(result.goldenComparison ?? {})) {
        const key = `golden-${role}-${comparison.exact ? 'match' : 'mismatch'}`;
        summary[key] = (summary[key] ?? 0) + 1;
      }
      for (const [role, comparison] of Object.entries(result.structuralComparison ?? {})) {
        const key = `ast-${role}-${comparison.status}`;
        summary[key] = (summary[key] ?? 0) + 1;
      }
      for (const diagnostic of result.diagnostics ?? []) {
        const severity = String(diagnostic.severity ?? 'unknown').toLowerCase();
        const key = `diagnostic-${severity}`;
        summary[key] = (summary[key] ?? 0) + 1;
        const code = String(diagnostic.code ?? 'unknown').slice(0, 120);
        summary.diagnosticCodes ??= Object.create(null);
        summary.diagnosticCodes[code || 'unknown'] = (summary.diagnosticCodes[code || 'unknown'] ?? 0) + 1;
      }
      for (const [type, count] of Object.entries(result.converterMetrics?.typeCounts ?? {})) {
        if (!Number.isFinite(count) || count < 0) continue;
        summary.elementTypes ??= {};
        summary.elementTypes[type] = (summary.elementTypes[type] ?? 0) + count;
      }
      const guiFidelity = result.converterMetrics?.guiFidelity;
      if (guiFidelity?.status) {
        const key = `gui-fidelity-${guiFidelity.status}`;
        summary[key] = (summary[key] ?? 0) + 1;
        for (const metric of ['guiTriggerCount', 'customScriptTagCount', 'triggerLocalVariableCount']) {
          if (!Number.isFinite(guiFidelity[metric])) continue;
          summary.guiMetrics ??= {};
          summary.guiMetrics[metric] = (summary.guiMetrics[metric] ?? 0) + guiFidelity[metric];
        }
      }
      if (result.guiComparison?.status) {
        const key = `gui-comparison-${result.guiComparison.status}`;
        summary[key] = (summary[key] ?? 0) + 1;
      }
      return summary;
    }, {})];
  }));
}

export function assessCorrectness(result) {
  if (['timeout', 'spawn-failed', 'process-failed', 'invalid-output'].includes(result.status)) return 'fail';
  if (result.status !== 'completed') return 'not-evaluated';
  const completeness = result.conversionQuality?.completeness?.toLowerCase();
  const diagnostics = result.diagnostics ?? [];
  const errors = diagnostics.some(item => ['error', 'fatal'].includes(String(item.severity ?? '').toLowerCase()));
  const galaxyValidation = String(result.conversionQuality?.galaxyValidation ?? '').toLowerCase();
  const validationFailed = ['failed', 'invalid', 'error'].includes(galaxyValidation);
  const validationIncomplete = galaxyValidation !== ''
    && !['passed', 'complete', 'valid', 'success', 'failed', 'invalid', 'error'].includes(galaxyValidation);
  const ast = Object.values(result.structuralComparison ?? {});
  const astMismatch = ast.some(item => ['different', 'invalid-syntax'].includes(item.status));
  const guiMismatch = result.guiComparison?.status === 'different';
  const guiRequired = ['galaxy-to-triggers', 'galaxy-triggers-roundtrip'].includes(result.operation);
  const guiUnproven = guiRequired && result.guiComparison?.status !== 'equivalent-structure';
  const dropped = Number(result.conversionQuality?.dropped ?? 0);
  const unsupported = Number(result.conversionQuality?.unsupported ?? 0);
  // In a direct Triggers → Galaxy check, an exact, valid Galaxy output proves
  // that unmodeled TriggerData metadata did not change the executable result.
  const exactForwardOutput = result.operation === 'triggers-to-galaxy' && galaxyValidation === 'passed'
    && dropped === 0 && ast.length > 0 && ast.every(item => item.status === 'equivalent');
  if (errors || validationFailed || astMismatch || guiMismatch || dropped > 0
      || (!exactForwardOutput && (completeness === 'partial' || unsupported > 0))) return 'fail';
  if ((completeness !== 'complete' && !exactForwardOutput) || ast.length === 0 || ast.some(item => item.status !== 'equivalent')
      || validationIncomplete || guiUnproven || result.guiComparison?.status === 'inconclusive') return 'inconclusive';
  if (unsupported > 0 || completeness === 'partial' || ast.some(item => item.tolerated)
      || diagnostics.some(item => String(item.severity ?? '').toLowerCase() === 'warning')) return 'warning';
  return 'pass';
}

function correctnessCounts(results, converters) {
  return Object.fromEntries(converters.map(converter => [
    converter.id,
    results.filter(result => result.converterId === converter.id).reduce((counts, result) => {
      const status = result.correctness ?? 'not-evaluated';
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {}),
  ]));
}

function caseCoverage(cases) {
  const countsBy = values => Object.fromEntries(values.reduce((counts, value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map()));
  return {
    caseCount: cases.length,
    documentKinds: countsBy(cases.map(item => item.documentKind ?? 'unspecified')),
    operations: countsBy(cases.map(item => item.operation ?? 'galaxy-to-triggers')),
    tags: countsBy(cases.flatMap(item => item.tags ?? [])),
  };
}

async function uniquePackageCount(cases, manifestDirectory) {
  const digests = new Set();
  for (const input of cases.flatMap(item => item.inputs).filter(item => item.role === 'package')) {
    const digest = await hashPath(path.resolve(manifestDirectory, input.path));
    digests.add(digest.sha256);
  }
  return digests.size;
}

function coverageGaps(cases, requirements) {
  const actual = caseCoverage(cases);
  const gaps = [];
  if (requirements.minCases !== undefined && actual.caseCount < requirements.minCases) {
    gaps.push({ dimension: 'caseCount', minimum: requirements.minCases, actual: actual.caseCount });
  }
  for (const [requirement, dimension] of [
    ['minDocumentKinds', 'documentKinds'],
    ['minOperations', 'operations'],
    ['minTags', 'tags'],
  ]) {
    for (const [key, minimum] of Object.entries(requirements[requirement] ?? {})) {
      const count = actual[dimension][key] ?? 0;
      if (count < minimum) gaps.push({ dimension, key, minimum, actual: count });
    }
  }
  return gaps;
}

function numericStats(results, field) {
  const values = results.map(result => result[field]).filter(Number.isFinite).sort((a, b) => a - b);
  if (values.length === 0) return { sampleCount: 0, min: null, median: null, max: null };
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 === 1 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  return { sampleCount: values.length, min: values[0], median, max: values.at(-1) };
}

function converterMetricStats(results, metric) {
  return numericStats(results.flatMap(result => Number.isFinite(result.converterMetrics?.[metric])
    ? [{ value: result.converterMetrics[metric] }]
    : []), 'value');
}

const CONVERTER_TIME_METRICS = ['conversionWallTimeMs', 'galaxyToTriggersMs', 'triggersToGalaxyMs'];

function performanceStats(results, converters, cases) {
  return Object.fromEntries(converters.map(converter => {
    const own = results.filter(result => result.converterId === converter.id);
    const casesById = Object.fromEntries(cases.map(benchmarkCase => {
      const attempts = own.filter(result => result.caseId === benchmarkCase.id);
      const matching = own.filter(result => result.caseId === benchmarkCase.id && result.status === 'completed');
      return [benchmarkCase.id, {
        allAttempts: {
          wallTimeMs: numericStats(attempts, 'wallTimeMs'),
          peakWorkingSetBytes: numericStats(attempts, 'peakWorkingSetBytes'),
          peakPagedMemorySizeBytes: numericStats(attempts, 'peakPagedMemorySizeBytes'),
        },
        wallTimeMs: numericStats(matching, 'wallTimeMs'),
        peakWorkingSetBytes: numericStats(matching, 'peakWorkingSetBytes'),
        peakPagedMemorySizeBytes: numericStats(matching, 'peakPagedMemorySizeBytes'),
        converterTimeMs: Object.fromEntries(CONVERTER_TIME_METRICS.map(metric => [metric, converterMetricStats(matching, metric)])),
      }];
    }));
    const completed = own.filter(result => result.status === 'completed');
    return [converter.id, {
      allAttempts: {
        wallTimeMs: numericStats(own, 'wallTimeMs'),
        peakWorkingSetBytes: numericStats(own, 'peakWorkingSetBytes'),
        peakPagedMemorySizeBytes: numericStats(own, 'peakPagedMemorySizeBytes'),
      },
      wallTimeMs: numericStats(completed, 'wallTimeMs'),
      peakWorkingSetBytes: numericStats(completed, 'peakWorkingSetBytes'),
      peakPagedMemorySizeBytes: numericStats(completed, 'peakPagedMemorySizeBytes'),
      converterTimeMs: Object.fromEntries(CONVERTER_TIME_METRICS.map(metric => [metric, converterMetricStats(completed, metric)])),
      cases: casesById,
    }];
  }));
}

export function rankConverters(results, converters, performance) {
  const entries = converters.map((converter, manifestOrder) => {
    const own = results.filter(result => result.converterId === converter.id);
    const correctness = own.reduce((counts, result) => {
      const status = result.correctness ?? 'not-evaluated';
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {});
    const total = own.length;
    const rate = status => total === 0 ? 1 : (correctness[status] ?? 0) / total;
    return {
      converterId: converter.id,
      attempts: total,
      correctness,
      rates: {
        fail: rate('fail'),
        pass: rate('pass'),
        warning: rate('warning'),
        inconclusive: rate('inconclusive'),
        notEvaluated: rate('not-evaluated'),
      },
      medianWallTimeMs: performance[converter.id]?.wallTimeMs.median ?? null,
      medianPeakWorkingSetBytes: performance[converter.id]?.peakWorkingSetBytes.median ?? null,
      _manifestOrder: manifestOrder,
    };
  });
  const metric = (value, fallback) => Number.isFinite(value) ? value : fallback;
  entries.sort((a, b) =>
    a.rates.fail - b.rates.fail
    || b.rates.pass - a.rates.pass
    || a.rates.inconclusive - b.rates.inconclusive
    || a.rates.notEvaluated - b.rates.notEvaluated
    || a.rates.warning - b.rates.warning
    || metric(a.medianWallTimeMs, Infinity) - metric(b.medianWallTimeMs, Infinity)
    || metric(a.medianPeakWorkingSetBytes, Infinity) - metric(b.medianPeakWorkingSetBytes, Infinity)
    || a._manifestOrder - b._manifestOrder);
  return entries.map(({ _manifestOrder, ...entry }, index) => ({ rank: index + 1, ...entry }));
}

export async function runBenchmark(manifestFile, outputRoot = '.benchmark-runs', { validateOnly = false, resumeDirectory } = {}) {
  const manifestPath = path.resolve(manifestFile);
  const manifestDirectory = path.dirname(manifestPath);
  const manifestText = await readFile(manifestPath, 'utf8');
  const manifest = validateManifest(JSON.parse(manifestText));
  const conversionOracle = manifest.astOracleModule
    ? await loadConversionOracle(manifest.astOracleModule, manifestDirectory)
    : null;
  if (manifest.astOracleModule && !conversionOracle.compareGalaxy) {
    throw new TypeError('astOracleModule does not expose a Galaxy AST comparator');
  }
  const coverageGapsFound = coverageGaps(manifest.cases, manifest.coverageRequirements ?? {});
  const uniquePackages = manifest.coverageRequirements?.minUniquePackages !== undefined
    ? await uniquePackageCount(manifest.cases, manifestDirectory)
    : null;
  if (manifest.coverageRequirements?.minUniquePackages !== undefined && uniquePackages < manifest.coverageRequirements.minUniquePackages) {
    coverageGapsFound.push({
      dimension: 'uniquePackageCount',
      minimum: manifest.coverageRequirements.minUniquePackages,
      actual: uniquePackages,
    });
  }
  if (coverageGapsFound.length) throw new RangeError(`manifest does not meet coverage requirements: ${JSON.stringify(coverageGapsFound)}`);
  const inputValidation = await validateInputPaths(manifest.cases, manifestDirectory);
  if (validateOnly) {
    return {
      schemaVersion: 1,
      name: manifest.name ?? path.basename(manifestPath),
      valid: true,
      manifestPath,
      caseCount: manifest.cases.length,
      converterCount: manifest.converters.length,
      caseCoverage: { ...caseCoverage(manifest.cases), uniquePackageCount: uniquePackages },
      coverageRequirements: manifest.coverageRequirements ?? null,
      ...inputValidation,
    };
  }
  const runId = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const runDirectory = resumeDirectory
    ? path.resolve(resumeDirectory)
    : path.resolve(outputRoot, `${manifest.name ?? 'benchmark'}-${runId}`);
  const eventsPath = path.join(runDirectory, 'events.jsonl');
  await mkdir(runDirectory, { recursive: true });
  const context = { manifest, manifestPath, manifestDirectory, runDirectory, eventsPath, conversionOracle };
  const planned = manifest.cases.flatMap(benchmarkCase =>
    Array.from({ length: manifest.repetitions }, (_, index) => {
      const attempt = index + 1;
      const ordered = attempt % 2 === 1 ? manifest.converters : [...manifest.converters].reverse();
      return ordered.map(converter => ({ benchmarkCase, attempt, converter }));
    }).flat());
  let startedAt = new Date().toISOString();
  const results = [];

  if (resumeDirectory) {
    const eventLines = (await readFile(eventsPath, 'utf8')).split('\n').filter(Boolean);
    const events = eventLines.map((line, index) => {
      try { return JSON.parse(line); }
      catch (error) {
        if (index === eventLines.length - 1) return null; // Interrupted append; preserve the bytes.
        throw new SyntaxError(`Invalid benchmark event at line ${index + 1}: ${error}`);
      }
    }).filter(Boolean);
    startedAt = events[0]?.timestamp ?? startedAt;
    const finished = events.filter(event => event.type === 'attempt-finished');
    if (finished.length > planned.length) throw new Error('Resume journal has more attempts than the manifest');
    for (const [index, result] of finished.entries()) {
      const expected = planned[index];
      if (result.caseId !== expected.benchmarkCase.id || result.converterId !== expected.converter.id || result.attempt !== expected.attempt) {
        throw new Error(`Resume journal does not match the manifest at attempt ${index + 1}`);
      }
      const packages = expected.benchmarkCase.inputs.filter(input => input.role === 'package');
      const actualPackages = result.inputArtifacts?.filter(input => input.role === 'package') ?? [];
      if (packages.length !== actualPackages.length || packages.some((input, item) =>
        path.resolve(manifestDirectory, input.path).toLowerCase() !== actualPackages[item]?.path?.toLowerCase())) {
        throw new Error(`Resume inputs do not match the manifest at attempt ${index + 1}`);
      }
      results.push(result);
    }
    const next = planned[results.length];
    if (next) {
      const incomplete = path.join(runDirectory, 'cases', next.benchmarkCase.id, next.converter.id,
        `attempt-${String(next.attempt).padStart(2, '0')}`);
      if (await stat(incomplete).then(() => true, error => {
        if (error.code === 'ENOENT') return false;
        throw error;
      })) {
        await rename(incomplete, `${incomplete}-interrupted-${runId}`);
      }
    }
    if (eventLines.length && !((await readFile(eventsPath, 'utf8')).endsWith('\n'))) await appendFile(eventsPath, '\n');
  }

  for (const { benchmarkCase, attempt, converter } of planned.slice(results.length)) {
    results.push(await runAttempt(context, converter, benchmarkCase, attempt));
  }

  const measuredPerformance = performanceStats(results, manifest.converters, manifest.cases);
  const summary = {
    schemaVersion: 1,
    name: manifest.name ?? path.basename(manifestPath),
    runDirectory,
    startedAt,
    finishedAt: new Date().toISOString(),
    manifestPath,
    manifestSha256: createHash('sha256').update(manifestText).digest('hex'),
    coverageRequirements: manifest.coverageRequirements ?? null,
    platform: { os: process.platform, arch: process.arch, node: process.version },
    counts: counts(results, manifest.converters),
    caseCoverage: { ...caseCoverage(manifest.cases), uniquePackageCount: uniquePackages },
    qualityCounts: qualityCounts(results, manifest.converters),
    correctnessCounts: correctnessCounts(results, manifest.converters),
    performanceStats: measuredPerformance,
    ranking: rankConverters(results, manifest.converters, measuredPerformance),
    reportFiles: { json: 'report.json', html: 'report.html' },
    results,
  };
  await writeReport(summary);
  await writeFile(path.join(runDirectory, 'summary.json'), JSON.stringify(summary, null, 2));
  await writeRunHistory(resumeDirectory ? path.dirname(runDirectory) : outputRoot);
  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  const validateOnly = args.includes('--validate-only');
  const noOpen = args.includes('--no-open');
  const positional = args.filter(argument => !['--validate-only', '--no-open'].includes(argument));
  const manifest = positional.shift();
  let output;
  let resumeDirectory;
  while (positional.length) {
    const flag = positional.shift();
    const value = positional.shift();
    if (!value || (flag !== '--output' && flag !== '--resume') || (flag === '--output' && output) || (flag === '--resume' && resumeDirectory)) {
      console.error('Usage: node src/benchmark.mjs <manifest.json> [--output <directory>] [--resume <run-directory>] [--validate-only] [--no-open]');
      process.exitCode = 2;
      return;
    }
    if (flag === '--output') output = value;
    else resumeDirectory = value;
  }
  if (!manifest) {
    console.error('Usage: node src/benchmark.mjs <manifest.json> [--output <directory>] [--resume <run-directory>] [--validate-only] [--no-open]');
    process.exitCode = 2;
    return;
  }
  const summary = await runBenchmark(manifest, output, { validateOnly, resumeDirectory });
  if (validateOnly) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  console.log(JSON.stringify({
    runDirectory: summary.runDirectory,
    reportJson: path.join(summary.runDirectory, 'report.json'),
    reportHtml: path.join(summary.runDirectory, 'report.html'),
    historyHtml: path.join(path.dirname(summary.runDirectory), 'history.html'),
    counts: summary.counts,
    caseCoverage: summary.caseCoverage,
    coverageRequirements: summary.coverageRequirements,
    correctnessCounts: summary.correctnessCounts,
    ranking: summary.ranking,
    performanceStats: Object.fromEntries(Object.entries(summary.performanceStats).map(([id, stats]) => [id, {
      wallTimeMs: stats.wallTimeMs,
      peakWorkingSetBytes: stats.peakWorkingSetBytes,
      peakPagedMemorySizeBytes: stats.peakPagedMemorySizeBytes,
      allAttempts: stats.allAttempts,
      converterTimeMs: stats.converterTimeMs,
    }])),
  }, null, 2));
  if (!noOpen) {
    try { openReport(path.join(summary.runDirectory, 'report.html')); }
    catch (error) { console.error(`Could not open HTML report: ${error.message}`); }
  }
  if (summary.results.some(result => result.status !== 'completed' || result.correctness === 'fail')) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

/** Local desktop bridge. Only bundled CLI jobs and their own allowlisted artifacts
 * are exposed. The authenticated picker lists paths without shell commands. */
import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { adapters, selectAdapter } from './adapters.js';
import type { JobSnapshot, RecoveryRequest, Artifact } from './contracts.js';
import { discoverDefaults } from './defaults.js';
import { listFiles, filePlaces } from './files.js';
import { createPreferenceStore } from './preferences.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const assets = path.join(root, 'gui');
const defaults = await discoverDefaults(root);
const token = randomBytes(32).toString('hex');
const preferences = createPreferenceStore();
const limit = 2 * 1024 * 1024;
const triggerXmlTitle = 'candidates/recovered/generated/Triggers';
const triggerXmlId = 'recovered-triggers';
let state: JobSnapshot = { phase: 'idle', log: '', artifacts: [] };
let worker: ChildProcess | undefined;
let retainedWorker: ChildProcess | undefined;
let retainedInstallation: string | undefined;
let starting = false;
let inspecting = false;
let artifacts = new Map<string, string>();
let progressTail = '';
const log = (chunk: string) => {
  state.log = (state.log + chunk).slice(-limit);
  const lines = (progressTail + chunk).split(/\r?\n/);
  progressTail = lines.pop()!.slice(-65536);
  for (const line of lines) {
    if (line.startsWith('trigger-recovery: ')) state.error = line.slice(18);
    try {
      const event = JSON.parse(line);
      if (event.type === 'triggers-ready' && state.phase === 'running' && state.output) {
        const ready: Artifact = { id: triggerXmlId, title: triggerXmlTitle, kind: 'markup' };
        artifacts.set(ready.id, path.join(state.output, triggerXmlTitle));
        state.recoveredMarkup = ready;
        state.artifacts = [ready];
      }
      if (
        event.type === 'progress' &&
        Number.isFinite(event.percent) &&
        typeof event.stage === 'string'
      ) {
        state.progress = {
          percent: Math.max(
            state.progress?.percent ?? 0,
            Math.min(99, Math.max(0, Math.floor(event.percent))),
          ),
          stage: event.stage.slice(0, 200),
        };
      }
    } catch {
      /* Worker diagnostics are also plain text. */
    }
  }
};

async function collectArtifacts(output: string) {
  output = await fs.realpath(output);
  const found: Artifact[] = [];
  const collected = new Map<string, string>();
  try {
    state.result = JSON.parse(
      await fs.readFile(path.join(output, 'candidates/recovered/RESULT.json'), 'utf8'),
    );
  } catch {
    /* A preparation refusal may precede the worker report. */
  }
  const report = state.result as
    | {
        originalUnchanged?: boolean;
        status?: string;
        variants?: {
          status?: string;
          candidate?: string;
          packedCandidate?: string;
          mode?: string;
        }[];
        packedCandidate?: string;
        unverifiedPreview?: { draftMap?: { path?: string } };
      }
    | undefined;
  const variants = Array.isArray(report?.variants) ? report.variants : [];
  const reportedCandidates = variants
    .filter(
      (variant) =>
        (variant?.status === 'STATIC_MATCH_EDITOR_PENDING' ||
          variant?.status === 'REVIEW_REQUIRED_EDITOR_PENDING') &&
        typeof variant.candidate === 'string' &&
        path.isAbsolute(variant.candidate),
    )
    .map((variant) => ({
      file: path.resolve(variant.candidate!),
      withAttributes: variant.mode === 'with-attribute-recovery',
      draft: report?.status === 'FAILED' || report?.originalUnchanged !== true,
    }));
  if (report?.status === 'FAILED' || report?.status === 'PARTIAL_DEPENDENCY_RECOVERY') {
    for (const candidate of [
      ...variants.map((variant) => variant?.packedCandidate),
      report.packedCandidate,
      report.unverifiedPreview?.draftMap?.path,
    ]) {
      if (typeof candidate === 'string' && path.isAbsolute(candidate)) {
        const file = path.resolve(candidate);
        if (!reportedCandidates.some((record) => record.file === file))
          reportedCandidates.push({ file, withAttributes: false, draft: true });
      }
    }
  }
  const permittedArchives = new Map(reportedCandidates.map(({ file, draft }) => [file, draft]));
  const candidates = new Map<string, Artifact>();
  async function visit(directory: string, depth: number) {
    if (depth > 5) return;
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      if (found.length >= 1000) return;
      const file = path.join(directory, item.name);
      // Never follow reparse points into a different job or user directory.
      if (item.isSymbolicLink()) continue;
      if (item.isDirectory()) {
        if (item.name !== 'inputs') await visit(file, depth + 1);
      } else if (
        item.isFile() &&
        (/\.(galaxy|sc2map|sc2mod)$/i.test(item.name) ||
          item.name === 'Triggers' ||
          item.name === 'ORIGINAL_AUTHORED_TRIGGERS.xml' ||
          item.name === 'preparation.json' ||
          /^(RESULT|PREVIEW_REPORT|SOURCE_(?:DIAGNOSTICS|REPAIR)|DECLARATION_DIFF|AUTHORED_DEPENDENCY_SCOPE|DEPENDENCY_WARNINGS|ATTRIBUTE.*|MANIFEST|STRICT_BENCHMARK)\.json$/i.test(
            item.name,
          ))
      ) {
        const title = path.relative(output, file).replaceAll('\\', '/');
        const isArchive = /\.sc2(map|mod)$/i.test(file);
        // The worker reports a candidate only after reading its packed Triggers.
        if (isArchive && (!title.startsWith('candidates/') || !permittedArchives.has(file)))
          continue;
        const kind = isArchive
          ? 'archive'
          : /\.galaxy$/i.test(file)
            ? 'script'
            : item.name === 'Triggers'
              ? 'markup'
              : 'report';
        const id = title === triggerXmlTitle ? triggerXmlId : String(found.length);
        collected.set(id, file);
        const artifact = {
          id,
          title,
          kind,
          ...(permittedArchives.get(file) ? { draft: true } : {}),
        } satisfies Artifact;
        found.push(artifact);
        if (isArchive) candidates.set(file, artifact);
      }
    }
  }
  await visit(output, 0);
  artifacts = collected;
  state.artifacts = found;
  const preferred = reportedCandidates.find(
    ({ file, withAttributes, draft }) => !draft && withAttributes && candidates.has(file),
  );
  state.recoveredArchive = preferred
    ? candidates.get(preferred.file)
    : reportedCandidates.map(({ file }) => candidates.get(file)).find(Boolean);
  state.recoveredMarkup =
    found.find((artifact) =>
      /^candidates\/recovered\/[^/]+\/components\/Triggers$/u.test(artifact.title),
    ) ??
    found.find((artifact) => artifact.title === 'candidates/recovered/Triggers') ??
    found.find(
      (artifact) => artifact.title === 'candidates/recovered/UNVERIFIED_PREVIEW/Triggers',
    ) ??
    found.find((artifact) => artifact.title === triggerXmlTitle);
}

function recoveryWorker(installation: string) {
  const directory = path.resolve(installation);
  const key = process.platform === 'win32' ? directory.toLowerCase() : directory;
  if (retainedWorker?.connected && retainedInstallation === key) return retainedWorker;
  if (retainedWorker?.connected) retainedWorker.disconnect();
  const processWorker = spawn(
    process.execPath,
    [path.join(root, 'src', 'cli', 'desktop-recovery-worker.mjs')],
    { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
  );
  retainedWorker = processWorker;
  retainedInstallation = key;
  processWorker.stdout!.resume();
  processWorker.stderr!.resume();
  processWorker.on('error', () => {});
  processWorker.once('close', () => {
    if (retainedWorker === processWorker) retainedWorker = undefined;
  });
  return processWorker;
}

async function startJob(request: RecoveryRequest) {
  if (inspecting) throw Error('Wait for the archive preview to finish.');
  if (starting || worker || state.phase === 'running')
    throw Error('A recovery job is already running.');
  if (request?.adapter === 'sc2' && request.fields && typeof request.fields === 'object') {
    request = {
      ...request,
      fields: {
        ...request.fields,
        installation: request.fields.installation?.trim() || defaults.installation,
        benchmark: request.fields.benchmark?.trim() || defaults.benchmark,
      },
    };
  }
  const adapter = selectAdapter(request);
  starting = true;
  try {
    const output = path.resolve(request.fields.output!);
    try {
      await fs.lstat(output);
      throw Error('Choose a NEW output folder; existing data will not be overwritten.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const args = adapter.command(request, root);
    artifacts = new Map();
    progressTail = '';
    state = {
      phase: 'running',
      log: 'Preparing a separate candidate...\n',
      output,
      artifacts: [],
      request,
      progress: { percent: 0, stage: 'Starting recovery' },
    };
    const installedMap = args.includes('--sc2') && /\.sc2map$/iu.test(request.fields.input ?? '');
    const jobWorker = installedMap
      ? recoveryWorker(request.fields.installation!)
      : spawn(process.execPath, args, {
          cwd: root,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
    worker = jobWorker;
    jobWorker.stdout!.setEncoding('utf8').on('data', log);
    jobWorker.stderr!.setEncoding('utf8').on('data', log);
    const onError = (error: Error) => log(error.message + '\n');
    const onDone = (message: unknown) => {
      const done = message as { type?: string; code?: number } | null;
      if (done?.type === 'recovery-done' && Number.isInteger(done.code)) void finish(done.code!);
    };
    let finalizing = false;
    const finish = async (code: number | null) => {
      if (finalizing) return;
      finalizing = true;
      jobWorker.off('error', onError);
      jobWorker.off('close', finish);
      jobWorker.off('message', onDone);
      const cancelled = state.phase === 'cancelled';
      try {
        await collectArtifacts(output);
      } catch (error) {
        log(String(error) + '\n');
      }
      jobWorker.stdout!.off('data', log);
      jobWorker.stderr!.off('data', log);
      state.exitCode = code ?? 1;
      state.phase = cancelled ? 'cancelled' : code === 0 ? 'finished' : 'failed';
      if (code === 0 && !cancelled) state.progress = { percent: 100, stage: 'Complete' };
      if (state.phase === 'failed') {
        const report = state.result as
          | { error?: string; variants?: { error?: string }[] }
          | undefined;
        state.error ??=
          (report?.error || report?.variants?.find((variant) => variant.error)?.error)?.split(
            '\n',
          )[0] || 'Recovery failed. Open GEN INFO for the diagnostic log.';
      }
      log(`\nProcess exit code: ${code}. Inspect evidence; completion is not Editor acceptance.\n`);
      worker = undefined;
    };
    jobWorker.once('error', onError);
    jobWorker.once('close', finish);
    if (installedMap) {
      jobWorker.on('message', onDone);
      jobWorker.send(
        { type: 'recover', args: args.slice(1), installation: request.fields.installation },
        (error) => {
          if (!error) return;
          onError(error);
          void finish(1);
        },
      );
    }
  } finally {
    starting = false;
  }
}

async function cancelJob() {
  if (!worker || state.phase !== 'running') return;
  const cancelledWorker = worker;
  if (retainedWorker === cancelledWorker) retainedWorker = undefined;
  state.phase = 'cancelled';
  // Cancel the CLI's complete process tree, including its converter child.
  if (process.platform === 'win32') {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('taskkill.exe', ['/PID', String(cancelledWorker.pid), '/T', '/F'], {
        windowsHide: true,
      });
      child.once('error', reject);
      child.once('close', () => resolve());
    });
  } else cancelledWorker.kill('SIGTERM');
}

async function body(req: http.IncomingMessage) {
  let bytes = 0,
    chunks = '';
  req.setEncoding('utf8');
  for await (const chunk of req) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 128 * 1024) throw Error('Request too large.');
    chunks += chunk;
  }
  return JSON.parse(chunks || '{}');
}
function json(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  );
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    const expectedHost = '127.0.0.1:' + (server.address() as import('node:net').AddressInfo).port;
    if (
      req.headers.host !== expectedHost ||
      (req.headers.origin && req.headers.origin !== 'http://' + expectedHost)
    )
      return json(res, { error: 'Local origin required.' }, 403);
    const url = new URL(req.url!, 'http://' + expectedHost);
    if (url.pathname.startsWith('/api/')) {
      if (req.headers['x-recovery-token'] !== token)
        return json(res, { error: 'Session token required.' }, 403);
      if (req.method === 'GET' && url.pathname === '/api/state') return json(res, state);
      if (req.method === 'GET' && url.pathname === '/api/places')
        return json(res, await filePlaces());
      if (req.method === 'GET' && url.pathname === '/api/defaults') return json(res, defaults);
      if (req.method === 'GET' && url.pathname === '/api/preferences')
        return json(res, await preferences.read());
      if (req.method === 'POST' && url.pathname === '/api/preferences')
        return json(res, await preferences.write(await body(req)));
      if (req.method === 'POST' && url.pathname === '/api/library-root') {
        const input = await body(req);
        const { normalizeLibraryRoots } = await import(
          new URL('../../src/libraries/local-roots.mjs', import.meta.url).href
        );
        const roots = await normalizeLibraryRoots([input.path]);
        return json(res, { path: roots[0] });
      }
      if (req.method === 'POST' && url.pathname === '/api/music') {
        const input = await body(req);
        if (typeof input.path !== 'string' || !/\.(wav|mp3|ogg|m4a)$/i.test(input.path))
          throw Error('Choose a supported local audio file.');
        const file = await fs.realpath(input.path),
          info = await fs.stat(file);
        if (!info.isFile() || info.size > 64 * 1024 ** 2)
          throw Error('Audio exceeds 64 MiB or is not a file.');
        const types: Record<string, string> = {
          '.wav': 'audio/wav',
          '.mp3': 'audio/mpeg',
          '.ogg': 'audio/ogg',
          '.m4a': 'audio/mp4',
        };
        res.writeHead(200, {
          'Content-Type': types[path.extname(file).toLowerCase()]!,
          'Cache-Control': 'no-store',
        });
        const stream = createReadStream(file);
        stream.on('error', () => res.destroy());
        stream.pipe(res);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/adapters')
        return json(
          res,
          adapters.map(({ info }) =>
            defaults.installation === path.join(root, '.runtime', 'public-resources')
              ? {
                  ...info,
                  fields: info.fields.map((field) =>
                    field.key === 'installation'
                      ? {
                          ...field,
                          label: 'Metadata folder',
                          help: 'The Standalone snapshot is selected automatically. You can also choose an installed StarCraft II folder.',
                        }
                      : field,
                  ),
                }
              : info,
          ),
        );
      if (req.method === 'POST' && url.pathname === '/api/inspect') {
        if (worker || starting || inspecting) throw Error('Finish the active operation first.');
        const input = await body(req);
        const adapter = adapters.find((a) => a.info.id === input.adapter);
        if (!adapter) throw Error('Unsupported recovery adapter.');
        inspecting = true;
        try {
          const preview = await adapter.inspect(input.path);
          state = {
            phase: 'idle',
            log: 'Original archive opened read-only. No recovery job started.\n',
            artifacts: [],
          };
          artifacts = new Map();
          return json(res, preview);
        } finally {
          inspecting = false;
        }
      }
      if (req.method === 'GET' && ['/api/artifact', '/api/download'].includes(url.pathname)) {
        const file = artifacts.get(url.searchParams.get('id') ?? '');
        if (!file) throw Error('Unknown job artifact.');
        const actual = await fs.realpath(file),
          output = await fs.realpath(state.output!);
        const relative = path.relative(output, actual);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
          throw Error('Artifact escaped output.');
        const download = url.pathname === '/api/download';
        if ((await fs.stat(actual)).size > (download ? 128 : 16) * 1024 * 1024)
          throw Error('Artifact exceeds preview limit; open it from the output folder.');
        if (download) {
          res.writeHead(200, {
            'Content-Type': 'application/octet-stream',
            'Cache-Control': 'no-store',
          });
          const stream = createReadStream(actual);
          stream.on('error', () => res.destroy());
          stream.pipe(res);
          return;
        }
        return json(res, { text: await fs.readFile(actual, 'utf8') });
      }
      if (req.method === 'POST' && url.pathname === '/api/recover') {
        await startJob(await body(req));
        return json(res, state);
      }
      if (req.method === 'POST' && url.pathname === '/api/cancel') {
        await cancelJob();
        return json(res, state);
      }
      if (req.method === 'POST' && url.pathname === '/api/files') {
        const input = await body(req);
        return json(res, await listFiles(input.kind, input.path));
      }
      if (req.method === 'POST' && url.pathname === '/api/shutdown') {
        if (starting || worker || inspecting)
          throw Error('Finish or cancel the active operation first.');
        json(res, { closed: true });
        server.close();
        return;
      }
      return json(res, { error: 'Unknown operation.' }, 404);
    }
    if (req.method !== 'GET') return json(res, { error: 'Method not allowed.' }, 405);
    const files: Record<string, [string, string]> = {
      '/': ['index.html', 'text/html; charset=utf-8'],
      '/app.js': ['dist/app.js', 'text/javascript'],
      '/picker.js': ['dist/picker.js', 'text/javascript'],
      '/hierarchy.js': ['dist/hierarchy.js', 'text/javascript'],
      '/search.js': ['dist/search.js', 'text/javascript'],
      '/settings-view.js': ['dist/settings-view.js', 'text/javascript'],
      '/code-view.js': ['dist/code-view.js', 'text/javascript'],
      '/favicon.ico': ['favicon.ico', 'image/x-icon'],
      '/style.css': ['style.css', 'text/css'],
    };
    const asset = files[url.pathname];
    if (!asset) return json(res, { error: 'Not found.' }, 404);
    const bytes = await fs.readFile(path.join(assets, asset[0]));
    const content =
      url.pathname === '/' ? bytes.toString('utf8').replace('__SESSION_TOKEN__', token) : bytes;
    res.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store' });
    res.end(content);
  } catch (error) {
    json(res, { error: (error as Error).message }, 400);
  }
});
server.once('close', () => {
  if (retainedWorker?.connected) retainedWorker.disconnect();
});
server.listen(0, '127.0.0.1', () => {
  const url = 'http://127.0.0.1:' + (server.address() as import('node:net').AddressInfo).port;
  console.log('Recovery GUI: ' + url);
  if (
    defaults.installation &&
    defaults.installation !== path.join(root, '.runtime', 'public-resources')
  ) {
    recoveryWorker(defaults.installation).send(
      { type: 'preload', installation: defaults.installation },
      () => {},
    );
  }
  if (!process.argv.includes('--no-open') && process.platform === 'win32') {
    const browser = spawn('explorer.exe', [url], { windowsHide: true });
    browser.once('error', (error) => console.error('Open the URL manually: ' + error.message));
  }
});

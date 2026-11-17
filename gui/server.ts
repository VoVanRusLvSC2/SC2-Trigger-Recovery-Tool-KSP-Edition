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
import { listFiles } from './files.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const assets = path.join(root, 'gui');
const defaults = await discoverDefaults(root);
const token = randomBytes(32).toString('hex');
const limit = 2 * 1024 * 1024;
let state: JobSnapshot = { phase: 'idle', log: '', artifacts: [] };
let worker: ChildProcess | undefined;
let starting = false;
let inspecting = false;
let artifacts = new Map<string, string>();
const log = (chunk: string) => {
  state.log = (state.log + chunk).slice(-limit);
};

async function collectArtifacts(output: string) {
  const found: Artifact[] = [];
  artifacts = new Map();
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
        (/\.(galaxy|sc2map)$/i.test(item.name) ||
          item.name === 'Triggers' ||
          item.name === 'preparation.json' ||
          /^(RESULT|PREVIEW_REPORT|ATTRIBUTE.*|MANIFEST|STRICT_BENCHMARK)\.json$/i.test(item.name))
      ) {
        const title = path.relative(output, file).replaceAll('\\', '/');
        const kind = /\.sc2map$/i.test(file)
          ? 'archive'
          : /\.galaxy$/i.test(file)
            ? 'script'
            : item.name === 'Triggers'
              ? 'markup'
              : 'report';
        const id = String(found.length);
        artifacts.set(id, file);
        found.push({ id, title, kind });
      }
    }
  }
  await visit(output, 0);
  state.artifacts = found;
  try {
    state.result = JSON.parse(
      await fs.readFile(path.join(output, 'candidates/recovered/RESULT.json'), 'utf8'),
    );
  } catch {
    /* A preparation refusal may precede the worker report. */
  }
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
    state = {
      phase: 'running',
      log: 'Preparing a separate candidate...\n',
      output,
      artifacts: [],
      request,
    };
    worker = spawn(process.execPath, args, {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    worker.stdout!.setEncoding('utf8').on('data', log);
    worker.stderr!.setEncoding('utf8').on('data', log);
    worker.once('error', (error) => log(error.message + '\n'));
    worker.once('close', async (code) => {
      const cancelled = state.phase === 'cancelled';
      try {
        await collectArtifacts(output);
      } catch (error) {
        log(String(error) + '\n');
      }
      state.exitCode = code ?? 1;
      state.phase = cancelled ? 'cancelled' : code === 0 ? 'finished' : 'failed';
      log(`\nProcess exit code: ${code}. Inspect evidence; completion is not Editor acceptance.\n`);
      worker = undefined;
    });
  } finally {
    starting = false;
  }
}

async function cancelJob() {
  if (!worker || state.phase !== 'running') return;
  state.phase = 'cancelled';
  // Cancel the CLI's complete process tree, including its converter child.
  if (process.platform === 'win32') {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('taskkill.exe', ['/PID', String(worker!.pid), '/T', '/F'], {
        windowsHide: true,
      });
      child.once('error', reject);
      child.once('close', () => resolve());
    });
  } else worker.kill('SIGTERM');
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
    "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'",
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
      if (req.method === 'GET' && url.pathname === '/api/defaults') return json(res, defaults);
      if (req.method === 'GET' && url.pathname === '/api/adapters')
        return json(
          res,
          adapters.map((a) => a.info),
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
    if (url.pathname === '/favicon.ico') {
      res.writeHead(204);
      res.end();
      return;
    }
    const files: Record<string, [string, string]> = {
      '/': ['index.html', 'text/html; charset=utf-8'],
      '/app.js': ['dist/app.js', 'text/javascript'],
      '/style.css': ['style.css', 'text/css'],
    };
    const asset = files[url.pathname];
    if (!asset) return json(res, { error: 'Not found.' }, 404);
    let content = await fs.readFile(path.join(assets, asset[0]), 'utf8');
    if (url.pathname === '/') content = content.replace('__SESSION_TOKEN__', token);
    res.writeHead(200, { 'Content-Type': asset[1], 'Cache-Control': 'no-store' });
    res.end(content);
  } catch (error) {
    json(res, { error: (error as Error).message }, 400);
  }
});
server.listen(0, '127.0.0.1', () => {
  const url = 'http://127.0.0.1:' + (server.address() as import('node:net').AddressInfo).port;
  console.log('Recovery GUI: ' + url);
  if (!process.argv.includes('--no-open') && process.platform === 'win32') {
    const browser = spawn('explorer.exe', [url], { windowsHide: true });
    browser.once('error', (error) => console.error('Open the URL manually: ' + error.message));
  }
});

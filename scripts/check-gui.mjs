/** Exercise the actual desktop bridge: authorization, literal argv, failure
 * reporting, immutable inputs and explicit shutdown. No game/Editor required. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { selectAdapter } from '../gui/dist/adapters.js';

const root = path.resolve(import.meta.dirname, '..');
const request = {
  adapter: 'sc2',
  fields: {
    input: 'C:\\maps\\a & $(literal).SC2Map',
    installation: 'C:\\SC2',
    output: 'C:\\new',
    attributeIndex: 'C:\\proof.json',
  },
  fullGui: false,
};
const argv = selectAdapter(request).command(request, root);
assert.equal(argv[2], request.fields.input);
assert(argv.includes('--attribute-index'));
assert(!argv.includes('--full-gui'));
assert.throws(() => selectAdapter({ ...request, adapter: 'invented' }), /Unsupported/);
assert.throws(() => selectAdapter({ ...request, fields: {} }), /Choose/);

const child = spawn(process.execPath, ['gui/dist/server.js', '--no-open'], {
  cwd: root,
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '',
  stderr = '';
child.stdout.setEncoding('utf8').on('data', (s) => {
  output += s;
});
child.stderr.setEncoding('utf8').on('data', (s) => {
  stderr += s;
});
const exited = once(child, 'exit');
async function eventually(check, label) {
  for (let i = 0; i < 300; i++) {
    const value = await check();
    if (value) return value;
    if (child.exitCode !== null) throw Error('GUI stopped early: ' + stderr);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error('GUI check timed out: ' + label);
}
try {
  const url = await eventually(() => output.match(/http:\/\/127\.0\.0\.1:\d+/u)?.[0], 'listen');
  const home = await fetch(url);
  const html = await home.text();
  assert(home.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
  const token = html.match(/name="session-token" content="([a-f0-9]+)"/u)?.[1];
  assert(token && token.length === 64);
  assert.equal((await fetch(url + '/api/state')).status, 403);
  assert.equal(
    (
      await fetch(url + '/api/state', {
        headers: { 'X-Recovery-Token': token, Origin: 'https://hostile.example' },
      })
    ).status,
    403,
  );
  assert.equal((await fetch(url + '/../../package.json')).status, 404);
  assert.equal((await fetch(url + '/app.js')).status, 200);
  async function api(route, data) {
    const response = await fetch(url + '/api/' + route, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'X-Recovery-Token': token, 'Content-Type': 'application/json' },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: response.status, value: await response.json() };
  }
  assert.equal((await api('adapters')).value[0].id, 'sc2');
  assert.equal((await api('artifact?id=../../package.json')).status, 400);
  assert.equal((await api('download?id=../../package.json')).status, 400);
  assert.equal((await api('inspect', { adapter: 'other', path: 'anything' })).status, 400);
  assert.equal((await api('recover', { ...request, adapter: 'other' })).status, 400);
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'recovery-gui-'));
  const original = path.join(temporary, 'original.SC2Map');
  await fs.writeFile(original, 'deliberately invalid archive');
  assert.equal((await api('inspect', { adapter: 'sc2', path: original })).status, 400);
  assert.equal(await fs.readFile(original, 'utf8'), 'deliberately invalid archive');
  const fields = { input: original, installation: temporary, output: temporary };
  assert.equal((await api('recover', { adapter: 'sc2', fields, fullGui: false })).status, 400);
  fields.output = path.join(temporary, 'new-output');
  const started = await api('recover', { adapter: 'sc2', fields, fullGui: false });
  assert.equal(started.value.phase, 'running');
  assert.equal((await api('recover', { adapter: 'sc2', fields, fullGui: false })).status, 400);
  const finished = await eventually(async () => {
    const { value } = await api('state');
    return value.phase === 'failed' && value;
  }, 'invalid archive refusal');
  assert.notEqual(finished.exitCode, 0);
  assert(finished.log.includes('trigger-recovery:'));
  assert.equal(await fs.readFile(original, 'utf8'), 'deliberately invalid archive');
  // An immediate cancellation must stop the owned CLI process, leave the bridge
  // responsive and allow explicit shutdown. Never target an Editor/game process.
  fields.output = path.join(temporary, 'cancel-output');
  assert.equal((await api('recover', { adapter: 'sc2', fields, fullGui: false })).status, 200);
  assert.equal((await api('cancel', {})).status, 200);
  await eventually(async () => {
    const { value } = await api('state');
    return value.phase === 'cancelled' && value.exitCode !== undefined;
  }, 'process cancellation');
  assert.equal(await fs.readFile(original, 'utf8'), 'deliberately invalid archive');
  assert.equal((await api('shutdown', {})).status, 200);
  await exited;
  console.log(
    'GUI bridge passed: types, adapter argv, origin/token isolation, output guards, concurrent-job refusal, worker failure, immutable input and shutdown.',
  );
} finally {
  if (child.exitCode === null) child.kill();
}

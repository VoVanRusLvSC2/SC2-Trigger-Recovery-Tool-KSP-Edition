/** Check output isolation and CLI failures without opening a user archive. */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateConversionJob, readConversionJob } from '../src/cli/job-input.mjs';
import { componentVersionForBuild } from '../src/cli/build-version.mjs';

const buildInfo =
  'Active!DEC:1|Version!STRING:0|Build Key!HEX:16\n1|5.0.17.98310|00000000000000000000000000000000\n';
assert.deepEqual(componentVersionForBuild(buildInfo), {
  major: 5,
  minor: 0,
  patch: 17,
  build: 98310,
});
assert.throws(
  () => componentVersionForBuild(buildInfo, { major: 5, minor: 0, patch: 17, build: 1 }),
  /differs/,
);
assert.throws(
  () => componentVersionForBuild(buildInfo.replace('98310', 'unknown')),
  /complete version/,
);
assert.throws(
  () => componentVersionForBuild(buildInfo + '1|5.0.17.98311|00000000000000000000000000000000\n'),
  /Exactly one/,
);

const temporary = await mkdtemp(path.join(os.tmpdir(), 'trigger-recovery-cli-'));
const file = path.join(temporary, 'job.json');
const hash = 'a'.repeat(64);
const input = {
  id: 'fixture',
  name: 'Recovered.SC2Map',
  original: 'original.SC2Map',
  originalSha256: hash,
  archive: 'prepared.SC2Map',
  archiveSha256: hash,
  package: 'components',
  config: 'config.json',
  preparationResult: 'preparation.json',
  preparationResultSha256: hash,
  mpq: 'tools/mpqcli.exe',
  outputRoot: 'outputs',
  job: 'outputs/job',
};
const row = validateConversionJob(input, file);
assert.equal(row.original, path.join(temporary, 'original.SC2Map'));
assert.equal(row.job, path.join(temporary, 'outputs', 'job'));
assert.equal(input.original, 'original.SC2Map', 'Validation must not modify caller input');
for (const change of [
  { job: 'outputs' },
  { job: 'elsewhere/job' },
  { job: 'outputs/../outside' },
  { original: 'outputs/job/source.SC2Map' },
  { package: 'outputs' },
  { originalSha256: 'bad' },
  { recoverAttributes: 'false' },
  { name: '../Original.SC2Map' },
  { name: '..' },
])
  assert.throws(() => validateConversionJob({ ...input, ...change }, file));
await writeFile(file, JSON.stringify(input));
assert.equal((await readConversionJob(file)).job, row.job);
await mkdir(path.join(temporary, 'inputs'));
await symlink(
  path.join(temporary, 'inputs'),
  path.join(temporary, 'linked'),
  process.platform === 'win32' ? 'junction' : 'dir',
);
await writeFile(
  file,
  JSON.stringify({
    ...input,
    original: 'inputs/source.SC2Map',
    outputRoot: 'linked',
    job: 'linked/work',
    package: 'inputs/work/components',
  }),
);
await assert.rejects(readConversionJob(file), /overlaps input/);
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = fileURLToPath(new URL('../src/cli/convert.mjs', import.meta.url));
const run = (args) =>
  spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', timeout: 60000 });
const help = run(['--help']);
assert.equal(help.status, 0, help.stderr);
assert(help.stdout.includes('prepared, hash-bound'));
assert.equal(run([]).status, 2);
assert.equal(run(['--unknown']).status, 2);
await writeFile(file, JSON.stringify(input));
// A missing hash-bound preparation file must record FAILED and exit nonzero.
const failed = run([file]);
assert.equal(failed.status, 1, failed.stdout + failed.stderr);
const result = JSON.parse(await readFile(path.join(row.job, 'RESULT.json'), 'utf8'));
assert.equal(result.status, 'FAILED');
assert.equal(result.failedStage, 'VERIFY_INPUTS');
console.log(
  'CLI input checks passed: relative paths, output containment, junction overlap rejection, help and nonzero failed-job exit.',
);
console.log('Temporary fixture outputs retained at ' + temporary);

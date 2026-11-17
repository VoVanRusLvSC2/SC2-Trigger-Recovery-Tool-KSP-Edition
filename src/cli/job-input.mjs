/** Validate job/output locations before the worker creates directories or opens
 * archives. Paths in a job document are relative to that document, not the shell. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const conversionUsage = `Usage: node src/cli/convert.mjs <job.json>

Run a prepared, hash-bound map recovery job. Original archives remain immutable.
The job requires id, name, original, originalSha256, archive, archiveSha256,
package, config, preparationResult, preparationResultSha256, job and mpq.
Set outputRoot to an isolated output directory; the default is <checkout>/output.
The config requires installation (the StarCraft II installation directory).
See BUILDING.md and CLI.md for preparation, evidence and optional fields.
Use --help to print this message without opening a map or writing output.
`;
const within = (root, target) => {
  const relative = path.relative(root, target);
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith('..' + path.sep) &&
    !path.isAbsolute(relative)
  );
};
export function validateConversionJob(input, jobFile) {
  assert(input && typeof input === 'object' && !Array.isArray(input), 'Job must be an object');
  assert(
    input.recoverAttributes === undefined || typeof input.recoverAttributes === 'boolean',
    'Invalid recoverAttributes',
  );
  const row = { ...input },
    base = path.dirname(path.resolve(jobFile));
  for (const field of ['id', 'name'])
    assert(typeof row[field] === 'string' && row[field], `Job ${field} required`);
  assert.equal(path.basename(row.name), row.name, 'Candidate name must be a filename');
  assert(!['.', '..'].includes(row.name), 'Candidate name must not name a directory');
  for (const field of [
    'original',
    'archive',
    'package',
    'config',
    'preparationResult',
    'job',
    'mpq',
  ]) {
    assert(typeof row[field] === 'string' && row[field], `Job ${field} required`);
    row[field] = path.resolve(base, row[field]);
  }
  for (const field of ['localizations', 'attributeIndex'])
    if (row[field] !== undefined) {
      assert(typeof row[field] === 'string' && row[field], `Invalid ${field}`);
      row[field] = path.resolve(base, row[field]);
    }
  for (const field of ['originalSha256', 'archiveSha256', 'preparationResultSha256'])
    assert(/^[a-f0-9]{64}$/u.test(row[field] ?? ''), `Invalid ${field}`);
  const defaultRoot = fileURLToPath(new URL('../../output/', import.meta.url));
  row.outputRoot = row.outputRoot === undefined ? defaultRoot : path.resolve(base, row.outputRoot);
  assert(within(row.outputRoot, row.job), 'Job must be a child of its outputRoot');
  for (const field of ['original', 'archive', 'package', 'config', 'preparationResult'])
    assert(
      row.job !== row[field] && !within(row.job, row[field]) && !within(row[field], row.job),
      `Output overlaps input: ${field}`,
    );
  const sourceRoot = fileURLToPath(new URL('../../src/', import.meta.url));
  assert(
    !within(sourceRoot, row.job) && sourceRoot !== row.job,
    'Output must not be inside source code',
  );
  return row;
}
export async function readConversionJob(file) {
  const row = validateConversionJob(JSON.parse(await readFile(file, 'utf8')), file);
  // Resolve existing parents as well as full paths: a fresh output below a
  // junction must not disguise an overlap with protected source/input files.
  const canonical = async (target) => {
    const tail = [];
    let current = target;
    while (true) {
      try {
        return path.join(await realpath(current), ...tail.reverse());
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const parent = path.dirname(current);
        if (parent === current) throw error;
        tail.push(path.basename(current));
        current = parent;
      }
    }
  };
  const resolved = { ...row };
  for (const key of [
    'original',
    'archive',
    'package',
    'config',
    'preparationResult',
    'job',
    'outputRoot',
  ])
    resolved[key] = await canonical(row[key]);
  validateConversionJob(resolved, file);
  return row;
}

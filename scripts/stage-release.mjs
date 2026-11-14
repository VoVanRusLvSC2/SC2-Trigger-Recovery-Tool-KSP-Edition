/** Materialize a relocatable application from tracked source + public runtime.
 * No archive from Downloads, game installation, benchmark or run evidence enters it. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const destination = path.resolve(process.argv[2] ?? path.join(root, 'release/portable'));
const relative = path.relative(root, destination);
if (
  !relative ||
  relative.startsWith('..') ||
  path.isAbsolute(relative) ||
  !relative.startsWith('release' + path.sep)
)
  throw Error('Release stage must be a fresh directory below <checkout>/release');
await fs.mkdir(destination);
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
for (const file of tracked) {
  if (file.startsWith('.github/')) continue;
  const target = path.join(destination, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(path.join(root, file), target);
}
// Materialize junctions. Absolute links to the build machine must never escape
// into the installed copy, including npm's four local workspace package links.
await fs.cp(path.join(root, 'node_modules'), path.join(destination, 'node_modules'), {
  recursive: true,
  dereference: true,
  // Upstream fixture corpora and tool caches are not application dependencies.
  filter: (file) =>
    !path
      .relative(path.join(root, 'node_modules'), file)
      .split(path.sep)
      .some((part) => ['test', 'tests', 'fixtures', '.cache'].includes(part)),
});
for (const family of ['core', 'private-switch', 'production-preparation']) {
  const file = `src/sdk/${family}/modules/data/services/schema/generated/sc2-data-schema.json`;
  await fs.mkdir(path.dirname(path.join(destination, file)), { recursive: true });
  await fs.copyFile(path.join(root, file), path.join(destination, file));
}
for (const item of ['source-receipt.json', 'build-receipt.json', 'LICENSE', 'licenses']) {
  const target = path.join(destination, 'licenses/public-modkit', item);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(path.join(root, '.runtime/public-upstream', item), target, { recursive: true });
}
await fs.cp(path.join(root, '.runtime/tools/node'), path.join(destination, 'node'), {
  recursive: true,
});
await fs.mkdir(path.join(destination, '.runtime/tools'), { recursive: true });
await fs.copyFile(
  path.join(root, '.runtime/tools/mpqcli.exe'),
  path.join(destination, '.runtime/tools/mpqcli.exe'),
);
// Preserve native-tool licenses next to the executable in every distribution.
await fs.cp(path.join(root, 'licenses/mpqcli'), path.join(destination, '.runtime/tools/licenses'), {
  recursive: true,
});
const files = [];
async function inventory(directory) {
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isSymbolicLink()) throw Error('Distribution contains a link: ' + file);
    if (item.isDirectory()) await inventory(file);
    else {
      const bytes = await fs.readFile(file);
      files.push({
        path: path.relative(destination, file).replaceAll('\\', '/'),
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
}
await inventory(destination);
files.sort((a, b) => a.path.localeCompare(b.path));
const version = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version;
await fs.writeFile(
  path.join(destination, 'distribution-manifest.json'),
  JSON.stringify(
    {
      version,
      sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).trim(),
      sourceDirty:
        execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !==
        '',
      files,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    stage: destination,
    files: files.length,
    bytes: files.reduce((n, f) => n + f.bytes, 0),
    version,
  }),
);

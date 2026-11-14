/** Inspect source completeness without loading the converter or touching maps. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse } from 'acorn';

const rootIndex = process.argv.indexOf('--root');
if (rootIndex !== -1 && !process.argv[rootIndex + 1])
  throw new Error('--root requires a directory');
const root =
  rootIndex === -1
    ? fileURLToPath(new URL('../', import.meta.url))
    : path.resolve(process.argv[rootIndex + 1]);
const relative = (file) => path.relative(root, file).split(path.sep).join('/');

async function sourceFiles(directory) {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) files.push(...(await sourceFiles(file)));
    else if (/\.(?:mjs|js)$/u.test(item.name)) files.push(file);
  }
  return files.sort();
}

function imports(tree) {
  const references = [];
  const pending = [tree];
  let dynamic = 0;
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (
      [
        'ImportDeclaration',
        'ExportNamedDeclaration',
        'ExportAllDeclaration',
        'ImportExpression',
      ].includes(node.type) &&
      node.source
    ) {
      if (typeof node.source.value === 'string') references.push(node.source.value);
      else dynamic++;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value);
      else if (value && typeof value === 'object') pending.push(value);
    }
  }
  return { references, dynamic };
}

const files = await sourceFiles(path.join(root, 'src'));
const issues = [];
let dynamicImports = 0;
for (const file of files) {
  let tree;
  try {
    tree = parse(await readFile(file, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
  } catch (error) {
    issues.push({ file: relative(file), kind: 'syntax', message: error.message });
    continue;
  }
  const { references, dynamic } = imports(tree);
  dynamicImports += dynamic;
  const require = createRequire(pathToFileURL(file));
  for (const specifier of references) {
    if (specifier.startsWith('node:')) continue;
    if (specifier.startsWith('file:') || path.isAbsolute(specifier)) {
      issues.push({ file: relative(file), kind: 'machine-local-import', specifier });
    } else if (specifier.startsWith('.')) {
      const target = fileURLToPath(new URL(specifier, pathToFileURL(file)));
      if (!existsSync(target) || !statSync(target).isFile()) {
        issues.push({
          file: relative(file),
          kind: existsSync(target) ? 'directory-import' : 'missing-file',
          specifier,
          target: relative(target),
        });
      }
    } else {
      try {
        require.resolve(specifier);
      } catch {
        issues.push({ file: relative(file), kind: 'unresolved-package', specifier });
      }
    }
  }
}

const counts = {};
for (const issue of issues) counts[issue.kind] = (counts[issue.kind] ?? 0) + 1;
const report = {
  status: issues.length ? 'INCOMPLETE' : 'STATIC_IMPORTS_RESOLVED',
  modules: files.length,
  counts,
  missingFileTargets: [...new Set(issues.filter((i) => i.target).map((i) => i.target))].sort(),
  unresolvedPackages: [
    ...new Set(issues.filter((i) => i.kind === 'unresolved-package').map((i) => i.specifier)),
  ].sort(),
  dynamicImports,
  qualification:
    'Static resolution only; execution, export contracts and equivalence require separate checks.',
  issues,
};
const reportIndex = process.argv.indexOf('--report');
if (reportIndex !== -1) {
  if (!process.argv[reportIndex + 1]) throw new Error('--report requires an output filename');
  await writeFile(process.argv[reportIndex + 1], JSON.stringify(report, null, 2) + '\n');
}
console.log(
  JSON.stringify(
    { status: report.status, modules: report.modules, counts, dynamicImports },
    null,
    2,
  ),
);
process.exitCode = issues.length ? 1 : 0;

/** Emit the public source packages' runtime JS. This is transpilation, not an
 * upstream typecheck or a substitute for our executable compatibility checks. */
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, '.runtime/public-upstream');
const packages = { starcraft2: '.', casc: 'src', mpq: 'src' };
let emitted = 0;
async function visit(directory, base, output) {
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    if (['dist', 'node_modules', 'test', 'tests'].includes(item.name) || item.isSymbolicLink())
      continue;
    const file = path.join(directory, item.name);
    if (item.isDirectory()) await visit(file, base, output);
    else if (/\.(?:ts|js|json)$/u.test(item.name) && !/\.d\.ts$/u.test(item.name)) {
      const target = path.join(output, path.relative(base, file).replace(/\.ts$/u, '.js'));
      let text = await fs.readFile(file, 'utf8');
      if (item.name.endsWith('.ts')) {
        const result = ts.transpileModule(text, {
          fileName: file,
          reportDiagnostics: true,
          compilerOptions: {
            target: ts.ScriptTarget.ES2023,
            module: ts.ModuleKind.ESNext,
            verbatimModuleSyntax: false,
            preserveConstEnums: true,
          },
        });
        const errors = (result.diagnostics ?? []).filter(
          (d) => d.category === ts.DiagnosticCategory.Error,
        );
        if (errors.length)
          throw Error(
            ts.formatDiagnosticsWithColorAndContext(errors, {
              getCanonicalFileName: (f) => f,
              getCurrentDirectory: () => root,
              getNewLine: () => '\n',
            }),
          );
        text = result.outputText;
      }
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, text);
      emitted++;
    }
  }
}
for (const [name, directory] of Object.entries(packages)) {
  const base = path.join(source, name, directory);
  await visit(base, base, path.join(source, name, 'dist'));
}
const schema = await fs.readFile(
  path.join(source, 'starcraft2/modules/data/services/schema/generated/sc2-data-schema.json'),
);
for (const family of ['core', 'private-switch', 'production-preparation']) {
  const target = path.join(
    root,
    'src/sdk',
    family,
    'modules/data/services/schema/generated/sc2-data-schema.json',
  );
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, schema);
}
await fs.writeFile(
  path.join(source, 'build-receipt.json'),
  JSON.stringify(
    {
      transpiler: ts.version,
      emitted,
      schemaSha256: createHash('sha256').update(schema).digest('hex'),
      qualification: 'Public-source runtime emission; execute compatibility checks separately.',
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Emitted ${emitted} public runtime modules/assets; installed the public schema in three SDK families.`,
);

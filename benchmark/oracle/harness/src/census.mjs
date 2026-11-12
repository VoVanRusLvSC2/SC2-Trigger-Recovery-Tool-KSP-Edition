import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const packagePattern = /\.(?:SC2Map|SC2Mod)$/iu;
const triggerPattern = /^(?:Triggers|Triggers\.xml)$/iu;
const stringsPattern = /TriggerStrings\.txt$/iu;
const gameStringsPattern = /GameStrings\.txt$/iu;

export async function censusPackageRoots(roots) {
  const packages = [];
  for (const rootInput of roots) {
    const root = path.resolve(rootInput);
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !packagePattern.test(entry.name)) continue;
      const packageRoot = path.join(root, entry.name);
      const files = [];
      async function walk(directory) {
        for (const child of await readdir(directory, { withFileTypes: true })) {
          const filePath = path.join(directory, child.name);
          if (child.isDirectory()) await walk(filePath);
          else if (child.isFile()) files.push(filePath);
        }
      }
      await walk(packageRoot);
      const relativeFiles = predicate => files
        .filter(file => predicate(path.basename(file)))
        .map(file => path.relative(packageRoot, file).split(path.sep).join('/'))
        .sort();
      let bytes = 0;
      for (const file of files) bytes += (await stat(file)).size;
      const galaxyFiles = relativeFiles(name => name.toLowerCase().endsWith('.galaxy'));
      const mapScripts = relativeFiles(name => name.toLowerCase() === 'mapscript.galaxy');
      const galaxyFileBytes = {};
      for (const file of files) {
        if (path.basename(file).toLowerCase().endsWith('.galaxy')) {
          galaxyFileBytes[path.relative(packageRoot, file).split(path.sep).join('/')] = (await stat(file)).size;
        }
      }
      const triggerDataCandidates = relativeFiles(name => triggerPattern.test(name));
      const triggerDataFiles = [];
      const emptyTriggerDataFiles = [];
      for (const file of triggerDataCandidates) {
        const contents = await readFile(path.join(packageRoot, file), 'utf8');
        (/<Element\b/iu.test(contents) ? triggerDataFiles : emptyTriggerDataFiles).push(file);
      }
      const triggerStringsFiles = relativeFiles(name => stringsPattern.test(name));
      const gameStringsFiles = relativeFiles(name => gameStringsPattern.test(name));
      packages.push({
        id: entry.name.replace(/[^\p{L}\p{N}.-]+/gu, '-'),
        kind: entry.name.toLowerCase().endsWith('.sc2map') ? 'map' : 'mod',
        packagePath: path.relative(process.cwd(), packageRoot).split(path.sep).join('/'),
        bytes,
        galaxyFiles,
        galaxyFileBytes,
        mapScripts,
        triggerDataFiles,
        emptyTriggerDataFiles,
        triggerStringsFiles,
        gameStringsFiles,
        roundtripBaselineAvailable: mapScripts.length === 1 && triggerDataFiles.length === 1,
      });
    }
  }
  packages.sort((a, b) => a.packagePath.localeCompare(b.packagePath));
  return {
    schemaVersion: 1,
    packages,
    totals: {
      packages: packages.length,
      maps: packages.filter(item => item.kind === 'map').length,
      mods: packages.filter(item => item.kind === 'mod').length,
      mapScriptPackages: packages.filter(item => item.mapScripts.length > 0).length,
      roundtripBaselinePackages: packages.filter(item => item.roundtripBaselineAvailable).length,
      bytes: packages.reduce((sum, item) => sum + item.bytes, 0),
    },
  };
}

async function main(args) {
  const roots = [];
  let output;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--root' && args[index + 1]) roots.push(args[++index]);
    else if (args[index] === '--output' && args[index + 1]) output = args[++index];
    else throw new TypeError(`unexpected or incomplete argument: ${args[index]}`);
  }
  if (roots.length === 0) throw new TypeError('provide at least one --root containing extracted .SC2Map/.SC2Mod directories');
  const result = `${JSON.stringify(await censusPackageRoots(roots), null, 2)}\n`;
  if (output) await writeFile(path.resolve(output), result, 'utf8');
  else process.stdout.write(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node
// Adds to the corpus packages the files collect-corpus.mjs left out and the converter now reads or is
// compared with: the Custom AI document (CustomAI) and its generated scripts (ai<Id>.galaxy), Attributes,
// and every locale's GameStrings/ObjectStrings/TriggerStrings. Files already in a package are kept.
// The files are read through the Modkit mod loader, packed or folder maps alike.
//
// Usage: node src/enrich-corpus.mjs <corpus root> <conversion module> [--dry-run] [--only <package>[,<package>]]
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyAt = args.indexOf('--only');
const only = onlyAt >= 0 ? new Set(args[onlyAt + 1].split(',').map(name => name.toLowerCase())) : undefined;
const [corpusRoot, modulePath] = args.filter((arg, index) => !arg.startsWith('--') && index !== onlyAt + 1);
if (!corpusRoot || !modulePath) {
  console.error('Usage: node src/enrich-corpus.mjs <corpus root> <conversion module> [--dry-run] [--only <package>]');
  process.exit(2);
}
const moduleUrl = pathToFileURL(path.resolve(modulePath)).href;
const { Sc2DesktopContentSources } = await import(new URL('../../../game/battlenet/content-sources/local-content-sources.js', moduleUrl));
const contentRoot = process.env.MODKITX_SC2_ROOT ?? 'C:/Apps/StarCraft II';
const wanted = name => /^(CustomAI|Attributes|ai[0-9A-F]{8}\.galaxy)$/iu.test(name)
  || /^[a-z]{4}\.SC2Data\/LocalizedData\/(GameStrings|ObjectStrings|TriggerStrings)\.txt$/iu.test(name);
const exists = file => stat(file).then(() => true, () => false);

const report = JSON.parse(await readFile(path.join(corpusRoot, 'collect-report.json'), 'utf8'));
const contentSources = new Sc2DesktopContentSources({ installationDirectory: contentRoot });
const added = [];
try {
  for (const entry of report) {
    if (typeof entry?.target !== 'string' || typeof entry?.source !== 'string') continue;
    const name = path.win32.basename(entry.target);
    const target = path.join(corpusRoot, 'originals', name);
    if (only && !only.has(name.toLowerCase())) continue;
    if (!(await exists(target))) continue;
    let context;
    try {
      context = await contentSources.openModContext({ schemaVersion: 1, target: entry.source, baseMods: [path.resolve(contentRoot, 'mods/void.sc2mod')] });
      const layer = context.layers.at(-1);
      const files = [];
      let cursor;
      do {
        const page = await context.files(layer.id, { limit: 1000, ...(cursor ? { cursor } : {}) });
        files.push(...page.items.map(item => typeof item === 'string' ? item : item.path));
        cursor = page.nextCursor;
      } while (cursor);
      const copied = [];
      for (const file of files.filter(wanted)) {
        const destination = path.join(target, file);
        if (await exists(destination)) continue;
        copied.push(file);
        if (dryRun) continue;
        const bytes = await context.read(layer.id, file, 64 * 1024 * 1024);
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, bytes);
      }
      if (copied.length) added.push({ package: name, source: entry.source, files: copied });
      console.log(`${name}: ${copied.length ? copied.join(', ') : 'nothing to add'}`);
    } catch (error) {
      console.log(`${name}: FAILED ${error.message}`);
    } finally {
      await context?.dispose();
    }
  }
} finally {
  await contentSources.dispose();
}
if (!dryRun && added.length) {
  const log = path.join(corpusRoot, 'enrich-report.json');
  const previous = await readFile(log, 'utf8').then(JSON.parse, () => []);
  await writeFile(log, JSON.stringify([...previous, { at: new Date().toISOString(), added }], null, 2));
}
console.log(`${dryRun ? 'would add' : 'added'} ${added.reduce((total, item) => total + item.files.length, 0)} files to ${added.length} packages`);

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const VERSION_FILE_MODULE = new URL(
  '../../modkit-extensions-blizzard/starcraft2/dist/modules/mod/codecs/document-metadata/core/version-file.js', import.meta.url);

/**
 * Builds one editor-openable map folder (sc2components layout): the base map with its Triggers and
 * MapScript.galaxy replaced by a converter's output. The converter's header is inlined into MapScript.galaxy,
 * as the editor writes a map, so the result does not depend on where the game looks for a header file.
 */
export async function assembleMapFolder({ base, target, triggers, script, header, strings, description }) {
  await rm(target, { recursive: true, force: true });
  await mkdir(path.dirname(target), { recursive: true });
  await cp(base, target, { recursive: true });
  await cp(triggers, path.join(target, 'Triggers'));
  if (strings) await cp(strings, path.join(target, 'enUS.SC2Data', 'LocalizedData', 'TriggerStrings.txt'));

  const notes = [];
  // SC2 Editor does not load Triggers without Triggers.version ("Unable to load 'Triggers'"), and a
  // published map ships neither. A .version holds no content checksum, so the map's own MapInfo.version
  // rewritten for the Triggers component gives one from the same editor build. The format belongs to
  // the SC2 mod module ([SC2] Mod & Data).
  const triggersVersion = path.join(target, 'Triggers.version');
  const mapInfoVersion = path.join(target, 'MapInfo.version');
  if (!existsSync(triggersVersion) && existsSync(mapInfoVersion)) {
    const { parseVersionFile, writeVersionFile, typeTagForVersionPath } = await import(VERSION_FILE_MODULE);
    const mapInfo = parseVersionFile(await readFile(mapInfoVersion));
    if (!mapInfo) throw new TypeError(`${mapInfoVersion} is not a .version file`);
    await writeFile(triggersVersion, writeVersionFile({ ...mapInfo, typeTag: typeTagForVersionPath('Triggers.version') }));
    notes.push('Triggers.version derived from MapInfo.version (the base map had none)');
  }
  let text = await readFile(script, 'utf8');
  // The script may include several headers (dependency libraries first); the converter's header is the map's own.
  const headerIncludes = [...text.matchAll(/^include\s+"([\w./-]+_h)"\s*$/gmu)].map(match => match[1]);
  const headerName = headerIncludes.includes('LibMap_h') ? 'LibMap_h' : headerIncludes.at(-1);
  if (header && headerName) {
    const headerText = (await readFile(header, 'utf8')).replace(/^include\s+"TriggerLibs\/natives"\s*\r?\n/gimu, '');
    text = text.replace(new RegExp(`^include\\s+"${headerName}"\\s*$`, 'mu'), () => headerText);
    notes.push(`the converter header ${headerName} is inlined into MapScript.galaxy`);
  }
  await writeFile(path.join(target, 'MapScript.galaxy'), text);
  await writeFile(path.join(target, 'CONVERTED-BY.txt'), [
    description, `triggers: ${triggers}`, `galaxy: ${script}`, ...notes.map(note => `note: ${note}`),
  ].join('\n') + '\n');
  return { mapFolder: target, notes };
}

// One playable map per converter that finished the case in a benchmark run. `basePackage` replaces the run's
// package when that is a stripped copy (only scripts and strings) instead of the whole map.
export async function assemblePlayableMaps(runDirectory, caseId, { outputRoot = path.join(runDirectory, 'playable'), basePackage } = {}) {
  // A run still in progress has no summary.json yet; its finished attempts are already in events.jsonl.
  const summary = existsSync(path.join(runDirectory, 'summary.json'))
    ? JSON.parse(await readFile(path.join(runDirectory, 'summary.json'), 'utf8'))
    : { results: (await readFile(path.join(runDirectory, 'events.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line)).filter(event => event.type === 'attempt-finished') };
  const assembled = [];
  for (const result of summary.results.filter(item => item.caseId === caseId && item.status === 'completed')) {
    const base = basePackage ?? result.inputArtifacts.find(item => item.role === 'package')?.path;
    const output = role => result.outputArtifacts.find(item => item.role === role)?.path;
    const triggers = output('trigger-data'), script = output('roundtrip-script');
    if (!base || !triggers || !script) continue;
    const built = await assembleMapFolder({
      base, triggers, script, header: output('roundtrip-header'), strings: output('trigger-strings'),
      target: path.join(outputRoot, result.converterId, `${caseId}-${result.converterId}.SC2Map`),
      description: `converter: ${result.converterId}\nrun: ${runDirectory}`,
    });
    assembled.push({ converterId: result.converterId, ...built, correctness: result.correctness });
  }
  return assembled;
}

async function main() {
  const [runDirectory, caseId, outputRoot, basePackage] = process.argv.slice(2);
  if (!runDirectory || !caseId) {
    console.error('Usage: node src/assemble-playable-map.mjs <run directory> <caseId> [output root] [base package directory]');
    process.exitCode = 2;
    return;
  }
  console.log(JSON.stringify(await assemblePlayableMaps(path.resolve(runDirectory), caseId, {
    ...(outputRoot ? { outputRoot: path.resolve(outputRoot) } : {}), ...(basePackage ? { basePackage: path.resolve(basePackage) } : {}),
  }), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}

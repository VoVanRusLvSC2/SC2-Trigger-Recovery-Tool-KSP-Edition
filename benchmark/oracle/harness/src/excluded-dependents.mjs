// Mods the owner keeps out of benchmarks, with every package that depends on them — directly or through
// another mod. Dependencies are the `bnet:` names and `file:` paths in DocumentInfo; `file:` paths are
// resolved like the editor and the Modkit loader do: against the game installation first, then the
// corpus copies.
//   tib-data                 owner decision 2026-09-25
//   ARC (All Races Coop Mod) owner decision 2026-09-28: not installed here, its maps convert against
//   UEDFL campaign mods      Core alone and measure the missing mod, not the converter
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const EXCLUDED_MODS = [
  { name: 'tib-data', pattern: /tib-data/iu },
  { name: 'ARC', pattern: /(?:^|[\\/])ARC\.SC2Mod$|^bnet:ALL RACES COOP MOD\//iu },
  { name: 'UEDFL', pattern: /(?:^|[\\/])UEDFL_[^\\/]*\.SC2Mod$/iu },
];
const INSTALL = process.env.MODKIT_SC2_ROOT ?? 'C:/Apps/StarCraft II';
const CORPORA = ['../../artifacts/corpus-installed-2026-09-16/originals', '../../artifacts/test-mods-vovan/originals']
  .map(relative => path.resolve(import.meta.dirname, relative));

function documentInfo(packagePath) {
  try {
    const file = statSync(packagePath).isDirectory() ? path.join(packagePath, 'DocumentInfo') : packagePath;
    return readFileSync(file, 'latin1');
  } catch {
    return '';
  }
}

/** The `bnet:` names and `file:` paths one DocumentInfo value lists, `file:` paths with `/`. */
function dependencies(packagePath) {
  return [...documentInfo(packagePath).matchAll(/<Value>([^<]*(?:bnet:|file:)[^<]*)<\/Value>/gu)]
    .flatMap(match => match[1].split(','))
    .map(item => item.trim())
    .map(item => item.startsWith('file:') ? item.slice('file:'.length).split(String.fromCharCode(92)).join('/') : item);
}

function locate(relative) {
  if (relative.startsWith('bnet:')) return undefined;
  for (const candidate of [path.join(INSTALL, relative), ...CORPORA.map(root => path.join(root, path.basename(relative)))]) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

const excluded = item => EXCLUDED_MODS.find(mod => mod.pattern.test(item));

/** The excluded mod a package is or depends on, with the dependency path that leads to it, or undefined. */
export function excludedDependency(packagePath, seen = new Set()) {
  const own = excluded(packagePath);
  if (own) return { mod: own.name, path: packagePath };
  if (seen.has(packagePath)) return undefined;
  seen.add(packagePath);
  for (const dependency of dependencies(packagePath)) {
    const direct = excluded(dependency);
    if (direct) return { mod: direct.name, path: dependency };
    const located = locate(dependency);
    const through = located && excludedDependency(located, seen);
    if (through) return { mod: through.mod, path: `${dependency} -> ${through.path}` };
  }
  return undefined;
}

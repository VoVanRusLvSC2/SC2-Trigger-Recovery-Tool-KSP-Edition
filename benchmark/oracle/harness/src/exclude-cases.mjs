// Removes from a manifest the cases whose package is or depends on an excluded mod (excluded-dependents.mjs)
// and recounts its coverage requirements from the cases that remain.
// Usage: node src/exclude-cases.mjs <manifest.json> [--dry-run]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { excludedDependency } from './excluded-dependents.mjs';

const [manifestPath, flag] = process.argv.slice(2);
if (!manifestPath) throw new TypeError('usage: node src/exclude-cases.mjs <manifest.json> [--dry-run]');
const file = path.resolve(manifestPath);
const manifest = JSON.parse(readFileSync(file, 'utf8'));
const kept = [];
const removed = new Map();
for (const benchmarkCase of manifest.cases) {
  const packageInput = benchmarkCase.inputs?.find(input => input.role === 'package');
  const found = packageInput && excludedDependency(path.resolve(path.dirname(file), packageInput.path));
  if (!found) { kept.push(benchmarkCase); continue; }
  if (!removed.has(found.mod)) removed.set(found.mod, []);
  removed.get(found.mod).push(benchmarkCase.id);
}
const count = (select) => {
  const counts = {};
  for (const benchmarkCase of kept) for (const key of select(benchmarkCase)) counts[key] = (counts[key] ?? 0) + 1;
  return counts;
};
if (manifest.coverageRequirements) {
  const packages = new Set(kept.map(item => item.inputs?.find(input => input.role === 'package')?.path));
  manifest.coverageRequirements = {
    ...manifest.coverageRequirements,
    minCases: kept.length,
    minUniquePackages: packages.size,
    minDocumentKinds: count(item => [item.documentKind]),
    minOperations: count(item => [item.operation]),
    minTags: count(item => item.tags ?? []),
  };
}
manifest.cases = kept;
for (const [mod, ids] of removed) console.log(`${mod}: removed ${ids.length} (${ids.join(' ')})`);
console.log(`kept ${kept.length}`);
if (flag !== '--dry-run') writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

// A candidate manifest: the cases of a corpus manifest run by the converter of another build (worktree),
// named so its runs sort apart. The AST oracle stays the corpus manifest's, so both runs are judged alike.
// Usage: node src/candidate-manifest.mjs <corpus manifest> <worktree> <name> [caseId,caseId|re:<regex>]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const [manifestPath, worktree, name, filter] = process.argv.slice(2);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const conversionModule = `${worktree.replace(/\/$/u, '')}/starcraft2/dist/modules/triggers/services/galaxy-conversion/index.js`;
const pattern = filter?.startsWith('re:') ? new RegExp(filter.slice(3), 'u') : undefined;
const ids = filter && !pattern ? new Set(filter.split(',')) : undefined;
manifest.name = name;
manifest.cases = manifest.cases.filter(item => !filter || (pattern ? pattern.test(item.id) : ids.has(item.id)));
// A subset cannot meet the corpus's coverage requirements; they belong to the whole corpus.
if (filter) delete manifest.coverageRequirements;
manifest.converters = manifest.converters.map(converter => ({ ...converter, env: { ...converter.env, MODKIT_CONVERSION_MODULE: conversionModule } }));
const target = path.join(path.dirname(manifestPath), `benchmark.${name}.json`);
writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${target}: ${manifest.cases.length} cases, converter ${conversionModule}`);

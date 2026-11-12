// Case-by-case regression check of one benchmark run against another run of the same cases: status, Galaxy
// AST similarity, GUI triggers, CustomScript, element counts and the editor-only Label/Category elements of the
// produced Triggers. AST similarity is computed here for both runs the way the report does (median over the
// script and header comparisons, the manifest's oracle), so a run still in progress can be compared too.
// A case is a regression when its status gets worse, its AST similarity drops or its CustomScript count grows.
// Usage: node src/run-regression.mjs <baseline run> <candidate run> --manifest <manifest> [--all]
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { summarizeAstComparison } from './ast-metrics.mjs';
import { loadConversionOracle, readGalaxyComparisonPair } from './conversion-oracle.mjs';

const args = process.argv.slice(2);
const flag = name => { const index = args.indexOf(name); return index < 0 ? undefined : args.splice(index, 2)[1]; };
const manifestPath = flag('--manifest');
const showAll = args.includes('--all');
const [baselineDir, candidateDir] = args.filter(arg => !arg.startsWith('--'));
if (!baselineDir || !candidateDir || !manifestPath) {
  console.error('Usage: node src/run-regression.mjs <baseline run> <candidate run> --manifest <manifest> [--all]');
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const cases = new Map(manifest.cases.map(item => [item.id, item]));
const oracle = await loadConversionOracle(manifest.astOracleModule, path.dirname(path.resolve(manifestPath)));

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function astMetrics(event) {
  const benchmarkCase = cases.get(event.caseId);
  if (event.status !== 'completed' || !benchmarkCase) return { similarity: null, differences: null };
  const inputs = new Map(event.inputArtifacts.map(item => [item.role, item.path]));
  const outputs = new Map(event.outputArtifacts.map(item => [item.role, item.path]));
  const pairs = event.operation === 'galaxy-triggers-roundtrip' ? [['script', 'roundtrip-script'], ['header', 'roundtrip-header']]
    : event.operation === 'triggers-to-galaxy' ? [['expected-script', 'script'], ['expected-header', 'header']] : [];
  const metrics = [];
  for (const [inputRole, outputRole] of pairs) {
    if (!inputs.get(inputRole) || !outputs.get(outputRole)) continue;
    try {
      const { expected, actual } = await readGalaxyComparisonPair(inputs, outputs, inputRole, outputRole, benchmarkCase.options?.libraryId);
      const parsed = oracle.compareGalaxyAst(oracle.parseGalaxySource(expected, 'expected.galaxy'), oracle.parseGalaxySource(actual, 'actual.galaxy'), benchmarkCase.options ?? {});
      const summary = summarizeAstComparison(parsed);
      if (summary.status === 'available') metrics.push(summary);
    } catch { /* an unreadable pair has no metric, as in the report */ }
  }
  return { similarity: median(metrics.map(metric => metric.similarityPercent)), differences: median(metrics.map(metric => metric.astDifferences)) };
}

async function load(run) {
  const events = readFileSync(path.join(run, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line))
    .filter(event => event.type === 'attempt-finished');
  const rows = new Map();
  for (const event of events) {
    const triggersPath = event.outputArtifacts?.find(artifact => artifact.role === 'trigger-data')?.path
      ?? path.join(run, 'cases', event.caseId, event.converterId, 'attempt-01', 'output', 'Triggers');
    const triggers = existsSync(triggersPath) ? readFileSync(triggersPath, 'utf8') : '';
    // Counted over the whole document, the same way for both runs: a map with libraries of its own keeps
    // them in <Library> blocks, which a one-library reader does not see.
    const count = type => (triggers.match(new RegExp(`<Element Type="${type}"`, 'gu')) ?? []).length;
    const ast = await astMetrics(event);
    rows.set(event.caseId, {
      status: event.status,
      ast: ast.similarity,
      astDiffs: ast.differences,
      gui: triggers ? count('Trigger') : null,
      customScript: triggers ? (triggers.match(/<ScriptCode(?:\s[^>]*)?>/gu) ?? []).length : null,
      elements: triggers ? (triggers.match(/<Element\s/gu) ?? []).length : null,
      labels: triggers ? count('Label') : null,
      categories: triggers ? count('Category') : null,
    });
  }
  return rows;
}

const statusRank = status => ({ completed: 0, 'invalid-output': 1, failed: 2, timeout: 3 })[status] ?? 2;
const [baseline, candidate] = [await load(baselineDir), await load(candidateDir)];
const fmt = value => value === null || value === undefined ? '—' : String(value);
let regressions = 0, improvements = 0, compared = 0;
const lines = [];
for (const [caseId, next] of candidate) {
  const previous = baseline.get(caseId);
  if (!previous) continue;
  compared++;
  const problems = [];
  if (statusRank(next.status) > statusRank(previous.status)) problems.push(`status ${previous.status} -> ${next.status}`);
  if (previous.ast !== null && (next.ast === null || next.ast < previous.ast)) problems.push(`AST ${fmt(previous.ast)} -> ${fmt(next.ast)}`);
  if (previous.customScript !== null && next.customScript !== null && next.customScript > previous.customScript) problems.push(`CustomScript ${previous.customScript} -> ${next.customScript}`);
  const better = (next.ast ?? -1) > (previous.ast ?? -1) || statusRank(next.status) < statusRank(previous.status) ||
    (next.customScript ?? 0) < (previous.customScript ?? 0);
  if (problems.length) regressions++;
  else if (better) improvements++;
  if (problems.length || better || showAll) {
    const cell = key => `${fmt(previous[key])}→${fmt(next[key])}`;
    lines.push(`${problems.length ? 'REGRESSION' : better ? 'better    ' : 'same      '} ${caseId.padEnd(18)} status ${cell('status')} | AST ${cell('ast')} (${cell('astDiffs')}) | GUI ${cell('gui')} | CS ${cell('customScript')} | elements ${cell('elements')} | labels ${cell('labels')} | folders ${cell('categories')}${problems.length ? ` | ${problems.join('; ')}` : ''}`);
  }
}
console.log(lines.join('\n'));
console.log(`\n${compared} cases compared: ${regressions} regressions, ${improvements} improved, ${compared - regressions - improvements} unchanged`);
process.exitCode = regressions ? 1 : 0;

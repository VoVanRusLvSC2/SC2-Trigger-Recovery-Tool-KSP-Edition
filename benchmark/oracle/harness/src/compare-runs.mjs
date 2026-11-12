import { readFileSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { openReport } from './report.mjs';

const template = readFileSync(new URL('./compare.html', import.meta.url), 'utf8');
const finite = value => Number.isFinite(value) ? value : null;
const caseKey = item => item.caseId + '\0' + item.converterId;
const median = values => {
  const sorted = values.sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const center = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[center] : (sorted[center - 1] + sorted[center]) / 2;
};

async function loadReport(runDirectory) {
  const directory = path.resolve(runDirectory);
  const report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'));
  const cases = new Map((report.caseResults ?? []).map(item => {
    const errors = median((item.attempts ?? []).map(attempt =>
      (attempt.diagnosticsSummary?.byCode ?? [])
        .filter(diagnostic => diagnostic.severity === 'error')
        .reduce((count, diagnostic) => count + diagnostic.count, 0)));
    return [caseKey(item), {
      caseId: item.caseId,
      converterId: item.converterId,
      displayName: item.displayName ?? item.caseId,
      status: item.shortStatus,
      astDifferences: finite(item.outputMetrics?.astDifferences),
      callDifferences: finite(item.outputMetrics?.callDifferences),
      errors,
      guiTriggers: finite(item.outputMetrics?.guiTriggers),
      scriptCodeTags: finite(item.outputMetrics?.customScriptTags),
      wallTimeMs: finite(item.performance?.wallTimeMs?.median),
      peakMemoryBytes: finite(item.performance?.peakWorkingSetBytes?.median),
    }];
  }));
  return {
    id: path.basename(directory),
    directory,
    name: report.name ?? path.basename(directory),
    startedAt: report.startedAt,
    manifestSha256: report.manifestSha256 ?? null,
    attemptsPerCase: Math.max(0, ...(report.caseResults ?? []).map(item => item.attempts?.length ?? 0)),
    cases,
  };
}

export async function compareRuns(runDirectories) {
  if (runDirectories.length < 2) throw new RangeError('compareRuns needs at least two run directories');
  const runs = [];
  for (const directory of runDirectories) runs.push(await loadReport(directory));
  return { runs };
}

export function renderCompareHtml({ runs }) {
  const data = JSON.stringify(runs.map(run => ({
    ...run,
    cases: Object.fromEntries(run.cases),
  }))).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  return template.replace('__DATA__', data);
}

export async function writeCompareReport(runDirectories, outputFile) {
  const comparison = await compareRuns(runDirectories);
  const target = path.resolve(outputFile);
  await writeFile(target, renderCompareHtml(comparison));
  return { target, comparison };
}

// Existing report directories are never changed or removed; only the index is refreshed.
export async function writeRunHistory(outputRoot) {
  const root = path.resolve(outputRoot);
  const entries = await readdir(root, { withFileTypes: true });
  const runs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try { runs.push(await loadReport(path.join(root, entry.name))); }
    catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  runs.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
  const target = path.join(root, 'history.html');
  await writeFile(target, renderCompareHtml({ runs }));
  return { target, runs: runs.length };
}

async function main() {
  const args = process.argv.slice(2);
  const noOpen = args.includes('--no-open');
  const filtered = args.filter(argument => argument !== '--no-open');
  if (filtered.length < 2) {
    console.error('Usage: node src/compare-runs.mjs <old-run> <new-run> [other runs...] [--no-open]');
    process.exitCode = 2;
    return;
  }
  const target = path.resolve('.benchmark-runs', 'compare-' + new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-') + '.html');
  const result = await writeCompareReport(filtered, target);
  console.log(JSON.stringify({ compareHtml: result.target, runs: result.comparison.runs.length }, null, 2));
  if (!noOpen) {
    try { openReport(result.target); }
    catch (error) { console.error('Could not open comparison report: ' + error.message); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function pct(part, total) {
  return total ? `${((part / total) * 100).toFixed(1)}%` : 'n/a';
}

function aggregateFailureReasons(caseResults) {
  const byReason = new Map();
  for (const item of caseResults) {
    for (const { reason, attempts } of item.failureReasons ?? []) {
      const entry = byReason.get(reason) ?? { attempts: 0, cases: new Set() };
      entry.attempts += attempts;
      entry.cases.add(item.displayName ?? item.caseId);
      byReason.set(reason, entry);
    }
  }
  return [...byReason].map(([reason, entry]) => ({ reason, attempts: entry.attempts, caseCount: entry.cases.size, examples: [...entry.cases].slice(0, 5) }))
    .sort((a, b) => b.attempts - a.attempts);
}

function aggregateDiagnostics(caseResults) {
  const byCode = new Map();
  for (const item of caseResults) {
    for (const attempt of item.attempts ?? []) {
      for (const diag of attempt.diagnosticsSummary?.byCode ?? []) {
        const key = `${diag.code}\0${diag.severity}`;
        const entry = byCode.get(key) ?? { code: diag.code, severity: diag.severity, count: 0, cases: new Set(), example: diag.example };
        entry.count += diag.count;
        entry.cases.add(item.displayName ?? item.caseId);
        byCode.set(key, entry);
      }
    }
  }
  return [...byCode.values()].map(entry => ({ ...entry, caseCount: entry.cases.size, examples: [...entry.cases].slice(0, 5) }))
    .sort((a, b) => b.count - a.count);
}

export function buildErrorReport(report) {
  const { caseResults, processErrorSummary, qualityChecks, ranking } = report;
  const totalCases = caseResults.length;
  const totalAttempts = caseResults.reduce((sum, item) => sum + item.attempts.length, 0);
  const byStatus = caseResults.reduce((counts, item) => {
    counts[item.shortStatus] = (counts[item.shortStatus] ?? 0) + 1;
    return counts;
  }, {});
  const worstCases = caseResults
    .filter(item => ['Error', 'Failed', 'Mixed'].includes(item.shortStatus))
    .map(item => ({
      displayName: item.displayName,
      caseId: item.caseId,
      converterId: item.converterId,
      documentKind: item.documentKind,
      shortStatus: item.shortStatus,
      reasons: (item.failureReasons ?? []).map(entry => entry.reason),
      astSimilarityPercent: item.outputMetrics?.astSimilarityPercent ?? null,
    }))
    .sort((a, b) => (a.astSimilarityPercent ?? 0) - (b.astSimilarityPercent ?? 0));

  return {
    name: report.name,
    runDirectory: report.runDirectory,
    startedAt: report.startedAt,
    finishedAt: report.finishedAt,
    totalCases,
    totalAttempts,
    byStatus,
    qualityChecks,
    ranking,
    processErrorSummary,
    failureReasons: aggregateFailureReasons(caseResults),
    diagnostics: aggregateDiagnostics(caseResults),
    worstCases,
  };
}

export function renderErrorReportMarkdown(summary) {
  const lines = [];
  lines.push(`# Converter error report — ${summary.name ?? 'benchmark run'}`);
  lines.push('');
  lines.push(`Run directory: \`${summary.runDirectory}\``);
  lines.push(`Window: ${summary.startedAt ?? '?'} → ${summary.finishedAt ?? '?'}`);
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push(`- Cases (map/mod × converter): ${summary.totalCases}`);
  lines.push(`- Attempts (cases × repetitions): ${summary.totalAttempts}`);
  lines.push(`- Completed conversions: ${summary.qualityChecks.completedOutputs} (${pct(summary.qualityChecks.completedOutputs, summary.totalAttempts)})`);
  lines.push(`- Process errors (crash/timeout/invalid output): ${summary.qualityChecks.processErrors} (${pct(summary.qualityChecks.processErrors, summary.totalAttempts)})`);
  lines.push(`- Partial-fidelity conversions: ${summary.qualityChecks.partialFidelity}`);
  lines.push(`- AST mismatches: ${summary.qualityChecks.astMismatchAttempts}`);
  lines.push(`- GUI-structure mismatches: ${summary.qualityChecks.guiMismatches}`);
  lines.push('');
  lines.push('### Case status breakdown');
  lines.push('');
  lines.push('| Status | Cases |');
  lines.push('| --- | --- |');
  for (const [status, count] of Object.entries(summary.byStatus).sort((a, b) => b[1] - a[1])) lines.push(`| ${status} | ${count} |`);
  lines.push('');

  lines.push('## Converter ranking');
  lines.push('');
  lines.push('| Rank | Converter | Pass | Warning | Fail | Inconclusive | Median time | Median peak memory |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const item of summary.ranking) {
    const mem = Number.isFinite(item.medianPeakWorkingSetBytes) ? `${(item.medianPeakWorkingSetBytes / 1_048_576).toFixed(1)} MiB` : '—';
    const time = Number.isFinite(item.medianWallTimeMs) ? `${item.medianWallTimeMs.toFixed(0)} ms` : '—';
    lines.push(`| ${item.rank} | ${item.converterId} | ${item.correctness.pass ?? 0} | ${item.correctness.warning ?? 0} | ${item.correctness.fail ?? 0} | ${item.correctness.inconclusive ?? 0} | ${time} | ${mem} |`);
  }
  lines.push('');

  lines.push('## Where the process itself failed (crash, timeout, invalid output)');
  lines.push('');
  if (!summary.processErrorSummary.length) lines.push('_No process-level failures recorded._');
  else {
    lines.push('| Reason | Attempts | Example case |');
    lines.push('| --- | --- | --- |');
    for (const item of summary.processErrorSummary) lines.push(`| ${item.reason.replaceAll('|', '\\|').slice(0, 200)} | ${item.attempts} | ${item.exampleCaseId ?? '—'} |`);
  }
  lines.push('');

  lines.push('## Why conversions that ran scored as failures');
  lines.push('');
  lines.push('Reasons attached to completed conversions that still failed correctness (partial fidelity, Galaxy AST or GUI-trigger mismatches, error diagnostics), ranked by how many attempts hit them.');
  lines.push('');
  if (!summary.failureReasons.length) lines.push('_No scored failures._');
  else {
    lines.push('| Reason | Attempts | Cases affected | Example cases |');
    lines.push('| --- | --- | --- | --- |');
    for (const item of summary.failureReasons) lines.push(`| ${item.reason} | ${item.attempts} | ${item.caseCount} | ${item.examples.join(', ')} |`);
  }
  lines.push('');

  lines.push('## Most common converter diagnostics');
  lines.push('');
  lines.push('Diagnostic codes the converter itself reported (warnings and errors), aggregated across every attempt.');
  lines.push('');
  if (!summary.diagnostics.length) lines.push('_No diagnostics recorded._');
  else {
    lines.push('| Severity | Code | Occurrences | Cases affected | Example message |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const item of summary.diagnostics.slice(0, 30)) {
      lines.push(`| ${item.severity} | ${item.code} | ${item.count} | ${item.caseCount} | ${(item.example ?? '').replaceAll('|', '\\|').slice(0, 160)} |`);
    }
    if (summary.diagnostics.length > 30) lines.push(`\n_${summary.diagnostics.length - 30} more diagnostic codes not shown._`);
  }
  lines.push('');

  lines.push('## Worst-scoring cases');
  lines.push('');
  lines.push('Cases with a process error, a scored failure, or mixed attempt results, sorted by lowest AST similarity first.');
  lines.push('');
  if (!summary.worstCases.length) lines.push('_No failing cases._');
  else {
    lines.push('| Map / mod | Kind | Status | AST similarity | Reasons |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const item of summary.worstCases.slice(0, 60)) {
      const similarity = Number.isFinite(item.astSimilarityPercent) ? `${item.astSimilarityPercent}%` : '—';
      lines.push(`| ${item.displayName} | ${item.documentKind} | ${item.shortStatus} | ${similarity} | ${item.reasons.join('; ') || '—'} |`);
    }
    if (summary.worstCases.length > 60) lines.push(`\n_${summary.worstCases.length - 60} more failing cases not shown; see report.json for the full list._`);
  }
  lines.push('');
  return lines.join('\n');
}

export async function writeErrorReport(reportJsonPath, outputPath) {
  const report = JSON.parse(await readFile(reportJsonPath, 'utf8'));
  const summary = buildErrorReport(report);
  const markdown = renderErrorReportMarkdown(summary);
  const target = path.resolve(outputPath ?? path.join(path.dirname(reportJsonPath), 'converter-errors.md'));
  await writeFile(target, markdown);
  return { target, summary };
}

async function main() {
  const [reportJsonPath, outputPath] = process.argv.slice(2);
  if (!reportJsonPath) {
    console.error('Usage: node src/error-report.mjs <report.json> [output.md]');
    process.exitCode = 2;
    return;
  }
  const { target } = await writeErrorReport(reportJsonPath, outputPath);
  console.log(target);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

// Side-by-side table of two or more converters from a finished run (and, optionally, its
// triggers-to-galaxy cross-compile run made by src/t2g-crosscheck.mjs).
// Usage: node src/converter-comparison.mjs <run directory> [<t2g run directory>] [--out <file.md>]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outFile = outIndex >= 0 ? args.splice(outIndex, 2)[1] : undefined;
const [runDirectory, t2gDirectory] = args;
if (!runDirectory) {
  console.error('Usage: node src/converter-comparison.mjs <run directory> [<t2g run directory>] [--out <file.md>]');
  process.exit(2);
}

const load = directory => ({
  report: JSON.parse(readFileSync(path.join(directory, 'report.json'), 'utf8')),
  summary: JSON.parse(readFileSync(path.join(directory, 'summary.json'), 'utf8')),
});
const mib = bytes => Number.isFinite(bytes) ? `${Math.round(bytes / 2 ** 20)}` : '—';
const sec = ms => Number.isFinite(ms) ? (ms >= 100_000 ? `${Math.round(ms / 1000)}` : `${(ms / 1000).toFixed(1)}`) : '—';
const pct = value => Number.isFinite(value) ? `${value.toFixed(1)}%` : '—';
const num = value => Number.isFinite(value) ? String(value) : '—';
const reason = result => {
  if (!result) return 'не запускался';
  if (result.status === 'timeout') return `таймаут ${sec(result.wallTimeMs)} с`;
  const text = String(result.roundtripConversion?.error ?? result.error ?? '');
  const galaxy = /ConvertMapRunner exited with code \d+/u.exec(text)?.[0];
  const line = text.split(/\r?\n/u).map(item => item.trim()).find(item => /FATAL|Exception|expected=|Cannot|No proven|FORBIDDEN|STATE=/u.test(item));
  return [result.status, galaxy, line].filter(Boolean).join(': ').slice(0, 220);
};

const main = load(runDirectory);
const converters = main.summary.ranking.map(entry => entry.converterId).sort();
const results = new Map(main.summary.results.map(result => [`${result.caseId}\0${result.converterId}`, result]));
const caseRows = new Map(main.report.caseResults.map(row => [`${row.caseId}\0${row.converterId}`, row]));
const cases = [...new Set(main.summary.results.map(result => result.caseId))];
const name = caseId => {
  const row = main.report.caseResults.find(item => item.caseId === caseId);
  return (row?.displayName ?? caseId).replace(/\.sc2map$/iu, '');
};

const lines = [];
lines.push(`Прогон: \`${path.basename(runDirectory)}\` (${main.summary.startedAt} → ${main.summary.finishedAt})`, '');
lines.push('| Карта | Конвертер | Статус | Совпадение Galaxy (AST) | CustomScript (оригинал) | GUI-триггеры (оригинал) | Galaxy→Triggers, с | в т.ч. загрузка зависимостей, с | Triggers→Galaxy, с | Всего, с | Пик памяти дерева, МиБ | Процессы |');
lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const caseId of cases) {
  for (const converter of converters) {
    const result = results.get(`${caseId}\0${converter}`);
    const row = caseRows.get(`${caseId}\0${converter}`);
    const metrics = result?.converterMetrics ?? {};
    const gui = metrics.guiFidelity ?? {};
    const expected = result?.guiComparison?.expected ?? {};
    // Galaxy -> Triggers as the user waits for it: process start to written Triggers.
    const galaxyToTriggers = converter === 'modkit'
      ? (metrics.startupMs ?? 0) + (metrics.dependencyLoadMs ?? 0) + (metrics.galaxyToTriggersMs ?? Number.NaN)
      : metrics.galaxyToTriggersMs;
    const dependencies = converter === 'modkit' ? metrics.dependencyLoadMs : metrics.kspExtractMs;
    const status = result?.status === 'completed'
      ? (result.roundtripConversion?.status === 'failed' ? 'Triggers есть, Galaxy нет' : 'готово')
      : reason(result);
    lines.push(`| ${name(caseId)} | ${converter} | ${status} | ${pct(row?.outputMetrics?.astSimilarityPercent)} | ${num(gui.customScriptTagCount)} (${num(expected.customScriptTagCount)}) | ${num(gui.guiTriggerCount)} (${num(expected.typeCounts?.Trigger)}) | ${sec(galaxyToTriggers)} | ${sec(dependencies)} | ${sec(metrics.triggersToGalaxyMs)} | ${sec(result?.wallTimeMs)} | ${mib(result?.peakWorkingSetBytes)} | ${(result?.treeProcessNames ?? []).join(', ')} |`);
  }
}

if (t2gDirectory) {
  const t2g = load(t2gDirectory);
  const compilers = [...new Set(t2g.summary.results.map(result => result.converterId))].sort();
  const t2gRows = new Map(t2g.report.caseResults.map(row => [`${row.caseId}\0${row.converterId}`, row]));
  const t2gResults = new Map(t2g.summary.results.map(result => [`${result.caseId}\0${result.converterId}`, result]));
  const sources = ['original-triggers', 'modkit-triggers', 'ksp-triggers', 'ksp-triggers-full-map'];
  const label = { 'original-triggers': 'Triggers оригинала', 'modkit-triggers': 'Triggers Modkit', 'ksp-triggers': 'Triggers KSP', 'ksp-triggers-full-map': 'Triggers KSP (карта с Triggers)' };
  lines.push('', `Перекрёстная компиляция: \`${path.basename(t2gDirectory)}\`. Совпадение Galaxy с оригинальным MapScript.galaxy (AST).`, '');
  lines.push(`| Карта | Источник Triggers | ${compilers.map(item => `Компилятор ${item.replace(/-t2g$/u, '')}`).join(' | ')} |`);
  lines.push(`| --- | --- | ${compilers.map(() => '---').join(' | ')} |`);
  for (const caseId of cases) {
    for (const source of sources) {
      const id = `${caseId}.${source}`;
      if (!t2g.summary.results.some(result => result.caseId === id)) continue;
      const cells = compilers.map(compiler => {
        const result = t2gResults.get(`${id}\0${compiler}`);
        const row = t2gRows.get(`${id}\0${compiler}`);
        if (result?.status === 'completed') return pct(row?.outputMetrics?.astSimilarityPercent);
        const blocking = (result?.diagnostics ?? []).find(item => item.code === 'ksp/no-regenerated-galaxy')?.message;
        return `нет (${(blocking ?? reason(result)).slice(0, 120)})`;
      });
      lines.push(`| ${name(caseId)} | ${label[source]} | ${cells.join(' | ')} |`);
    }
  }
}

const text = `${lines.join('\n')}\n`;
if (outFile) writeFileSync(outFile, text);
process.stdout.write(text);

// Summary of report.json files: AST similarity, CustomScript, time, memory; pairs cases by package name.
// Usage: node src/run-stats.mjs <new run> [old run]  (run directory names under .benchmark-runs)
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '.benchmark-runs');
const excluded = new Set(['complex-map-029']);
const load = run => JSON.parse(fs.readFileSync(path.join(root, run, 'report.json'), 'utf8'));
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
};
function rows(run) {
  return load(run).caseResults.filter(c => !excluded.has(c.caseId)).map(c => ({
    id: c.caseId, name: c.displayName, status: c.shortStatus,
    completed: (c.attempts ?? []).some(a => a.status === 'completed'),
    sim: c.outputMetrics?.astSimilarityPercent, diffs: c.outputMetrics?.astDifferences,
    cs: c.outputMetrics?.customScriptTags, gui: c.outputMetrics?.guiTriggers,
    time: c.performance?.wallTimeMs?.median, mem: c.performance?.peakWorkingSetBytes?.median,
    correctness: c.correctnessCounts,
  }));
}
function summary(label, list) {
  const done = list.filter(r => r.completed);
  const sims = done.map(r => r.sim).filter(Number.isFinite);
  console.log(`${label}: cases ${list.length}, completed ${done.length}, exact ${list.filter(r => r.correctness?.pass).length}`);
  console.log(`  AST similarity: median ${median(sims)}%, >=99% ${sims.filter(s => s >= 99).length}, >=90% ${sims.filter(s => s >= 90).length}, <50% ${sims.filter(s => s < 50).length} (of ${sims.length})`);
  console.log(`  CustomScript tags median ${median(done.map(r => r.cs))}, GUI triggers median ${median(done.map(r => r.gui))}`);
  console.log(`  time median ${(median(done.map(r => r.time)) / 1000).toFixed(0)} s, max ${(Math.max(...done.map(r => r.time)) / 1000).toFixed(0)} s; memory median ${(median(done.map(r => r.mem)) / 2 ** 20).toFixed(0)} MiB, max ${(Math.max(...done.map(r => r.mem)) / 2 ** 20).toFixed(0)} MiB`);
}
const [newRun, oldRun] = process.argv.slice(2);
const fresh = rows(newRun);
summary('new', fresh);
if (oldRun) {
  const old = rows(oldRun);
  summary('old', old);
  const byName = new Map(old.filter(r => r.completed).map(r => [r.name, r]));
  const pairs = fresh.filter(r => r.completed && byName.has(r.name)).map(r => [r, byName.get(r.name)]);
  const better = pairs.filter(([n, o]) => n.sim > o.sim), worse = pairs.filter(([n, o]) => n.sim < o.sim);
  console.log(`paired completed in both: ${pairs.length}; similarity up ${better.length}, down ${worse.length}, same ${pairs.length - better.length - worse.length}`);
  console.log(`  paired median similarity old ${median(pairs.map(([, o]) => o.sim))}% -> new ${median(pairs.map(([n]) => n.sim))}%; CustomScript old ${median(pairs.map(([, o]) => o.cs))} -> new ${median(pairs.map(([n]) => n.cs))}`);
  for (const [n, o] of worse.sort((a, b) => (a[0].sim - a[1].sim) - (b[0].sim - b[1].sim)).slice(0, 8)) {
    console.log(`  down: ${n.name} ${o.sim}% -> ${n.sim}%, CS ${o.cs} -> ${n.cs}`);
  }
}
console.log('lowest new:', fresh.filter(r => r.completed).sort((a, b) => a.sim - b.sim).slice(0, 8).map(r => `${r.name} ${r.sim}% CS ${r.cs}`).join('; '));

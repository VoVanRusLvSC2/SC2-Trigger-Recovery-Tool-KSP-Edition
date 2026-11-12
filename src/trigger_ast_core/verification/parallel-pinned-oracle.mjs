// Bounded parallel execution of the unchanged independent oracle. File bytes
// are SHA-checked before parsing, and each worker seals all inputs on exit.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';
import {performance} from 'node:perf_hooks';
import {EvidenceSession} from './evidence-session.mjs';
import {openPinnedOracle} from '../../benchmark_review_v3_20261019/pinned-oracle.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function comparePartition(pairs, options) {
  const started = performance.now(), session = new EvidenceSession();
  const {oracle, assetCount} = await openPinnedOracle(session);
  const comparisons = [];
  for (const pair of pairs) {
    const strings = [];
    for (const pin of [pair.before, pair.after]) {
      await session.verify(pin.path, pin.sha256);
      const bytes = await readFile(pin.path);
      assert.equal(sha(bytes), pin.sha256, 'ORACLE_PARSED_BYTES_SHA_CHANGED');
      strings.push(bytes.toString('utf8'));
    }
    const started = performance.now();
    // Preserve precisely the JSON projection produced by the serial runner.
    const comparison = JSON.parse(JSON.stringify(oracle.compareGalaxy(...strings, options)));
    comparisons.push({id: pair.id, comparison, seconds: (performance.now() - started) / 1000});
  }
  const metrics = await session.seal();
  return {comparisons, metrics, assetCount, seconds: (performance.now() - started) / 1000};
}

export async function comparePinnedOraclePairs(pairs, {workers = 2,
  options = {libraryId: 'Map', sampleLimit: 12}} = {}) {
  assert(Number.isSafeInteger(workers) && workers >= 1 && workers <= 4, 'ORACLE_WORKER_LIMIT');
  assert.equal(new Set(pairs.map(p => p.id)).size, pairs.length, 'DUPLICATE_ORACLE_PAIR_ID');
  for (const pair of pairs) {
    assert.equal(typeof pair.id, 'string');
    for (const pin of [pair.before, pair.after]) {
      assert.equal(typeof pin.path, 'string');
      assert.match(pin.sha256, /^[a-f0-9]{64}$/u);
    }
  }
  if (!pairs.length) return {comparisons: new Map(), partitions: [], workers: 0};
  const partitions = Array.from({length: Math.min(workers, pairs.length)}, () => []);
  // Round-robin scheduling contains no name/hash exceptions or saved verdicts.
  pairs.forEach((pair, i) => partitions[i % partitions.length].push(pair));
  const active = [];
  const pending = partitions.map(partition => new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: {task: 'PINNED_ORACLE_PARTITION', pairs: partition, options},
      resourceLimits: {maxOldGenerationSizeMb: 1024},
    });
    active.push(worker);
    let report;
    worker.on('message', message => { report = message; });
    worker.on('error', reject);
    // Resolve only after a clean exit, including the worker's final SHA seal.
    worker.on('exit', code => {
      if (code !== 0 || !report) reject(new Error(`ORACLE_WORKER_FAILED:${code}`));
      else resolve(report);
    });
  }));
  let reports;
  try { reports = await Promise.all(pending); }
  finally { await Promise.allSettled(active.map(worker => worker.terminate())); }
  const comparisons = new Map();
  reports.forEach((report, i) => {
    assert.equal(report.assetCount, 304);
    assert.equal(report.metrics.sealed, true);
    assert.deepEqual(report.comparisons.map(r => r.id), partitions[i].map(r => r.id));
    for (const row of report.comparisons) {
      assert(!comparisons.has(row.id));
      comparisons.set(row.id, row);
    }
  });
  assert.equal(comparisons.size, pairs.length);
  return {comparisons, partitions: reports.map(({comparisons, ...metadata}) => metadata), workers: reports.length};
}

if (!isMainThread && workerData?.task === 'PINNED_ORACLE_PARTITION') {
  parentPort.postMessage(await comparePartition(workerData.pairs, workerData.options));
}

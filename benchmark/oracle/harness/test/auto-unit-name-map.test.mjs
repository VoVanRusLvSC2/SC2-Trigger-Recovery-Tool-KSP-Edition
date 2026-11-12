import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runBenchmark } from '../src/benchmark.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = path.join(projectRoot, 'benchmark.auto-unit-name-map.json');
const map = path.resolve(projectRoot, '../artifacts/corpus-installed-2026-09-16/originals/UEDFL_EP01M19_TheFallOfTarsus.SC2Map');
const converter = path.resolve(projectRoot, '../modkit-extensions-blizzard/starcraft2/dist/modules/triggers/services/galaxy-conversion/index.js');

test('real map round-trip preserves generated unit and trigger handle names', {
  skip: !existsSync(map) || !existsSync(converter) ? 'real map or built ModKit converter is unavailable' : false,
}, async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'galaxy-auto-unit-name-'));
  try {
    const summary = await runBenchmark(manifest, outputRoot);
    const result = summary.results[0];
    assert.equal(result.status, 'completed');
    const script = result.outputArtifacts.find(artifact => artifact.role === 'roundtrip-script');
    assert.ok(script, 'round-trip Galaxy script is missing');
    const galaxy = await readFile(script.path, 'utf8');
    assert.match(galaxy, /\bunit auto9DE7D937_var\s*;/u);
    assert.doesNotMatch(galaxy, /\blv_auto9DE7D937_var\b/u);
    assert.match(galaxy, /\bauto9DE7D937_var\s*=\s*UnitGroupUnitFromEnd\(/u);
    assert.match(galaxy, /\bgt_DefeatCheat\s*=\s*TriggerCreate\(/u);
    assert.doesNotMatch(galaxy, /\bgv_gt_DefeatCheat\b/u);
    const header = result.outputArtifacts.find(artifact => artifact.role === 'roundtrip-header');
    assert.ok(header, 'round-trip Galaxy header is missing');
    const declarations = await readFile(header.path, 'utf8');
    assert.match(declarations, /\btrigger gt_DefeatCheat\s*;/u);
    assert.doesNotMatch(declarations, /\bgv_gt_DefeatCheat\b/u);
    const report = JSON.parse(await readFile(path.join(summary.runDirectory, 'report.json'), 'utf8'));
    const declarationDiff = report.caseResults[0].attempts[0].structuralComparison.script.astMetrics.components.declarations;
    assert.equal(declarationDiff.missing, 0, 'header declarations must be included in the AST comparison');
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

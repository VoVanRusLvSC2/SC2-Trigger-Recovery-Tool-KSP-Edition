// Preserve raw primary/attribute/resource reports; add a necessary byte-literal
// veto before any standalone primary MATCH may be used.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {EvidenceSession} from './evidence-session.mjs';
import {openPinnedOracle} from '../../benchmark_review_v3_20261019/pinned-oracle.mjs';
import {guardOracleLiteralBytes} from './string-literal-byte-oracle.mjs';

const [job, out] = process.argv.slice(2); assert(job && out);
const previous = fileURLToPath(new URL('./benchmark-generated-job.resource-values.mjs', import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(digest(await readFile(previous)), 'd22ecfcead7fc409c10efd36b81d8c6ce849b38e14987bcaf6edc0f192cfc74b');
await promisify(execFile)(process.execPath, [previous, job, out], {windowsHide: true, maxBuffer: 4 * 1024 ** 2});
const session = new EvidenceSession();
const primary = await session.json(path.join(out, 'BENCHMARK.json'));
const resources = await session.json(path.join(out, 'BENCHMARK_WITH_RESOURCES.json'));
const {oracle, assetCount} = await openPinnedOracle(session), texts = [];
for (const [file, expected] of [[primary.originalGalaxy, primary.originalGalaxySha256],
  [primary.generatedGalaxy, primary.generatedGalaxySha256]]) {
  await session.verify(file, expected); const bytes = await readFile(file);
  assert.equal(digest(bytes), expected, 'LITERAL_GUARD_INPUT_CHANGED');
  texts.push(new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes));
}
const guard = guardOracleLiteralBytes(oracle, ...texts, primary.comparison);
assert.equal(guard.sourceSha256, primary.originalGalaxySha256);
assert.equal(guard.generatedSha256, primary.generatedGalaxySha256);
const vetoed = primary.comparison.exact === true && !guard.matchAllowed;
const metrics = await session.seal();
const report = {id: primary.id, rawPrimaryVerdict: primary.primaryVerdict,
  guardedPrimaryVerdict: vetoed ? 'REVIEW' : primary.primaryVerdict,
  combinedVerdict: vetoed ? 'REVIEW' : resources.combinedVerdict, literalByteGuard: guard, vetoed,
  primaryReport: {path: path.join(out, 'BENCHMARK.json'), sha256: digest(await readFile(path.join(out, 'BENCHMARK.json')))},
  resourceReport: {path: path.join(out, 'BENCHMARK_WITH_RESOURCES.json'), sha256: digest(await readFile(path.join(out, 'BENCHMARK_WITH_RESOURCES.json')))},
  metrics, benchmarkAssetsVerified: assetCount, originalOracleChanged: false,
  actualEditor: false, accepted: false, wholeProgramEquivalent: false,
  scope: 'Additional veto on standalone raw MATCH; never upgrades REVIEW and never replaces root/SDK/GUI/attribute/dependency/resource or Editor gates.'};
await writeFile(path.join(out, 'BENCHMARK_WITH_LITERAL_BYTES.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({id: report.id, rawPrimaryVerdict: report.rawPrimaryVerdict,
  guardedPrimaryVerdict: report.guardedPrimaryVerdict, combinedVerdict: report.combinedVerdict,
  literalByteGuard: guard.status, vetoed, actualEditor: false, accepted: false}));

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectConditionHelpers } from '../src/verification/condition-helper-evidence.mjs';

const [originalPath, generatedPath, reportPath] = process.argv.slice(2);
if (!originalPath || !generatedPath || !reportPath)
  throw new Error('Usage: node scripts/inspect-condition-helpers.mjs ORIGINAL GENERATED REPORT');
const [original, generated] = await Promise.all([
  readFile(originalPath, 'utf8'),
  readFile(generatedPath, 'utf8'),
]);
const result = inspectConditionHelpers(original, generated);
const c = result.comparison;
const summary = (section) => ({
  exact: section.exact?.length ?? null,
  equivalent: section.equivalent?.length ?? null,
  missing: section.missing?.length ?? null,
  added: section.added?.length ?? null,
  differing: section.differing?.length ?? null,
  duplicateExpected: section.duplicateExpected?.length ?? null,
  duplicateActual: section.duplicateActual?.length ?? null,
});
const report = {
  kind: 'STATIC_CONDITION_HELPER_EVIDENCE',
  originalSha256: createHash('sha256').update(original).digest('hex'),
  generatedSha256: createHash('sha256').update(generated).digest('hex'),
  helpersExpanded: result.helpersExpanded,
  helpersRefused: result.helpersRefused,
  strictExactAfterExpansion: result.strictExactAfterExpansion,
  businessVerdictAfterExpansion: result.businessVerdictAfterExpansion,
  businessFunctions: result.businessComparison
    ? summary(result.businessComparison.functions)
    : null,
  businessIncludes: result.businessComparison?.includes ?? null,
  functions: summary(c.functions),
  declarations: summary(c.declarations),
  includes: c.includes,
  calls: c.calls,
  triggerRegistrations: c.triggerRegistrations,
  limitations: result.limitations,
  benchmarkUnchanged: true,
  editorVerified: false,
};
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));

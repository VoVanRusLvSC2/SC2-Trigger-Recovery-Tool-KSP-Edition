import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.mjs';
import {indexSourceFunctionDeclarations} from '../model/source-function-declarations.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function assertNativeRootDeclarationOwnership(source) {
  const ast = parseImmutableGalaxySyntax(source, 'NativeRoot.galaxy');
  assert.equal(ast.parseDiagnostics.length, 0, 'NATIVE_ROOT_SYNTAX_INVALID');
  for (const [name, group] of indexSourceFunctionDeclarations(new Map([[ast.fileName, ast]]))) {
    assert(group.status !== 'ABI_CONFLICT', 'NATIVE_ROOT_DECLARATION_ABI_CONFLICT:' + name);
    assert(group.declarations.filter(item => item.node.body).length <= 1,
      'NATIVE_ROOT_DUPLICATE_RUNTIME_OWNER:' + name);
  }
}

// Transport success, compilation, source ownership and export completeness are
// separate obligations. The semantic proof still compares the complete root.
export async function readVerifiedNativeRootExport(evidencePath, expected) {
  const evidenceBytes = await readFile(evidencePath);
  const evidence = JSON.parse(evidenceBytes.toString('utf8'));
  assert.equal(evidence.state, 'NATIVE_EXPORTED_AND_COMPARED', 'NATIVE_ROOT_EXPORT_NOT_TERMINAL');
  assert(evidence.actualEditor && evidence.sourceUnchanged, 'NATIVE_ROOT_ACTUAL_EDITOR_REQUIRED');
  assert(evidence.nativeCompilePassed && evidence.nativeGenerationVerified, 'NATIVE_ROOT_COMPILE_AND_EXPORT_REQUIRED');
  assert.equal(evidence.candidateSha256, expected.candidateSha256, 'NATIVE_ROOT_CANDIDATE_MISMATCH');
  assert.equal(evidence.originalArchive?.sha256, expected.originalArchiveSha256, 'NATIVE_ROOT_ORIGINAL_ARCHIVE_MISMATCH');
  assert.equal(sha(await readFile(evidence.candidate)), expected.candidateSha256, 'NATIVE_ROOT_CANDIDATE_CHANGED');
  const job = evidence.job;
  assert.equal(job?.state, 'completed', 'NATIVE_ROOT_JOB_NOT_COMPLETED');
  const result = job.result;
  assert(result?.sourceUnchanged, 'NATIVE_ROOT_CHECK_INPUT_CHANGED');
  const compile = result.checks?.compile;
  assert(compile?.nativeCompilePassed && compile.nativeGenerationVerified, 'NATIVE_ROOT_CHECK_NOT_CONFIRMED');
  const comparisonBytes = await readFile(evidence.comparison.path);
  assert.equal(sha(comparisonBytes), evidence.comparison.sha256, 'NATIVE_ROOT_COMPARISON_CHANGED');
  const comparison = JSON.parse(comparisonBytes.toString('utf8'));
  assert.equal(comparison.candidateSha256, expected.candidateSha256, 'NATIVE_ROOT_COMPARISON_CANDIDATE_MISMATCH');
  assert.equal(comparison.originalGalaxySha256, expected.rawOriginalRootSha256, 'NATIVE_ROOT_RAW_ORIGINAL_REQUIRED');
  assert(comparison.actualEditor && comparison.sourceUnchanged, 'NATIVE_ROOT_COMPARISON_SOURCE_NOT_VERIFIED');
  assert(comparison.exportCompleteness?.bytesMatch && comparison.exportCompleteness.sha256Matches
    && comparison.exportCompleteness.syntaxValid, 'NATIVE_ROOT_INCOMPLETE_EXPORT');
  const artifact = comparison.nativeGalaxy;
  assert.equal(artifact?.sha256, result.galaxy?.artifact?.sha256, 'NATIVE_ROOT_JOB_EXPORT_MISMATCH');
  assert.equal(artifact?.sha256, compile.sourceSha256, 'NATIVE_ROOT_COMPILED_EXPORT_MISMATCH');
  const bytes = await readFile(artifact.path);
  assert.equal(bytes.length, artifact.bytes, 'NATIVE_ROOT_EXPORT_BYTES_MISMATCH');
  assert.equal(sha(bytes), artifact.sha256, 'NATIVE_ROOT_EXPORT_CHANGED');
  assertNativeRootDeclarationOwnership(bytes.toString('utf8'));
  return {text: bytes.toString('utf8'), artifact,
    evidence: {path: evidencePath, sha256: sha(evidenceBytes)},
    comparison: evidence.comparison, actualEditor: true, wholeMapAccepted: false};
}

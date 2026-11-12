// Presentation of qualified evidence only. Unequal syntax or missing proof is
// not a demonstrated change of business logic; Editor acceptance is separate.
import assert from 'node:assert/strict';

export const requiredOfflineAxes = Object.freeze([
  'root', 'gui', 'generatedSdk', 'sourceSdk', 'sourceReference', 'attributes', 'dependencies',
]);
const states = new Set(['PASSED', 'REVIEW', 'NOT_RUN', 'UNAVAILABLE', 'INVALID']);

export function summarizeOfflineEvidence({id, name, axes, legacy = {}}) {
  assert.equal(typeof id, 'string');
  const normalized = Object.fromEntries(requiredOfflineAxes.map(key => {
    const axis = axes[key] ?? {status: 'NOT_RUN', reason: 'EVIDENCE_ABSENT'};
    assert(states.has(axis.status), `UNKNOWN_EVIDENCE_STATUS:${key}`);
    assert.equal(typeof axis.reason, 'string', `EVIDENCE_REASON_MISSING:${key}`);
    return [key, Object.freeze({...axis})];
  }));
  const pending = requiredOfflineAxes.filter(key => normalized[key].status !== 'PASSED');
  const rootProved = normalized.root.status === 'PASSED';
  const status = requiredOfflineAxes.some(key => normalized[key].status === 'INVALID') ? 'EVIDENCE_INVALID'
    : !pending.length ? 'PASSED_OFFLINE_EDITOR_PENDING'
    : normalized.root.status === 'UNAVAILABLE' ? 'SOURCE_UNAVAILABLE'
    : normalized.gui.status === 'UNAVAILABLE' ? 'GUI_RECOVERY_INCOMPLETE' : 'REVIEW';
  return Object.freeze({id, name, status, axes: Object.freeze(normalized),
    pendingOffline: Object.freeze(pending),
    codeConclusion: rootProved ? 'EQUIVALENT_FOR_PINNED_ROOT_UNDER_RECORDED_GUARDS' : 'NOT_PROVED',
    businessLogicMismatch: 'NOT_DEMONSTRATED_BY_THIS_REPORT',
    attributeCodeConclusion: rootProved ? 'ROOT_ATTRIBUTE_EXPRESSIONS_INCLUDED_IN_CODE_PROOF' : 'NOT_PROVED',
    originalAttributeDataProved: normalized.attributes.status === 'PASSED',
    editor: 'NOT_RUN_DEFERRED_BY_USER', editorEquivalentCompiler: false,
    wholeProgramEquivalent: false, wholeMapAccepted: false,
    legacy: Object.freeze({...legacy})});
}

// Adapt the separately qualified older reports without changing their verdicts.
// Do not use this adapter on unqualified worker summaries.
export function summarizeQualifiedRow(row, {attributeContract} = {}) {
  const axis = (ok, reason, otherwise = 'REVIEW') => ({status: ok ? 'PASSED' : otherwise, reason});
  const root = row.rootProofStatus === 'PROVED' && row.codeProof === 'GUARDED_ROOT_PROVED';
  const unavailable = row.codeProof === 'SOURCE_PREPARATION_NOT_READY';
  // Approved new test settings are useful, but never prove the original lobby.
  const testDefaults = attributeContract?.documents?.approvedTestDefaults === true;
  const attributeGuiFailure = attributeContract?.gui?.passed === false;
  return summarizeOfflineEvidence({id: row.id, name: row.name, axes: {
    root: axis(root, root ? 'STRICT_ROOT_PROOF_EXACT' : row.codeProof,
      unavailable ? 'UNAVAILABLE' : row.codeProof === 'NOT_GENERATED' ? 'NOT_RUN' : 'REVIEW'),
    gui: axis(row.guiProof === 'PACKED_GUI_PASSED' && !attributeGuiFailure,
      attributeGuiFailure ? 'ATTRIBUTE_GUI_CONTRACT_UNCLOSED' : row.guiProof ?? 'PACKED_GUI_NOT_CHECKED',
      attributeGuiFailure ? 'REVIEW' : row.codeProof === 'NOT_GENERATED' ? 'UNAVAILABLE' : 'NOT_RUN'),
    generatedSdk: axis(row.offlineTypes === 'SDK_CONTRACT_PASSED', row.offlineTypes ?? 'SDK_NOT_CHECKED',
      row.benchmarkExecuted ? 'REVIEW' : 'NOT_RUN'),
    sourceSdk: axis(row.sourceProof === 'ORIGINAL_SOURCE_SDK_PASSED', row.sourceProof ?? 'SOURCE_NOT_CHECKED',
      unavailable ? 'UNAVAILABLE' : 'REVIEW'),
    sourceReference: axis(row.originalArchiveReference === 'PROVED', row.originalArchiveReference ?? 'REFERENCE_NOT_CHECKED',
      unavailable ? 'UNAVAILABLE' : row.codeProof === 'NOT_GENERATED' ? 'NOT_RUN' : 'REVIEW'),
    attributes: axis(row.attributeProof === 'OLD_STRICT_ATTRIBUTE_CONTRACT_PASSED' && !testDefaults,
      testDefaults ? 'APPROVED_TEST_DEFAULTS_NOT_ORIGINAL' : row.attributeProof,
      row.attributeProof === 'NOT_AUDITED' ? 'NOT_RUN' : 'REVIEW'),
    dependencies: axis(row.dependencyStatus === 'INSTALLED_STANDARD_DEPENDENCIES_USED', row.dependencyStatus,
      unavailable ? 'UNAVAILABLE' : 'REVIEW'),
  }, legacy: {primaryVerdict: row.primaryVerdict ?? null, overallVerdict: row.overallVerdict ?? row.verdict ?? null,
    pendingChecks: Object.freeze([...(row.pendingChecks ?? [])])}});
}

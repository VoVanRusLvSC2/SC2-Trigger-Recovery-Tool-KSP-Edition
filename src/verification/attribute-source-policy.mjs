// Describe provenance already verified by the source adapter. This never grants
// approval or proves an original lobby. Any explicit new-default evidence wins
// over an absent/false legacy flag, including partial default overrides.
import assert from 'node:assert/strict';

export function describeAttributeSourcePolicy(source) {
  assert(source && typeof source.used === 'boolean', 'ATTRIBUTE_SOURCE_USAGE_REQUIRED');
  if (!source.used)
    return Object.freeze({
      used: false,
      usesNewTestDefaults: false,
      kind: 'NO_VERIFIED_RECOVERY_SOURCE',
      originalLobbyProven: false,
    });
  const proof = source.proof;
  assert(proof && typeof proof === 'object', 'ATTRIBUTE_SOURCE_PROOF_REQUIRED');
  for (const key of ['newTestDefaults', 'approvedTestDefaults'])
    assert(
      proof[key] === undefined || typeof proof[key] === 'boolean',
      'ATTRIBUTE_DEFAULT_FLAG_NOT_BOOLEAN',
    );
  const signals = [];
  for (const key of ['newTestDefaults', 'approvedTestDefaults'])
    if (proof[key] === true) signals.push(key);
  if (proof.explicitNewTestOverride !== undefined) {
    assert(
      proof.explicitNewTestOverride &&
        typeof proof.explicitNewTestOverride === 'object' &&
        !Array.isArray(proof.explicitNewTestOverride),
      'ATTRIBUTE_DEFAULT_OVERRIDE_NOT_OBJECT',
    );
    signals.push('explicitNewTestOverride');
  }
  // Compatibility with the existing certified historical source format.
  if (proof.sourceKind === 'APPROVED_NEW_TEST_DEFAULTS') signals.push('legacyApprovedDefaultsKind');
  const usesNewTestDefaults = signals.length > 0;
  return Object.freeze({
    used: true,
    usesNewTestDefaults,
    kind: usesNewTestDefaults
      ? 'VERIFIED_SOURCE_WITH_NEW_TEST_DEFAULTS'
      : 'VERIFIED_SOURCE_REFERENCE',
    signals: Object.freeze(signals),
    originalLobbyProven: false,
  });
}

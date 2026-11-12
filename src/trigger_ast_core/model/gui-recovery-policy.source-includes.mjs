import assert from 'node:assert/strict';

// These modes describe representation, never equivalence or benchmark success.
export const guiRecoveryModes = Object.freeze(['preserve-source', 'full-gui']);

export function resolveGuiRecoveryPolicy(input = {}) {
  const explicit = input.guiRecoveryMode;
  assert(explicit === undefined || guiRecoveryModes.includes(explicit), 'UNKNOWN_GUI_RECOVERY_MODE');
  assert(input.convertAdditionalScripts === undefined || typeof input.convertAdditionalScripts === 'boolean',
    'INVALID_CONVERT_ADDITIONAL_SCRIPTS');
  // Keep the existing explicit opt-in API compatible. An omitted flag is not an opt-in.
  const mode = explicit ?? (input.convertAdditionalScripts === true ? 'full-gui' : 'preserve-source');
  const convert = mode === 'full-gui';
  assert(input.convertAdditionalScripts === undefined || input.convertAdditionalScripts === convert,
    'CONFLICTING_GUI_RECOVERY_OPTIONS');
  return Object.freeze({mode, preserveAuthoredCode: !convert, convertAdditionalScripts: convert,
    selectedBy: explicit !== undefined ? 'guiRecoveryMode'
      : input.convertAdditionalScripts === true ? 'legacy-explicit-opt-in' : 'default',
    allowNewNative: false, allowNewFallbackCustomScript: false, allowSourceBoundIncludeNodes: !convert});
}

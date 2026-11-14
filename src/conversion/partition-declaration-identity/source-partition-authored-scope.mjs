import assert from 'node:assert/strict';
import { resolveGuiRecoveryPolicy } from '../../model/gui-recovery-policy.mjs';
import { withPartitionAuthoredSectionFunctions } from './authored-section-functions.mixed-atomic.mjs';

// A partition has new source offsets and a new content identity. Rebuild its
// authored bindings in that coordinate system; restore the parent's scope on
// exit. Original source bytes and the independent output checks stay intact.
export function withSourcePartitionAuthoredScope(input, operation) {
  assert(
    typeof input.script === 'string' && typeof operation === 'function',
    'SOURCE_PARTITION_INPUT_REQUIRED',
  );
  return withPartitionAuthoredSectionFunctions(input, resolveGuiRecoveryPolicy(input), operation);
}

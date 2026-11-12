import assert from 'node:assert/strict';
import {resolveGuiRecoveryPolicy} from '../model/gui-recovery-policy.mjs';
import {withAuthoredSectionFunctions} from '../../map_global_repair_v499_source_nominal_return_roles_2026-10-27/graph/fa80681ad509-29d678d-e2e17cf47c8a-299547cdd472-91a0eb51e031-authored-section-functions.mixed-atomic.mjs';

// A partition has new source offsets and a new content identity. Rebuild its
// authored bindings in that coordinate system; restore the parent's scope on
// exit. Original source bytes and the independent output checks stay intact.
export function withSourcePartitionAuthoredScope(input,operation){
 assert(typeof input.script==='string'&&typeof operation==='function','SOURCE_PARTITION_INPUT_REQUIRED');
 return withAuthoredSectionFunctions(input,resolveGuiRecoveryPolicy(input),operation);
}

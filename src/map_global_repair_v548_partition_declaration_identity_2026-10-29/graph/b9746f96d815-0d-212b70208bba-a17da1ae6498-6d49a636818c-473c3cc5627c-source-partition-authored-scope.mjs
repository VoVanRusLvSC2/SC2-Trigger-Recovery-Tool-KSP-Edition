import assert from 'node:assert/strict';
import {resolveGuiRecoveryPolicy} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/gui-recovery-policy.mjs';
import {withPartitionAuthoredSectionFunctions} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v548_partition_declaration_identity_2026-10-29/graph/5a4f51c22902-29d678d-e2e17cf47c8a-299547cdd472-91a0eb51e031-authored-section-functions.mixed-atomic.mjs';

// A partition has new source offsets and a new content identity. Rebuild its
// authored bindings in that coordinate system; restore the parent's scope on
// exit. Original source bytes and the independent output checks stay intact.
export function withSourcePartitionAuthoredScope(input,operation){
 assert(typeof input.script==='string'&&typeof operation==='function','SOURCE_PARTITION_INPUT_REQUIRED');
 return withPartitionAuthoredSectionFunctions(input,resolveGuiRecoveryPolicy(input),operation);
}

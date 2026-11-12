import {AsyncLocalStorage} from 'node:async_hooks';
import * as previous from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v477_bound_static_primary_storage_2026-10-27/graph/2dfe3239877c-60a8a7b758c9-709110eecf5b-bound-source-access.authored.mjs';
import {planBoundConcatAssignment} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/b794f7f4db7a-private-frame-concat-assignment.mjs';
export * from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v477_bound_static_primary_storage_2026-10-27/graph/2dfe3239877c-60a8a7b758c9-709110eecf5b-bound-source-access.authored.mjs';
const sourceProgram = new AsyncLocalStorage();
export function withBoundSourceCallReturns(program, operation) {
  return sourceProgram.run(program, () => previous.withBoundSourceCallReturns(program, operation));
}
export function privateFrameConcatAssignmentRecipe(node) {
  const program = sourceProgram.getStore();return program && planBoundConcatAssignment(program, node);
}

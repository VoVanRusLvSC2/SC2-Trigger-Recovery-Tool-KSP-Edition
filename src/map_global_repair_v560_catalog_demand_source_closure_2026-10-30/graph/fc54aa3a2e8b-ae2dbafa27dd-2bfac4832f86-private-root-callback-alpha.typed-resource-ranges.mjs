import {createPrivateRootResourceAlpha} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v560_catalog_demand_source_closure_2026-10-30/graph/343086498dc8-e957e2aa320e-64f218224ed6-private-root-resource-alpha.factory.mjs';
import {inspectNonCodeTexturePayload} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/non-code-texture-payload.bounded-ranges.mjs';
import {inspectNonCodeModelPayload} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/non-code-model-payload.bounded-ranges.mjs';
import {inspectNonCodeTargaPayload} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/non-code-targa-payload.bounded-ranges.mjs';
const implementation=createPrivateRootResourceAlpha({classifyResource:(name,bytes)=>inspectNonCodeTexturePayload(name,bytes)??inspectNonCodeModelPayload(name,bytes)??inspectNonCodeTargaPayload(name,bytes)});
export const {readPrivateRootArchiveScope,projectPrivateRootCallbackAlpha,qualifyArchiveBoundRootRoles,verifyProtectedRootSourcesUnchanged}=implementation;

import {createSourceMapStartupDependencies as create} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v534_root_startup_function_roles_2026-10-29/graph/1b6ec81ccf58-aaf4e0603bf3-source-map-startup-plan.mjs';
export {resolveSourceMapStartupPlan,resolveSourceMapStartupDependencies} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v534_root_startup_function_roles_2026-10-29/graph/1b6ec81ccf58-aaf4e0603bf3-source-map-startup-plan.mjs';

export function createSourceMapStartupDependencies(source,context){
 // A full-GUI conversion may retire the owned source bodies. Its original
 // payload cannot authorize an initializer as a preserved source-only library.
 const result=create(source,context?.preserveOwnedSources===false?{...context,ownedSources:[]}:context);
 // Diagnostic proof objects are public; capability facts must remain immutable
 // even if a caller edits its own returned report.
 for(const row of result.proof.sourceFunctions?.functions??[])Object.freeze(row);
 return result;
}

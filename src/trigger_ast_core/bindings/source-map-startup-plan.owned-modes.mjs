import {createSourceMapStartupDependencies as create} from './source-map-startup-plan.mjs';
export {resolveSourceMapStartupPlan,resolveSourceMapStartupDependencies} from './source-map-startup-plan.mjs';

export function createSourceMapStartupDependencies(source,context){
 // A full-GUI conversion may retire the owned source bodies. Its original
 // payload cannot authorize an initializer as a preserved source-only library.
 const result=create(source,context?.preserveOwnedSources===false?{...context,ownedSources:[]}:context);
 // Diagnostic proof objects are public; capability facts must remain immutable
 // even if a caller edits its own returned report.
 for(const row of result.proof.sourceFunctions?.functions??[])Object.freeze(row);
 return result;
}

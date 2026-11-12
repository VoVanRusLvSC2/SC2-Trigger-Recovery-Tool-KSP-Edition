export {indexSourceFunctionDeclarations,canonicalSourceFunctionDeclaration} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/b30dc84db5cf-source-function-declarations.mjs';
import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';

export function publicAuthoredFunctionBodies(unit){
 const names=new Set(unit.publicCalls.map(c=>c.name)),result=[];
 for(const name of names){
  const declarations=unit.declarations.filter(d=>d.kind===K.FunctionDeclaration&&d.name===name);
  const bodies=declarations.filter(d=>d.hasBody);
  // Missing/duplicate bodies remain explicit unsupported entries for callers;
  // filtering them out would incorrectly turn a missing ABI into an empty set.
  result.push(...(bodies.length===1?bodies:declarations));
 }
 return result;
}

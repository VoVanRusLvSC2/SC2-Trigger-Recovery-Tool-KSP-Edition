/** An imported Galaxy record has no native GUI TypeElement unless the loaded
 * TriggerData actually declares one. Preserve the complete user-function body
 * in one existing NativeLib Custom Script action, including its local scope.
 * Never fabricate a duplicate record or replace the type with int.
 */
// @ts-nocheck
import {SyntaxKind} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d4f4db2b829c-index.js';
import {getTypeName,unwrapArrayType} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/bce993139bd2-6ec0feb66281-46bd418ac3313d57-g2t-core.mjs';
import {syntaxChildren} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/438d1ed6777b-cdbf9317cf44-298f67ce7553275e-script-template.mjs';
import {externalStructureDeclaration} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/28b83caf8550-ee997c280921-27b75105a25d12b1-external-structure-fields.mjs';
export function importedLocalScope(body,ctx){
 const pending=[body],seen=new Set(),declarations=[],types=new Map();
 while(pending.length){const n=pending.pop();if(!n||seen.has(n))continue;seen.add(n);
  if(seen.size>250000)throw Error('Imported local scope scan bound exceeded');
  if(n.kind===SyntaxKind.VariableDeclaration){
   const type=getTypeName(unwrapArrayType(n.type).baseType),contract=externalStructureDeclaration(ctx.structureByGalaxyTypeName,type);
   declarations.push(n);
   if(contract)types.set(type,contract);
  }
  pending.push(...syntaxChildren(n));
 }
 if(!types.size)return;
 // The existing Custom Script binding rewriter uses name maps, not a lexical
 // binder. Reject local names which could be mistaken for a parameter/global.
 for(const n of declarations){const name=n.name?.name;
  if(ctx.globalVarByGalaxyName.has(name)||ctx.paramRefByGalaxyName?.has(name))throw Error('Imported local Custom Script scope has a shadowed binding: '+name);
 }
 return {types:[...types].map(([type,contract])=>({type,file:contract.file,signature:contract.signature})),
  scope:'complete user-function body; original local declarations and control flow retained'};
}

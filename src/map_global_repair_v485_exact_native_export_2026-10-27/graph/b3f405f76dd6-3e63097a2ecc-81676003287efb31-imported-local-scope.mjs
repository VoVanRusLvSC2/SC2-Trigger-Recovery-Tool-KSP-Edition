/** An imported Galaxy record has no native GUI TypeElement unless the loaded
 * TriggerData actually declares one. Preserve the complete user-function body
 * in one existing NativeLib Custom Script action, including its local scope.
 * Never fabricate a duplicate record or replace the type with int.
 */
// @ts-nocheck
import {SyntaxKind} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/fa65c2e757b9-index.js';
import {getTypeName,unwrapArrayType} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/44a82bf88882-d94da33226ec-bed0640e971af10b-g2t-core.mjs';
import {syntaxChildren} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/69add9be0ea0-9a2bf360564c-8393d017cc7071ef-script-template.mjs';
import {externalStructureDeclaration} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/a8344404193a-d61c518b7749-c0701745248e3a5d-external-structure-fields.mjs';
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

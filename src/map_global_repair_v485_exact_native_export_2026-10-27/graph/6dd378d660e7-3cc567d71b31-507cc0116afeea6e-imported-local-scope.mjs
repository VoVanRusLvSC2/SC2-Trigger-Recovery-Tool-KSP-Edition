/** An imported Galaxy record has no native GUI TypeElement unless the loaded
 * TriggerData actually declares one. Preserve the complete user-function body
 * in one existing NativeLib Custom Script action, including its local scope.
 * Never fabricate a duplicate record or replace the type with int.
 */
// @ts-nocheck
import {SyntaxKind} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/ecf43456b87f-index.js';
import {getTypeName,unwrapArrayType} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/1460ea54e793-6264c2524955-eae6ab3d18153439-g2t-core.mjs';
import {syntaxChildren} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/d9d6ed13d377-4f9a4831ec5a-86eefed28afd5e24-script-template.mjs';
import {externalStructureDeclaration} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/4c7f9a6ec1e5-24772ad9fe1c-261a0e56e6a62004-external-structure-fields.mjs';
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

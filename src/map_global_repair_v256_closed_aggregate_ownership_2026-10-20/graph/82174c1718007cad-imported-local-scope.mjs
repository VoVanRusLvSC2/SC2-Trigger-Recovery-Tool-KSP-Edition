/** An imported Galaxy record has no native GUI TypeElement unless the loaded
 * TriggerData actually declares one. Preserve the complete user-function body
 * in one existing NativeLib Custom Script action, including its local scope.
 * Never fabricate a duplicate record or replace the type with int.
 */
// @ts-nocheck
import {SyntaxKind} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName,unwrapArrayType} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v256_closed_aggregate_ownership_2026-10-20/graph/d14d4b948618471b-g2t-core.mjs';
import {syntaxChildren} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v256_closed_aggregate_ownership_2026-10-20/graph/0facdb3525fc37a5-script-template.mjs';
import {externalStructureDeclaration} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v256_closed_aggregate_ownership_2026-10-20/graph/5c541e7d5d2c48c0-external-structure-fields.mjs';
export function importedLocalScope(body,ctx){
 const pending=[body],seen=new Set(),declarations=[],types=new Map();
 while(pending.length){const n=pending.pop();if(!n||seen.has(n))continue;seen.add(n);
  if(seen.size>250000)throw Error('Imported local scope scan bound exceeded');
  if(n.kind===SyntaxKind.VariableDeclaration){
   const type=getTypeName(unwrapArrayType(n.type).baseType),contract=externalStructureDeclaration(ctx.structureByGalaxyTypeName,type);
   declarations.push(n);
   if(contract)types.set(type,contract);
   // A GUI value-structure local is not a Galaxy reference local. Preserve
   // aliasing by retaining the complete body before creating any GUI locals.
   // Admit only a structure actually declared in this conversion operation.
   const reference = /^structref<(.+)>$/u.exec(type);
   if(reference){
    const own = ctx.structureByGalaxyTypeName.get(reference[1]);
    const imported = externalStructureDeclaration(ctx.structureByGalaxyTypeName, reference[1]);
    if(own || imported) types.set(type, imported ?? {file:'owned GUI structure',signature:JSON.stringify(own)});
   }
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

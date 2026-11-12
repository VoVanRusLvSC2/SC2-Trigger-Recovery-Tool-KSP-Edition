/** An imported Galaxy record has no native GUI TypeElement unless the loaded
 * TriggerData actually declares one. Preserve the complete user-function body
 * in one existing NativeLib Custom Script action, including its local scope.
 * Never fabricate a duplicate record or replace the type with int.
 */
// @ts-nocheck
import {SyntaxKind} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {getTypeName,unwrapArrayType} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/39db0c9c9123-ae8e39bac3e6-0131c278e7d7-3449b17ca5f9-174ab517065c-g2t-core.generated-call-provenance.mjs';
import {syntaxChildren} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/2ab74ac917ab-1615e5416b91-2f7c29c2e272-0facdb3525fc37a5-script-template.mjs';
import {externalStructureDeclaration} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/b1ca9a43c75c-1320-0771f3455fa1-7ade67b2fe75-570d60633683-5c541e7d5d2c48c0-external-structure-fields.mjs';
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

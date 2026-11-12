/** A whole-body raw scope keeps lexical declarations, including structref aliasing.
 * Resolve a reference local only from its unique source-owned declaration.
 * No guessing foreign schemas or replacing reference types with value structures.
 */
// @ts-nocheck
import {SyntaxKind} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName,unwrapArrayType} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v258_bound_typedef_abi_2026-10-20/graph/d14d4b948618471b-g2t-core.mjs';
import {syntaxChildren} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v258_bound_typedef_abi_2026-10-20/graph/0facdb3525fc37a5-script-template.mjs';
export function rawLocalStructureScope(body,ctx){
 const pending=[body],seen=new Set(),byName=new Map(),result=new Map();
 while(pending.length){
  const n=pending.pop();if(!n||typeof n!=='object'||seen.has(n))continue;seen.add(n);
  if(seen.size>250000)throw Error('Raw structure scope scan bound exceeded');
  if(n.kind===SyntaxKind.VariableDeclaration){
   const name=n.name?.name;
   if(typeof name==='string'){const group=byName.get(name)??[];group.push(n);byName.set(name,group);}
  }
  pending.push(...syntaxChildren(n));
 }
 for(const [name,group] of byName){
  // A name-only rewriter cannot safely bind two separate lexical declarations.
  if(group.length!==1||ctx.paramRefByGalaxyName?.has(name)||ctx.globalVarByGalaxyName.has(name))continue;
  const type=getTypeName(unwrapArrayType(group[0].type).baseType);
  const match=/^structref<([A-Za-z_][A-Za-z0-9_]*)>$/u.exec(type);
  if(!match)continue;
  const ref=ctx.structureByGalaxyTypeName?.get(match[1]);
  if(ref&&(ref.library??ctx.libId)===ctx.libId&&ctx.elements[ref.id]?.type==='Structure')result.set(name,ref);
 }
 return result;
}

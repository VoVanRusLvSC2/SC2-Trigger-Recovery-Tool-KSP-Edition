/** A whole-body raw scope keeps lexical declarations, including structref aliasing.
 * Resolve a reference local only from its unique source-owned declaration.
 * No guessing foreign schemas or replacing reference types with value structures.
 */
// @ts-nocheck
import {SyntaxKind} from '@modkit/blizzard-starcraft2/galaxy/language-core';
import {getTypeName,unwrapArrayType} from './g2t-core.js';
import {syntaxChildren} from './script-template.js';
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

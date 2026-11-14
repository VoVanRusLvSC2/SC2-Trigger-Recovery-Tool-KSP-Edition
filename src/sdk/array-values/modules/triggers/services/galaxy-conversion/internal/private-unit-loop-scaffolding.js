/** Удалять можно только собственные временные переменные одного native unit-loop.
 * Использования вне этого цикла или внутри пользовательских действий запрещают свёртку.
 * ctx/AST принадлежат одной карте, functionSymbolIndex использует слабые ключи.
 */
// @ts-nocheck
import {SyntaxKind as K,forEachChild} from '@modkit/blizzard-starcraft2/galaxy/language-core';
import {functionSymbolIndex} from './g2t-core.js';
export function privateUnitLoopScaffolding(nodes,index,ctx,groupName,indexName,userBody,groupExpression){
 const group=/^auto([0-9A-F]{8})_g$/iu.exec(groupName??''),counter=/^auto([0-9A-F]{8})_u$/iu.exec(indexName??'');
 if(!group||!counter||group[1].toUpperCase()!==counter[1].toUpperCase()||!ctx.structuredFunctionStatements)return false;
 const full=ctx.structuredFunctionStatements,whole=functionSymbolIndex(full),triple=functionSymbolIndex(nodes.slice(index,index+3));
 const names=new Set([groupName,indexName]);
 for(const [name,type] of [[groupName,'unitgroup'],[indexName,'int']]){
  const id=ctx.localVarByGalaxyName.get(name),variable=id?ctx.elements[id]:undefined,declaration=whole.declarations.get(name);
  if(variable?.type!=='Variable'||variable.variableType?.type!==type||variable.isArray||variable.isConstant||!declaration||declaration.initializer)return false;
  if(whole.uses.get(name)!==triple.uses.get(name))return false;
 }
 let unsafe=false;
 const visit=(n,checkReads)=>{if(!n)return;if(Array.isArray(n)){for(const c of n)visit(c,checkReads);return;}
  if(checkReads&&n.kind===K.Identifier&&names.has(n.name))unsafe=true;
  if(!checkReads&&n.kind===K.VariableDeclaration&&names.has(n.name?.name)&&whole.declarations.get(n.name.name)!==n)unsafe=true;
  forEachChild(n,c=>visit(c,checkReads));
 };
 visit(full,false);visit(userBody,true);visit(groupExpression,true);
 return !unsafe;
}

/** Exact adjacent localized-token initialization, before trigger guards.
 * Tokens and their value expressions remain ordered; other effects are refused.
 * This file is valid TS/JS and is kept identical in source and dist.
 */
// @ts-nocheck
import {SyntaxKind as K,forEachChild} from '@modkit/blizzard-starcraft2/galaxy/language-core';
export function localizedTextInitializerSequence(nodes,index,declarations,callbackName){
 const expr=n=>n?.kind===K.ExpressionStatement?n.expression:undefined;
 const call=(n,name,count)=>n?.kind===K.CallExpression&&n.expression?.kind===K.Identifier&&n.expression.name===name&&n.arguments.length===count;
 const tokens=[];let cursor=index,key;
 while(call(expr(nodes[cursor]),'TextExpressionSetToken',3)){
  const c=expr(nodes[cursor]),[k,code,value]=c.arguments;
  if(k.kind!==K.StringLiteral||code.kind!==K.StringLiteral||!code.value||String(code.value).length>64)return;
  if(key!==undefined&&key!==k.value||tokens.some(t=>t.code===code.value)||tokens.length>=32)return;
  let nested=false;const walk=n=>{if(!n)return;if(n.kind===K.CallExpression&&['TextExpressionSetToken','TextExpressionAssemble'].includes(n.expression?.name))nested=true;forEachChild(n,walk);};walk(value);if(nested)return;
  key=k.value;tokens.push({code:code.value,value});cursor++;
 }
 if(!tokens.length)return;
 const owner=/^lib([A-Za-z0-9]+)_gt_/u.exec(callbackName)?.[1];
 const match=/^Param\/Expression\/(?:lib_([A-Za-z0-9]+)_)?([0-9A-F]{8})$/u.exec(key);
 if(!match||match[1]!==owner||!owner&&!String(callbackName).startsWith('gt_'))return;
 const assignment=expr(nodes[cursor]);
 if(assignment?.kind!==K.BinaryExpression||assignment.operatorToken.kind!==K.EqualsToken||assignment.left.kind!==K.Identifier||!call(assignment.right,'TextExpressionAssemble',1))return;
 const argument=assignment.right.arguments[0];if(argument.kind!==K.StringLiteral||argument.value!==key)return;
 const name=assignment.left.name,declaration=declarations.find(d=>d.name.name===name);
 if(!declaration||declaration.type?.kind!==K.TextKeyword||declaration.modifiers?.some(m=>m.kind===K.ConstKeyword))return;
 return {name,expression:assignment.right,expressionTokens:{key,id:match[2],tokens},consumed:cursor-index+1};
}

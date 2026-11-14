/** Keep dead authored actions visible but disabled; never fold conditional returns. */
// @ts-nocheck
import {SyntaxKind} from '../../../../galaxy/language-core/index.js';
const ignored=new Set(['parent','symbol','locals','flowNode','syntaxTokens']);
function declaration(n){
 if(!n||typeof n!=='object')return false;
 if([SyntaxKind.VariableDeclaration,SyntaxKind.StructDeclaration,SyntaxKind.FunctionDeclaration].includes(n.kind))return true;
 for(const[k,v]of Object.entries(n)){
  if(ignored.has(k))continue;
  if(Array.isArray(v)?v.some(declaration):v&&typeof v==='object'&&declaration(v))return true;
 }
 return false;
}
function mustReturn(node){
 if(node?.kind===SyntaxKind.ReturnStatement)return true;
 if(node?.kind===SyntaxKind.Block)return node.statements.some(mustReturn);
 if(node?.kind===SyntaxKind.IfStatement)return !!node.elseStatement && mustReturn(node.thenStatement) && mustReturn(node.elseStatement);
 return false;
}
export function unreachableGuiSuffixStart(statements){
 const index=statements.findIndex(mustReturn);
 if(index<0||index===statements.length-1||statements.slice(index+1).some(declaration))return;
 const end=statements[index].end;
 return Number.isSafeInteger(end)?end:undefined;
}
export function disableUnreachableGuiActions(refs,node,ctx){
 if(ctx.disabledSuffixStart===undefined||!Number.isSafeInteger(node.pos)||node.pos<ctx.disabledSuffixStart)return;
 for(const ref of refs){
  const own=ctx.elements[ref.id];
  if((ref.library??ctx.libId)!==ctx.libId||!own)throw Error('Unreachable action ownership is not local');
  own.disabled=true;
 }
}

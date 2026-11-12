import assert from 'node:assert/strict';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName,unwrapArrayType} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';

const un=n=>n?.kind===K.ParenthesizedExpression?un(n.expression):n;
const walk=(node,visit)=>{visit(node);forEachChild(node,c=>{walk(c,visit);});};
const writes=new Set(['EqualsToken','PlusEqualsToken','MinusEqualsToken','AsteriskEqualsToken','SlashEqualsToken','PercentEqualsToken','LessThanLessThanEqualsToken','GreaterThanGreaterThanEqualsToken','AmpersandEqualsToken','BarEqualsToken','CaretEqualsToken'].map(k=>K[k]).filter(k=>k!==undefined));

// A lexical local is not a global with the same spelling. This narrow proof
// accepts only one function-level, initialized, never-written scalar string.
// Unknown/ref calls, nested declarations and ambiguous scopes remain refusals.
export function readReadonlyLocalString({expression,owner,functions,observers}){
 if(!owner?.body||expression?.kind!==K.Identifier)return;
 const name=expression.name,locals=[];
 walk(owner.body,n=>{if(n.kind===K.VariableDeclaration&&n.name.name===name)locals.push(n);});
 if(!locals.length)return;
 assert(locals.length===1&&!owner.parameters.some(p=>p.name.name===name),'PROTOCOL_FLOW_LOCAL_SCOPE_AMBIGUOUS');
 const declaration=locals[0];
 assert(owner.body.statements.includes(declaration),'PROTOCOL_FLOW_LOCAL_NOT_FUNCTION_SCOPED');
 assert(getTypeName(declaration.type)==='string'&&!unwrapArrayType(declaration.type).sizes.length&&declaration.initializer,'PROTOCOL_FLOW_LOCAL_STRING_INITIALIZER_REQUIRED:'+owner.name.name+':'+name);
 assert(declaration.end<=expression.pos,'PROTOCOL_FLOW_LOCAL_USED_BEFORE_INITIALIZATION');
 walk(owner.body,n=>{
  if(n.kind===K.BinaryExpression&&writes.has(n.operatorToken?.kind)){
   const target=un(n.left);assert(target?.kind!==K.Identifier||target.name!==name,'PROTOCOL_FLOW_LOCAL_WRITTEN');
  }
  if(n.kind===K.PrefixUnaryExpression||n.kind===K.PostfixUnaryExpression){
   const target=un(n.operand);assert(target?.kind!==K.Identifier||target.name!==name,'PROTOCOL_FLOW_LOCAL_UNARY_WRITE');
  }
  if(n.kind!==K.CallExpression)return;
  n.arguments.forEach((argument,index)=>{
   const value=un(argument);if(value?.kind!==K.Identifier||value.name!==name)return;
   const callee=un(n.expression);assert(callee?.kind===K.Identifier,'PROTOCOL_FLOW_LOCAL_INDIRECT_CALL');
   const definitions=functions.get(callee.name)??[];
   if(observers.get(callee.name)?.includes(index)){
    assert(definitions.every(d=>d.parameters[index]&&!d.parameters[index].isReference),'PROTOCOL_FLOW_LOCAL_OBSERVER_REFERENCE');return;
   }
   assert(definitions.length&&definitions.every(d=>d.parameters.length===n.arguments.length&&d.parameters[index]&&!d.parameters[index].isReference),'PROTOCOL_FLOW_LOCAL_REFERENCE_OR_UNKNOWN_CALL');
  });
 });
 return {initializer:declaration.initializer,key:owner.name.name+':local:'+name,
  proof:{owner:owner.name.name,name,declaration:{pos:declaration.pos,end:declaration.end},use:expression.pos,globalOfSameNameNotRead:true}};
}

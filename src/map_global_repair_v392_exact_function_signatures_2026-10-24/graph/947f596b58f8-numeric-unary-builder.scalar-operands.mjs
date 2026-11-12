import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';

// Native Param expressions retain the actual unary operator and evaluate their
// one typed operand once. This constructor grants no raw-code/gate permission;
// final and independent packed graph checks validate the exclusive slot owner.
export function typedNumericUnaryExpression(node,ctx,data,api){
 while(node?.kind===K.ParenthesizedExpression)node=node.expression;
 if(node?.kind!==K.PrefixUnaryExpression||node.operator?.kind!==K.MinusToken)return;
 let operand=node.operand;while(operand?.kind===K.ParenthesizedExpression)operand=operand.expression;
 if(operand?.kind===K.NumericLiteral)return; // Keep the existing literal codec.
 const type=api.expressionParameterType(node.operand,ctx)?.type;
 if(!['int','fixed'].includes(type)||data.valueType&&data.valueType.type!==type)return;
 const ref=api.structuredParam(node.operand,ctx,undefined,type),child=api.element(ref,ctx);
 if(child?.type!=='Param'||(child.library??ctx.libId)!==ctx.libId||child.scriptCode!==undefined||child.expressionCode!==undefined||
   child.structMember||child.preset||child.valueElement)return;
 child.expressionCode='operand';
 try{return api.mkParamRef({...data,valueType:{type},expressionType:type,expressionText:'(-~operand~)',expressionParams:[ref]},ctx);}
 catch(error){delete child.expressionCode;throw error;}
}

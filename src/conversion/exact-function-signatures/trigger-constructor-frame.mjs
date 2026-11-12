// Classification for pass ordering only. Preserving this subtree does not
// prove its Events, ABI, callback body or GUI representability.
import {SyntaxKind as K} from "./index-alternate-3.js";
const un=n=>n?.kind===K.ParenthesizedExpression?un(n.expression):n;
export function triggerConstructorFrame(fn){
 if(fn.kind!==K.FunctionDeclaration||!fn.body||fn.type?.kind!==K.VoidKeyword||fn.parameters.length||!fn.name.name.endsWith('_Init'))return;
 const first=fn.body.statements.find(n=>n.kind!==K.VariableDeclaration),assign=first?.expression,call=un(assign?.right),handle=fn.name.name.slice(0,-5);
 if(first?.kind!==K.ExpressionStatement||assign?.kind!==K.BinaryExpression||assign.operatorToken?.kind!==K.EqualsToken||un(assign.left)?.kind!==K.Identifier||un(assign.left).name!==handle||call?.kind!==K.CallExpression||call.expression?.kind!==K.Identifier||call.expression.name!=='TriggerCreate'||call.arguments.length!==1||call.arguments[0]?.kind!==K.StringLiteral||call.arguments[0].value!==handle+'_Func')return;
 return {handle,callback:handle+'_Func',classificationOnly:true,guiOrAbiProved:false};
}

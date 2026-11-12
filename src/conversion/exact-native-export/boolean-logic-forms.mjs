import {cloneGalaxySyntax} from "./semantic-forms.mjs";
/** Comparison only. Boolean result proof comes from language operators, never
 * guessed identifier/callee types. Logical association keeps exact operand
 * order and short-circuit behavior; mixed AND/OR are never flattened together.
 */
export function normalizeBooleanLogicForms(source,K,forEachChild){
 const result={...source,statements:source.statements.map(cloneGalaxySyntax)},notes=[];
 const logical=new Set([K.AmpersandAmpersandToken,K.BarBarToken]);
 const comparison=new Set([K.EqualsEqualsToken,K.ExclamationEqualsToken,K.LessThanToken,K.LessThanEqualsToken,K.GreaterThanToken,K.GreaterThanEqualsToken]);
 const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
 const boolean=n=>{n=unwrap(n);return [K.TrueKeyword,K.FalseKeyword].includes(n?.kind)||n?.kind===K.PrefixUnaryExpression&&n.operator?.kind===K.ExclamationToken||n?.kind===K.BinaryExpression&&(logical.has(n.operatorToken?.kind)||comparison.has(n.operatorToken?.kind));};
 const expression=n=>{
  forEachChild(n,c=>{expression(c);});
  if(n.kind!==K.BinaryExpression)return;
  const right=unwrap(n.right),left=unwrap(n.left);
  if(n.operatorToken?.kind===K.EqualsEqualsToken&&boolean(left)&&[K.TrueKeyword,K.FalseKeyword].includes(right?.kind)){
   const replacement=right.kind===K.TrueKeyword?left:{kind:K.PrefixUnaryExpression,operator:{kind:K.ExclamationToken},operand:left};
   Object.keys(n).forEach(k=>delete n[k]);Object.assign(n,replacement);
   notes.push({rule:'PROVEN_BOOLEAN_COMPARE_LITERAL',literal:right.kind===K.TrueKeyword});
  }
  if(n.kind!==K.BinaryExpression||!logical.has(n.operatorToken?.kind))return;
  const operator=n.operatorToken.kind,operands=[];
  const collect=v=>{v=unwrap(v);if(v.kind===K.BinaryExpression&&v.operatorToken?.kind===operator){collect(v.left);collect(v.right);}else operands.push(v);};
  collect(n);
  if(operands.length<3)return;
  let combined=operands[0];for(const right of operands.slice(1))combined={kind:K.BinaryExpression,left:combined,operatorToken:{kind:operator},right};
  Object.keys(n).forEach(k=>delete n[k]);Object.assign(n,combined);
  notes.push({rule:'LOGICAL_ASSOCIATION_SAME_OPERATOR_ORDER',operator,operands:operands.length});
 };
 // Functions only: no initializer ordering or declaration metadata changes.
 for(const f of result.statements)if(f.kind===K.FunctionDeclaration&&f.body)expression(f.body);
 return {source:result,notes};
}

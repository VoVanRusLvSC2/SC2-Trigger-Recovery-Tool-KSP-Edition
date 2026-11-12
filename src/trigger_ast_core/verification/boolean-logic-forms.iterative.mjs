import {cloneGalaxySyntax} from '../../map_speed_addon_2026-10-03/semantic_forms.mjs';
/** Comparison only. Boolean result proof comes from language operators, never
 * guessed identifier/callee types. Logical association keeps exact operand
 * order and short-circuit behavior; mixed AND/OR are never flattened together.
 */
export function normalizeBooleanLogicForms(source,K,forEachChild){
 const result={...source,statements:source.statements.map(cloneGalaxySyntax)},notes=[];
 const logical=new Set([K.AmpersandAmpersandToken,K.BarBarToken]);
 const comparison=new Set([K.EqualsEqualsToken,K.ExclamationEqualsToken,K.LessThanToken,K.LessThanEqualsToken,K.GreaterThanToken,K.GreaterThanEqualsToken]);
 const unwrap=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
 const boolean=n=>{n=unwrap(n);return [K.TrueKeyword,K.FalseKeyword].includes(n?.kind)||n?.kind===K.PrefixUnaryExpression&&n.operator?.kind===K.ExclamationToken||n?.kind===K.BinaryExpression&&(logical.has(n.operatorToken?.kind)||comparison.has(n.operatorToken?.kind));};
 const rewrite=n=>{
  if(n.kind!==K.BinaryExpression)return;
  const right=unwrap(n.right),left=unwrap(n.left);
  if(n.operatorToken?.kind===K.EqualsEqualsToken&&boolean(left)&&[K.TrueKeyword,K.FalseKeyword].includes(right?.kind)){
   const replacement=right.kind===K.TrueKeyword?left:{kind:K.PrefixUnaryExpression,operator:{kind:K.ExclamationToken},operand:left};
   Object.keys(n).forEach(k=>delete n[k]);Object.assign(n,replacement);
   notes.push({rule:'PROVEN_BOOLEAN_COMPARE_LITERAL',literal:right.kind===K.TrueKeyword});
  }
  if(n.kind!==K.BinaryExpression||!logical.has(n.operatorToken?.kind))return;
  const operator=n.operatorToken.kind,operands=[];
  const pending=[n];while(pending.length){const v=unwrap(pending.pop());if(v.kind===K.BinaryExpression&&v.operatorToken?.kind===operator){pending.push(v.right,v.left);}else operands.push(v);}
  if(operands.length<3)return;
  let combined=operands[0];for(const right of operands.slice(1))combined={kind:K.BinaryExpression,left:combined,operatorToken:{kind:operator},right};
  Object.keys(n).forEach(k=>delete n[k]);Object.assign(n,combined);
  notes.push({rule:'LOGICAL_ASSOCIATION_SAME_OPERATOR_ORDER',operator,operands:operands.length});
 };
 // Same left-to-right postorder as the former recursive visitor.
 const expression=root=>{const pending=[{node:root,visited:false}];while(pending.length){const {node,visited}=pending.pop();if(visited){rewrite(node);continue;}pending.push({node,visited:true});const children=[];forEachChild(node,child=>{children.push(child);});for(let i=children.length-1;i>=0;i--)pending.push({node:children[i],visited:false});}};
 // Functions only: no initializer ordering or declaration metadata changes.
 for(const f of result.statements)if(f.kind===K.FunctionDeclaration&&f.body)expression(f.body);
 return {source:result,notes};
}

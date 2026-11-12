// The legacy Galaxy printer does not insert precedence parentheses for newly
// constructed AST nodes. Preserve the exact expression tree explicitly.
export function groupGalaxyBinaryExpressions(root,K,forEachChild){
 const assignments=new Set(['EqualsToken','PlusEqualsToken','MinusEqualsToken','AsteriskEqualsToken','SlashEqualsToken','PercentEqualsToken','AmpersandEqualsToken','BarEqualsToken','CaretEqualsToken','LessThanLessThanEqualsToken','GreaterThanGreaterThanEqualsToken'].map(k=>K[k]).filter(Number.isInteger));
 const pending=[{node:root,parent:undefined,visited:false}];let grouped=0;
 while(pending.length){
  const {node,parent,visited}=pending.pop();
  if(!visited){pending.push({node,parent,visited:true});const children=[];forEachChild(node,c=>{children.push(c);});for(let i=children.length-1;i>=0;i--)pending.push({node:children[i],parent:node,visited:false});continue;}
  if(node.kind!==K.BinaryExpression||assignments.has(node.operatorToken?.kind))continue;
  if(parent?.kind===K.ParenthesizedExpression&&parent.expression===node)continue;
  const expression={...node};delete expression.parent;
  for(const k of Object.keys(node))delete node[k];
  Object.assign(node,{kind:K.ParenthesizedExpression,expression});grouped++;
 }
 return {groupedBinaryNodes:grouped,operatorTreeAndOperandOrderUnchanged:true};
}

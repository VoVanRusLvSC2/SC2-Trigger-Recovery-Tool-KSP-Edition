// Syntax-only bridge into the existing typed structure-fill verifier. The
// verifier still checks whole dimensions, member paths and initializer order.
// No source text, declaration, value, call or assignment is removed here.
export function canonicalStructureWhileInitializers(body,globals,locals,K){
 const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
 const id=n=>unwrap(n)?.kind===K.Identifier?unwrap(n).name:undefined;
 const numeric=n=>{n=unwrap(n);return n?.kind===K.NumericLiteral&&/^\d+$/u.test(n.text??'')?Number(n.text):undefined;};
 const assignment=n=>{n=n?.kind===K.ExpressionStatement?n.expression:n;return n?.kind===K.BinaryExpression&&n.operatorToken?.kind===K.EqualsToken?n:undefined;};
 const skip=new Set(['parent','pos','end','line','char','syntaxTokens','symbol','locals','flowNode']);
 function uses(n,names){if(!n||typeof n!=='object')return false;if(n.kind===K.Identifier&&names.has(n.name))return true;return Object.entries(n).some(([k,v])=>!skip.has(k)&&(Array.isArray(v)?v.some(x=>uses(x,names)):uses(v,names)));}
 const records=[],used=new Set();let hasStructure=false;
 function bound(n){n=unwrap(n);const value=numeric(n);if(value!==undefined)return value>=0&&value<2147483647;
  const d=globals.get(id(n));return !!d&&d.modifiers?.some(m=>m.kind===K.ConstKeyword)&&numeric(d.initializer)>=0&&numeric(d.initializer)<2147483647;
 }
 function memberWrite(n,counters){
  const a=assignment(n);if(!a||uses(a.right,locals))return false;
  let target=unwrap(a.left),property=false;const indices=[];
  while([K.ElementAccessExpression,K.PropertyAccessExpression].includes(target?.kind)){
   if(target.kind===K.PropertyAccessExpression){property=true;target=unwrap(target.expression);}
   else{indices.unshift(id(target.argumentExpression));target=unwrap(target.expression);}
  }
  const declaration=globals.get(id(target));
  if(!declaration||declaration.modifiers?.some(m=>m.kind===K.ConstKeyword)||indices.length!==counters.length||!indices.every((v,i)=>v===counters[i]))return false;
  hasStructure ||= property;return true;
 }
 function loop(reset,node,parents){
  const init=assignment(reset),counter=id(init?.left),condition=unwrap(node?.expression),lines=node?.statement?.statements;
  if(!counter||!locals.has(counter)||parents.includes(counter)||numeric(init.right)!==0||node?.kind!==K.WhileStatement||node.statement?.kind!==K.Block||!lines?.length)return;
  if(condition?.kind!==K.BinaryExpression||id(condition.left)!==counter||![K.LessThanToken,K.LessThanEqualsToken].includes(condition.operatorToken?.kind)||!bound(condition.right))return;
  const inc=assignment(lines.at(-1)),add=unwrap(inc?.right);
  if(id(inc?.left)!==counter||add?.kind!==K.BinaryExpression||add.operatorToken?.kind!==K.PlusToken||id(add.left)!==counter||numeric(add.right)!==1)return;
  const counters=[...parents,counter],content=[];
  for(let i=0;i<lines.length-1;i++){
   if(lines[i+1]?.kind===K.WhileStatement){const nested=loop(lines[i],lines[i+1],counters);if(!nested)return;content.push(nested);i++;}
   else{if(!memberWrite(lines[i],counters))return;content.push(lines[i]);}
  }
  if(!content.length)return;
  used.add(counter);records.push({counter,condition:condition.operatorToken.kind,bound:condition.right,originalIncrement:lines.at(-1)});
  return {kind:K.ForStatement,initializer:init,condition,incrementor:{kind:K.BinaryExpression,left:inc.left,operatorToken:{kind:K.PlusEqualsToken},right:add.right},statement:{kind:K.Block,statements:content}};
 }
 const rest=[],replaced=new Set();
 for(let i=0;i<body.rest.length;i++){
  if(body.rest[i+1]?.kind===K.WhileStatement){const converted=loop(body.rest[i],body.rest[i+1],[]);if(!converted)return;rest.push(converted);replaced.add(body.rest[i]);replaced.add(body.rest[++i]);}
  else rest.push(body.rest[i]);
 }
 if(!hasStructure||!records.length)return;
 for(const n of body.rest)if(!replaced.has(n)&&uses(n,used))return;
 return {...body,rest,requiresInitializationOrderProof:true,structureWhileSyntaxOnly:true};
}

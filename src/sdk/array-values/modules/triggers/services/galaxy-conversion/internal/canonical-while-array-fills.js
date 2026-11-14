/** Recognize old editor zero-based while array fills before GUI initializer folding.
 * Pure literal RHS, complete array range and private local counters only.
 */
export function canonicalWhileArrayFills(body,globals,locals,K){
 const skip=new Set(['parent','pos','end','line','char','syntaxTokens','symbol','locals','flowNode']);
 const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
 const number=n=>{n=unwrap(n);return n?.kind===K.NumericLiteral&&/^\d+$/u.test(n.value??n.text)?Number(n.value??n.text):undefined;};
 const assignment=s=>{const n=s?.kind===K.ExpressionStatement?s.expression:s;return n?.kind===K.BinaryExpression&&n.operatorToken?.kind===K.EqualsToken?n:undefined;};
 const id=n=>unwrap(n)?.kind===K.Identifier?unwrap(n).name:undefined;
 const literal=n=>{n=unwrap(n);return [K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(n?.kind)||n?.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(n.operator?.kind)&&unwrap(n.operand)?.kind===K.NumericLiteral;};
 let requiresInitializationOrderProof=false;
 const counterFreeValue=n=>{const pending=[n];while(pending.length){const value=pending.pop();if(!value||typeof value!=='object')continue;if(value.kind===K.Identifier&&locals.has(value.name))return false;if(value.kind===K.StringLiteral&&[...locals].some(name=>new RegExp('\\b'+name+'\\b','u').test(value.value??'')))return false;for(const[key,child]of Object.entries(value)){if(skip.has(key))continue;if(Array.isArray(child))pending.push(...child);else if(child&&typeof child==='object')pending.push(child);}}const root=unwrap(n);return root?.kind===K.Identifier||root?.kind===K.CallExpression&&root.arguments?.length===0&&unwrap(root.expression)?.kind===K.Identifier;};
 const replaced=new Set(),counters=new Set(),rest=[];
 for(let i=0;i<body.rest.length;i++){
  const init=assignment(body.rest[i]),counter=id(init?.left),loop=body.rest[i+1],condition=unwrap(loop?.expression);
  if(!counter||!locals.has(counter)||number(init.right)!==0||loop?.kind!==K.WhileStatement){rest.push(body.rest[i]);continue;}
  const statements=loop.statement?.kind===K.Block?loop.statement.statements:undefined;
  if(!statements||statements.length!==2||condition?.kind!==K.BinaryExpression||id(condition.left)!==counter||![K.LessThanToken,K.LessThanEqualsToken].includes(condition.operatorToken?.kind))return;
  const write=assignment(statements[0]),inc=assignment(statements[1]),target=unwrap(write?.left),add=unwrap(inc?.right);
  if(target?.kind!==K.ElementAccessExpression||id(target.argumentExpression)!==counter||!(literal(write.right)||counterFreeValue(write.right))||id(inc?.left)!==counter||add?.kind!==K.BinaryExpression||add.operatorToken?.kind!==K.PlusToken||id(add.left)!==counter||number(add.right)!==1)return;
  const global=globals.get(id(target.expression)),type=global?.type;
  if(!global||global.modifiers?.some(m=>m.kind===K.ConstKeyword)||type?.kind!==K.ArrayType||type.elementType?.kind===K.ArrayType)return;
  const size=number(type.size),bound=number(condition.right),count=bound+(condition.operatorToken.kind===K.LessThanEqualsToken?1:0);
  if(!Number.isSafeInteger(size)||size<=0||!Number.isSafeInteger(bound)||size!==count)return;
  if(!literal(write.right))requiresInitializationOrderProof=true;
  const node={kind:K.ForStatement,initializer:init,condition,incrementor:{kind:K.BinaryExpression,left:inc.left,operatorToken:{kind:K.PlusEqualsToken},right:{kind:K.NumericLiteral,value:'1',text:'1'}},statement:{kind:K.Block,statements:[statements[0]]}};
  rest.push(node);replaced.add(body.rest[i]);replaced.add(loop);counters.add(counter);i++;
 }
 if(!replaced.size)return body;
 let unsafe=false;function visit(n){if(!n||typeof n!=='object')return;if(n.kind===K.Identifier&&counters.has(n.name))unsafe=true;for(const[k,v]of Object.entries(n)){if(skip.has(k))continue;if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}
 for(const node of body.rest)if(!replaced.has(node))visit(node);
 return unsafe?undefined:{...body,rest,requiresInitializationOrderProof};
}

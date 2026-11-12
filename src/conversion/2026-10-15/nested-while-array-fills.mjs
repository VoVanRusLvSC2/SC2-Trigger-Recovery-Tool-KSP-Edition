/** Complete rectangular old-editor while fills only. Preserve evaluation



 * count/order; refuse partial ranges, counter uses and additional effects. */



export function canonicalWhileArrayFills(body, globals, locals, K) {



 const skip=new Set(['parent','pos','end','line','char','syntaxTokens','symbol','locals','flowNode']);



 const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;



 const number=n=>{n=unwrap(n);return n?.kind===K.NumericLiteral&&/^\d+$/u.test(n.value??n.text)?Number(n.value??n.text):undefined;};



 const assignment=s=>{const n=s?.kind===K.ExpressionStatement?s.expression:s;return n?.kind===K.BinaryExpression&&n.operatorToken?.kind===K.EqualsToken?n:undefined;};



 const id=n=>unwrap(n)?.kind===K.Identifier?unwrap(n).name:undefined;



 const literal=n=>{n=unwrap(n);return [K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(n?.kind)||n?.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(n.operator?.kind)&&unwrap(n.operand)?.kind===K.NumericLiteral;};



 const hasCounter=n=>{const pending=[n];while(pending.length){const value=pending.pop();if(!value||typeof value!=='object')continue;if(value.kind===K.Identifier&&locals.has(value.name))return true;if(value.kind===K.StringLiteral&&[...locals].some(name=>new RegExp('\\b'+name+'\\b','u').test(value.value??'')))return true;for(const[key,child]of Object.entries(value)){if(skip.has(key))continue;if(Array.isArray(child))pending.push(...child);else if(child&&typeof child==='object')pending.push(child);}}return false;};



 const counterFreeValue=n=>{const root=unwrap(n);return !hasCounter(n)&&(root?.kind===K.Identifier||root?.kind===K.CallExpression&&unwrap(root.expression)?.kind===K.Identifier);};



 let requiresInitializationOrderProof=false;



 const replaced=new Set(),counters=new Set(),rest=[];



 function convert(initStatement,loop,outerCounters=[],outerBounds=[]){



  const init=assignment(initStatement),counter=id(init?.left),condition=unwrap(loop?.expression);



  if(!counter||!locals.has(counter)||outerCounters.includes(counter)||number(init.right)!==0||loop?.kind!==K.WhileStatement)return;



  const statements=loop.statement?.kind===K.Block?loop.statement.statements:undefined;



  if(!statements||condition?.kind!==K.BinaryExpression||id(condition.left)!==counter||![K.LessThanToken,K.LessThanEqualsToken].includes(condition.operatorToken?.kind))return;



  const bound=number(condition.right),count=bound+(condition.operatorToken.kind===K.LessThanEqualsToken?1:0);



  if(!Number.isSafeInteger(bound)||!Number.isSafeInteger(count)||count<=0)return;



  const inc=assignment(statements.at(-1)),add=unwrap(inc?.right);



  if(id(inc?.left)!==counter||add?.kind!==K.BinaryExpression||add.operatorToken?.kind!==K.PlusToken||id(add.left)!==counter||number(add.right)!==1)return;



  const pathCounters=[...outerCounters,counter],pathBounds=[...outerBounds,count];



  let content;



  if(statements.length===3&&statements[1]?.kind===K.WhileStatement){



   content=convert(statements[0],statements[1],pathCounters,pathBounds);if(!content)return;



  }else{



   if(statements.length!==2)return;



   const write=assignment(statements[0]);if(!write||!(literal(write.right)||counterFreeValue(write.right)))return;



   let target=unwrap(write.left);const indices=[];



   while(target?.kind===K.ElementAccessExpression){indices.unshift(id(target.argumentExpression));target=unwrap(target.expression);}



   const global=globals.get(id(target));



   if(!global||global.modifiers?.some(m=>m.kind===K.ConstKeyword)||indices.length!==pathCounters.length||!indices.every((v,i)=>v===pathCounters[i]))return;



   // Parser wraps each subsequent dimension around the preceding type.



   let type=global.type;const sizes=[];



   while(type?.kind===K.ArrayType){sizes.unshift(number(type.size));type=type.elementType;}



   if(sizes.length!==pathBounds.length||!sizes.every((size,i)=>size===pathBounds[i]))return;



   if(!literal(write.right))requiresInitializationOrderProof=true;



   content=statements[0];



  }



  counters.add(counter);



  return {kind:K.ForStatement,initializer:init,condition,incrementor:{kind:K.BinaryExpression,left:inc.left,operatorToken:{kind:K.PlusEqualsToken},right:{kind:K.NumericLiteral,value:'1',text:'1'}},statement:{kind:K.Block,statements:[content]}};



 }



 for(let i=0;i<body.rest.length;i++){



  const init=assignment(body.rest[i]),counter=id(init?.left),loop=body.rest[i+1];



  if(!counter||!locals.has(counter)||number(init.right)!==0||loop?.kind!==K.WhileStatement){rest.push(body.rest[i]);continue;}



  const converted=convert(body.rest[i],loop);if(!converted)return;



  rest.push(converted);replaced.add(body.rest[i]);replaced.add(loop);i++;



 }



 if(!replaced.size)return body;



 let unsafe=false;



 function visit(n){if(!n||typeof n!=='object')return;if(n.kind===K.Identifier&&counters.has(n.name))unsafe=true;for(const[k,v]of Object.entries(n)){if(skip.has(k))continue;if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}



 for(const node of body.rest)if(!replaced.has(node))visit(node);



 return unsafe?undefined:{...body,rest,requiresInitializationOrderProof};



}




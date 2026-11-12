// Expression reuse is conversion-local. Context is part of semantic identity;
// an event target from another expansion must never be reused accidentally.
export function createContextualExpressionMemo({legacyKey,shape,fail,refKey}) {
 function expressionKey(element,ctx){
  return JSON.stringify([legacyKey(element,ctx),ctx.containingTriggerBody===true,
   ctx.eventRegistrationTargetExpression?shape(ctx.eventRegistrationTargetExpression):null]);
 }
 function memoExpression(element,ctx,convert){
  const key=expressionKey(element,ctx),cached=ctx.exprCache?.get(key);
  if(cached)return cached;
  const visiting=ctx.activeExpressions??=new Set();
  if(visiting.has(key))fail('REFERENCE_CYCLE','Cyclic Trigger expression reference',{library:element.library,type:element.type,id:element.id});
  if(visiting.size>=256)fail('DEPTH_LIMIT','Trigger expression nesting exceeds the conversion budget');
  visiting.add(key);
  try{const result=convert();if(result)ctx.exprCache?.set(key,result);return result;}
  finally{visiting.delete(key);}
 }
 return Object.freeze({expressionKey,memoExpression});
}

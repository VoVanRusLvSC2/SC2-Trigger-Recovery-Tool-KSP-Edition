/** ExpressionCode on a structured text-expression child is a token LABEL,







 * emitted by TextExpressionSetToken, not a Galaxy custom-code body.







 * Fail closed for orphaned/shared/cross-library/duplicate or non-text bindings.







 */







export function localizedTokenCodeBindings(elements,libId){







 const result=new Set(), owners=new Map();







 const parameters=new Map(),duplicates=new Set();







 for(const e of Object.values(elements))if(e.type==='Param'){







  if(parameters.has(e.id))duplicates.add(e.id);else parameters.set(e.id,e);







 }







 for(const parent of Object.values(elements)){







  if(parent.type!=='Param'||parent.expressionType!=='text'||parent.valueType?.type!=='text')continue;







  const refs=parent.expressionParams??[],codes=new Set();let valid=true;







  for(const ref of refs){







   const child=duplicates.has(ref.id)?undefined:parameters.get(ref.id);







   if((ref.library??libId)!==libId||ref.type!=='Param'||!child||child.type!=='Param'||typeof child.expressionCode!=='string'||!/^[A-Za-z][A-Za-z0-9_]*$/u.test(child.expressionCode)||codes.has(child.expressionCode)){valid=false;break;}







   codes.add(child.expressionCode);







  }







  if(!valid)continue;







  for(const ref of refs){const list=owners.get(ref.id)??[];list.push(parent.id);owners.set(ref.id,list);}







 }







 // Every reference to the token must be owned by its one text-expression parent.







 const references=new Map();







 const visit=value=>{







  if(Array.isArray(value)){for(const child of value)visit(child);return;}







  if(!value||typeof value!=='object')return;







  if(value.type==='Param'&&typeof value.id==='string'){







   if((value.library??libId)===libId)references.set(value.id,(references.get(value.id)??0)+1);







   return;







  }







  for(const child of Object.values(value))visit(child);







 };







 for(const e of Object.values(elements))for(const value of Object.values(e))visit(value);







 for(const [id,list] of owners)if(list.length===1&&references.get(id)===1)result.add(id);







 return result;







}








/** Resolve the original call before considering a different runtime recipe.
 * Existing owned functions retain their identity. Stock GUI resolution and
 * source-bound, audited existing-native descriptions use the same recovery
 * policy as ordinary calls. This helper never declares an API itself.
 */
export function resolveDirectSourceGuiCall(call,ctx,recovery,use){
  if(!call||!recovery)return {status:'NO_RECOVERY_SESSION'};
  const name=call.expression?.name,existing=ctx.funcNameToFuncDef.get(name);
  if(existing&&(existing.library??ctx.nativeLibrary?.id)===ctx.libId)
    return {status:'RESOLVED',definition:existing,ownedDefinitionRetained:true};
  const result=recovery.resolveCall(call,ctx,use);
  if(result.status==='RESOLVED')ctx.funcNameToFuncDef.set(name,result.definition);
  return result;
}

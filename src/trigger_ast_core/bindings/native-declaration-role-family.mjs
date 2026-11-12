// One native ABI can have separate stock GUI Event and Action descriptions.
// A declaration has no GUI use site. Defer only a fully verified two-role
// family; ordinary ambiguity, duplicate owners and ABI failures still refuse.
import {resolveNativeRoleCandidate} from './native-gui-role-candidate.mjs';
export function verifiedNativeDeclarationRoleFamily(index,query) {
 if(!index||query.declaration?.returnType!=='void'||query.declaration.parameters?.[0]!=='trigger')return undefined;
 const all=index.resolve(query);
 if(all.status!=='AMBIGUOUS'||all.candidateKeys.length!==2)return undefined;
 const action=resolveNativeRoleCandidate(index,query,'Action'),event=resolveNativeRoleCandidate(index,query,'Event');
 if(action.status!=='RESOLVED'||event.status!=='RESOLVED'||action.owner===event.owner)return undefined;
 const keys=new Set(all.candidateKeys);
 if(!keys.has(action.owner)||!keys.has(event.owner))return undefined;
 if(action.definition.flags?.includes('Event')||event.definition.flags?.includes('Action'))return undefined;
 return {kind:'VERIFIED_NATIVE_EVENT_ACTION_ROLE_FAMILY',name:query.name,
  action:action.owner,event:event.owner,sourceAbi:query.declaration,
  resolutionDeferredToCallSite:true,globalDefinitionChosen:false,newNativeDefinitions:0};
}

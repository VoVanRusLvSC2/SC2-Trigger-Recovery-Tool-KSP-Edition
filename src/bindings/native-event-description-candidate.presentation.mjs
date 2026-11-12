import {publicNativeEventAlias} from "./public-native-event-alias.presentation.mjs";
import {resolveNativeRoleCandidate as previousRole} from "./native-gui-role-candidate.mjs";

// The identity index stays conservative and unchanged in every SDK ABI family.
// Only a complete native Event use/declaration may use this narrower GUI proof.
export function resolveNativeEventDescription(index,query,resolution=index?.resolve(query)){
 if(resolution?.status!=='AMBIGUOUS')return resolution;
 const keys=new Set(resolution.candidateKeys);
 const candidates=(index.bySymbol.get(query.name)??[]).filter(c=>keys.has(c.key));
 const alias=publicNativeEventAlias(index,query,candidates);if(!alias)return resolution;
 return {...resolution,status:'RESOLVED',definition:alias.candidate.definition,candidateKeys:[alias.candidate.key],
  nativeDescriptionAlias:alias.proof,rejected:[...(resolution.rejected??[]),...alias.proof.aliases.map(key=>({key,reason:'equivalent-hidden-native-description'}))]};
}
export function resolveNativeRoleCandidate(index,query,requiredRole){
 const old=previousRole(index,query,requiredRole);
 if(old.status!=='AMBIGUOUS'||requiredRole!=='Event')return old;
 const r=resolveNativeEventDescription(index,{...query,guiUse:'event'});
 if(r?.status!=='RESOLVED'||!r.nativeDescriptionAlias)return old;
 return {...r,requiredRole,owner:r.candidateKeys[0]};
}

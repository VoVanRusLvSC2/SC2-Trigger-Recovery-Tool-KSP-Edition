import {publicNativeDescription} from './public-native-description.mjs';
import {resolveNativeRoleCandidate as previousRole} from './native-gui-role-candidate.mjs';
export function resolveNativeDescriptionCandidate(index,query,resolution=index?.resolve(query)){
 if(resolution?.status!=='AMBIGUOUS')return resolution;
 const keys=new Set(resolution.candidateKeys),candidates=(index.bySymbol.get(query.name)??[]).filter(c=>keys.has(c.key));
 const alias=publicNativeDescription(index,query,candidates);if(!alias)return resolution;
 return {...resolution,status:'RESOLVED',definition:alias.candidate.definition,candidateKeys:[alias.candidate.key],
  nativeDescriptionAlias:alias.proof,rejected:[...(resolution.rejected??[]),...alias.proof.aliases.map(key=>({key,reason:'equal-executable-hidden-native-description'}))]};
}
export function resolveNativeRoleCandidate(index,query,requiredRole){
 const old=previousRole(index,query,requiredRole);if(old.status!=='AMBIGUOUS')return old;
 const r=resolveNativeDescriptionCandidate(index,{...query,guiUse:{Event:'event',Action:'action',Call:'value'}[requiredRole]});
 if(r?.status!=='RESOLVED'||!r.nativeDescriptionAlias)return old;
 return {...r,requiredRole,owner:r.candidateKeys[0]};
}

import {resolveNativeRoleCandidate as previous} from './native-gui-role-candidate.mjs';
export function resolveNativeRoleCandidate(index,query,requiredRole){
 const old=previous(index,query,requiredRole);if(old.status!=='AMBIGUOUS')return old;
 const resolved=index.resolve({...query,guiUse:{Event:'event',Action:'action',Call:'value'}[requiredRole]});
 if(resolved.status!=='RESOLVED'||!resolved.nativeDescriptionAlias||!resolved.definition.flags?.includes(requiredRole))return old;
 return {...resolved,requiredRole,owner:resolved.candidateKeys[0]};
}

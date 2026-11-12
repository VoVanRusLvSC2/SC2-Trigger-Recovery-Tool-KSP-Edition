// A supplied native Galaxy declaration names the runtime API, not an arbitrary
// user-library description with the same editor identifier. Prefer a unique
// public description from the SDK's actual Native library when its complete ABI
// matches. The identity index remains conservative. This only constructs a GUI
// binding; unchanged full roundtrip/SDK/GUI gates still decide acceptance.
import {formalGalaxyCarrier} from "../types/formal-galaxy-carrier.mjs";
import {resolveNativeRoleCandidate as previousRole} from "./native-gui-role-candidate.mjs";
const hidden=new Set(['Hidden','Internal','Deprecated']);
const allowed=new Set(['Native','Event','Action','Call','Operator']);
export function bindNativeLibraryDeclaration(index,query,resolution,nativeLibraryId){
 if(resolution?.status!=='AMBIGUOUS'||!query.declaration||!nativeLibraryId)return resolution;
 const library=index.libraries.get(nativeLibraryId);if(!library)return resolution;
 const abi=query.declaration,keys=new Set(resolution.candidateKeys);
 const matches=(index.bySymbol.get(query.name)??[]).filter(c=>{
  const d=c.definition,flags=d.flags??[];
  if(!keys.has(c.key)||c.library!==library||c.origin!=='emitted'||c.symbol!==query.name||d.name!==query.name||
   d.identifier&&d.identifier!==query.name||d.disabled||d.scriptCode||d.isSubFunction||
   !flags.includes('Native')||flags.some(f=>hidden.has(f)||!allowed.has(f)))return false;
  if(flags.includes('Event')&&flags.includes('Action'))return false;
  const role=flags.includes('Event')?'event':flags.includes('Action')||d.isFuncAction?'action':'value';
  if(query.guiUse&&query.guiUse!==role)return false;
  const count=role==='event'?1:0;
  if(count&&abi.parameters[0]!=='trigger'||d.parameters.length+count!==abi.parameters.length||index.carrier(d.returnType,library)!==abi.returnType)return false;
  return d.parameters.every((ref,i)=>{
   const formal=index.formal(ref,library);if(!formal)return false;
   const carrier=formalGalaxyCarrier(index,formal,library,d);return !!carrier&&carrier===abi.parameters[i+count];
  });
 });
 if(matches.length!==1)return resolution;
 const selected=matches[0];
 return {...resolution,status:'RESOLVED',definition:selected.definition,candidateKeys:[selected.key],
  nativeLibraryBinding:{kind:'DECLARED_NATIVE_API_BOUND_TO_ACTUAL_SDK_NATIVE_LIBRARY',symbol:query.name,nativeLibraryId,
   selected:selected.key,actualAbi:abi,shadowDescriptions:resolution.candidateKeys.filter(k=>k!==selected.key),
   explicitArgumentsRequired:true,originalTypedMetadataPreserved:true,newNativeDefinitions:0,
   candidateConstructionOnly:true,fullRoundtripRequired:true,wholeProgramEquivalenceProved:false}};
}
export function resolveNativeRoleWithLibrary(index,query,requiredRole,nativeLibraryId){
 const previous=previousRole(index,query,requiredRole);if(previous.status!=='AMBIGUOUS')return previous;
 const resolved=bindNativeLibraryDeclaration(index,{...query,guiUse:{Event:'event',Action:'action',Call:'value'}[requiredRole]},index.resolve(query),nativeLibraryId);
 return resolved?.status==='RESOLVED'?{...resolved,requiredRole,owner:resolved.candidateKeys[0]}:previous;
}

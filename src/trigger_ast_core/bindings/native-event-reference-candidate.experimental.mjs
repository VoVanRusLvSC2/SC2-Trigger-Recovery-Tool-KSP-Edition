// A role-specific ABI fallback for one public stock Native Event candidate.
// It only constructs a candidate; native export and unchanged whole-program
// verification are still required before accepting a recovered map.
import {formalGalaxyCarrier} from '../types/formal-galaxy-carrier.native-formals.mjs';
const allowed=new Set(['Native','Event','Call','Operator']);
export function resolveNativeEventReferenceCandidate(index,query,prior,nativeLibraryId) {
 if(prior?.status!=='SIGNATURE_MISMATCH'||!nativeLibraryId||!query?.declaration||query.guiUse&&query.guiUse!=='event')return prior;
 const lib=index.libraries.get(nativeLibraryId),abi=query.declaration;
 if(!lib||!Array.isArray(abi.parameters)||abi.parameters[0]!=='trigger')return prior;
 // Any other Native Event for the same symbol makes ownership ambiguous.
 const events=(index.bySymbol.get(query.name)??[]).filter(c=>c.definition.flags?.includes('Native')&&c.definition.flags.includes('Event'));
 if(events.length!==1)return prior;
 const c=events[0],d=c.definition,flags=d.flags??[];
 if(c.library!==lib||c.origin!=='emitted'||c.symbol!==query.name||d.name!==query.name||
   d.identifier&&d.identifier!==query.name||d.disabled||d.scriptCode||d.isSubFunction||flags.some(f=>!allowed.has(f))||
   d.parameters.length+1!==abi.parameters.length||index.carrier(d.returnType,lib)!==abi.returnType)return prior;
 if(!d.parameters.every((ref,i)=>{const p=index.formal(ref,lib);return p&&formalGalaxyCarrier(index,p,lib,d)===abi.parameters[i+1]}))return prior;
 return {...prior,status:'RESOLVED',definition:d,candidateKeys:[c.key],requiredRole:'Event',owner:c.key,
  proof:{kind:'EXACT_NATIVE_EVENT_FORMAL_ABI',candidateOnly:true,fullEditorAndOracleRequired:true,newNativeDefinitions:0}};
}

import {createVerifiedConversionProgram} from '../../map_global_repair_v392_exact_function_signatures_2026-10-24/graph/aa4c4c83caa8-18c27fb7e1b6-76164785f1a0-53f61e3aca29-verified-conversion-program.mjs';
import {analyzePartitionStartupCandidates} from './partition-startup-candidates.experimental.mjs';
const key=x=>x.replaceAll('\\','/').toLowerCase();

// Experimental generation only. The caller must run native compilation and
// the unchanged full-program oracle; this never establishes map equivalence.
export function openPartitionStartupBridge({source,closure,declarations,hashText,libraries,nativeLibraryId}){
 const reject=reason=>{console.error(JSON.stringify({diagnostic:'EXPERIMENTAL_PARTITION_BRIDGE_REJECTED',reason}));return undefined;};
 if(!source||!closure?.completeReachableClosure||closure.status!=='UNCHANGED'||closure.originalInputsChanged!==false||
    typeof source!=='string'||typeof hashText!=='function'||hashText(source)!==closure.root?.sha256)return reject('WHOLE_SOURCE_OR_CLOSURE');
 const files=[{fileName:closure.root.fileName,text:source,sourceId:'whole:script',contentSha256:closure.root.sha256,owned:true}],seen=new Set([key(closure.root.fileName)]);
 for(const f of closure.resolvedFiles??[]){
  if(f.layerId===null){if(f.sha256!==hashText(source))return reject('WHOLE_ROOT_MISMATCH');continue;}
  const found=(declarations??[]).filter(d=>key(d.fileName)===key(f.path)&&hashText(d.text)===f.sha256);
  if(found.length!==1||seen.has(key(f.path)))return reject('DECLARATION_CLOSURE_MEMBER');
  seen.add(key(f.path));files.push({fileName:f.path,text:found[0].text,sourceId:`whole:${f.layerId}:${f.path}`,contentSha256:f.sha256,owned:false});
 }
 const program=createVerifiedConversionProgram(files,undefined,hashText),whole=program.documents.get(closure.root.fileName);
 if(!whole){program.dispose();return reject('WHOLE_PROGRAM_ROOT');}
 return {plan(local,part){
   const targets=local.records.filter(r=>r.reason==='STARTUP_OWNERSHIP_UNPROVED');if(!targets.length)return local;
   const bridge=analyzePartitionStartupCandidates({program,whole,part,closure,libraries,nativeLibraryId,candidates:targets.map(r=>r.callback)});
   if(bridge.status!=='CANDIDATES'){reject(bridge.reason);return local;}
   const eligible=new Set(bridge.records.map(r=>r.constructor)),removed=targets.filter(r=>eligible.has(r.constructor));
   if(!removed.length)return local;
   const callbacks=new Set(local.ordinaryCallbacks);for(const r of removed)callbacks.delete(r.callback);
   return {...local,ordinaryCallbacks:callbacks,records:local.records.filter(r=>!eligible.has(r.constructor)),experimentalPartitionBridge:{kind:'FULL_SOURCE_BINDING_GENERATION_CANDIDATE',constructors:removed.map(r=>r.constructor),sourceSha256:bridge.sourceSha256,fullNativeExportAndOracleRequired:true,wholeProgramAccepted:false}};
  },dispose(){program.dispose();}};
}

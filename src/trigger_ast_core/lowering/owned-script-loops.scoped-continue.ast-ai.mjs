// Apply the already qualified loop lowerers to verified map-owned inputs too.
// The source archive and packed auxiliary files remain the original reference.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lowerStructuralForLoops} from '../../queue_audit_2026-10-15/structural-for-to-while.scoped-continue.ast-ai.mjs';
import {lowerDynamicForLoops} from '../../queue_audit_2026-10-15/dynamic-for-to-while.v3.mjs';
const sha=t=>createHash('sha256').update(t).digest('hex');
export function lowerVerifiedOwnedScriptLoops(verified,{customAiScripts=[],dependencyCustomAiDocuments=[],nativeTemplateLoopPreserver}={}){
 assert.equal(verified.proof.kind,'MAP_OWNED_INCLUDED_SCRIPT_INTEGER_PREDICATE_INPUTS');
 assert.equal(verified.proof.originalInputsMutated,false);assert.equal(verified.proof.sourceOrPackedFilesWritten,false);
 const records=[],files=verified.files.map(file=>{
  const evidence=verified.proof.records.filter(r=>r.fileName===file.fileName&&r.originalPath===file.originalPath.replaceAll('\\','/'));
  assert.equal(evidence.length,1,'OWNED_LOOP_INPUT_PROVENANCE_AMBIGUOUS');assert(evidence[0].originalArchiveEntryVerified);assert.equal(sha(file.text),evidence[0].outputSha256,'OWNED_LOOP_INPUT_CHANGED');
  const structural=lowerStructuralForLoops(file.text,{customAiScripts,dependencyCustomAiDocuments,nativeTemplateLoopPreserver}),dynamic=lowerDynamicForLoops(structural.text);
  records.push({fileName:file.fileName,originalPath:file.originalPath,originalSourceSha256:evidence[0].sourceSha256,inputSha256:sha(file.text),outputSha256:sha(dynamic.text),structural:structural.proof,dynamic:dynamic.proof});
  return{...file,text:dynamic.text};
 });
 return{files,proof:{kind:'VERIFIED_MAP_OWNED_SCRIPT_LOOP_INPUTS',archiveSha256:verified.proof.archiveSha256,records,changedFiles:records.filter(r=>r.inputSha256!==r.outputSha256).length,sourceOrPackedFilesWritten:false,persistentCache:false,wholeMapAccepted:false}};
}

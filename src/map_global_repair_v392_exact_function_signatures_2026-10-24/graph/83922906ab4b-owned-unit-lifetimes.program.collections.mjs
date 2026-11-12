// Apply the same qualified local loop-lifetime proof before structural lowering
// in every archive-verified owned include, preserving original packed sources.
import {withGalaxyDocument} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/850db6e20892-galaxy-program.collections.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {splitClosedUnitLoopLifetimes} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/b56ba4111927-unit-loop-dead-local-regions.shared-ast.mjs';
const sha=text=>createHash('sha256').update(text).digest('hex');
export function prepareOwnedUnitLoopLifetimes(input,{documents}={}){
 assert.equal(input.proof.kind,'MAP_OWNED_INCLUDED_SCRIPT_INTEGER_PREDICATE_INPUTS');
 assert.equal(input.proof.originalInputsMutated,false);assert.equal(input.proof.sourceOrPackedFilesWritten,false);
 assert(Array.isArray(input.files)&&Array.isArray(input.proof.records));
 const records=[],files=input.files.map(file=>{
  const evidence=input.proof.records.filter(r=>r.fileName===file.fileName&&r.originalPath===file.originalPath.replaceAll('\\','/'));
  assert.equal(evidence.length,1,'OWNED_UNIT_LIFETIME_PROVENANCE_AMBIGUOUS');
  const previous=evidence[0];assert(previous.originalArchiveEntryVerified);
  assert.equal(sha(file.text),previous.outputSha256,'OWNED_UNIT_LIFETIME_INPUT_CHANGED');
  const result=withGalaxyDocument(file,documents,document=>document.run('splitClosedUnitLoopLifetimes',view=>splitClosedUnitLoopLifetimes(file.text,view)));
  records.push({...previous,inputSha256:sha(file.text),outputSha256:sha(result.text),closedUnitLifetimes:result.proof});
  return {...file,text:result.text};
 });
 return {files,proof:{...input.proof,kind:'MAP_OWNED_INCLUDED_SCRIPT_UNIT_LIFETIME_INPUTS',records,
  changedFiles:records.filter(r=>r.inputSha256!==r.outputSha256).length,originalInputsMutated:false,sourceOrPackedFilesWritten:false,persistentCache:false,wholeMapAccepted:false}};
}

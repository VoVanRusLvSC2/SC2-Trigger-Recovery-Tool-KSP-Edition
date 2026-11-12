import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyArchiveIncludeBindings} from './archive-include-bindings.mjs';
import {proveArchiveFiniteProgramEquivalence as prove} from './archive-finite-program-proof.mjs';

export async function proveArchiveFiniteProgramEquivalence(before,after,options){
 const bindings=await verifyArchiveIncludeBindings({before,after,...options,includeEvidence:options.closedContext?.includeEvidence});
 const result=await prove(before,after,options);
 for(const [index,side]of ['before','after'].entries()){
  const expected=new Set(bindings.sides[index].ownedTargets),actual=new Set(result.composition[side].files.map(f=>f.fileName.toLowerCase().replaceAll('\\','/')));
  assert.equal(actual.size,expected.size,'ARCHIVE_COMPOSITION_OWNED_FILE_COVERAGE');
  assert([...actual].every(p=>expected.has(p)),'ARCHIVE_COMPOSITION_OWNED_TARGET_CHANGED');
 }
 const added=await Promise.all(['archive-include-bindings.mjs','archive-finite-program-proof.resolved-inputs.mjs'].map(async name=>{
  const url=new URL(name,import.meta.url);return {path:url.href,sha256:createHash('sha256').update(await readFile(url)).digest('hex')};}));
 return {...result,includeBindings:bindings,allOwnedFilesMatchedExplicitLayerResolution:true,implementations:[...result.implementations,...added]};
}

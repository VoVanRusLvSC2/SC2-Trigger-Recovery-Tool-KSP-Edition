import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import path from 'node:path';
import {MapSession} from '../map_global_repair_v548_partition_declaration_identity_2026-10-29/graph/e5e57c2e7db4-e3331844-111df161019e-9ef4a329844dc9-78b2e3c4018ec6-8a7adfb3ba9c8ca7-map_session_fixed.mjs';
import {BoundedLocalModSources} from '../map_corpus_extension_v122_2026-10-05/bounded_local_mod_sources.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p,'utf8'));
export async function openPreparedDataProofContext(cfg,prepared){
 assert.equal(sha(await readFile(cfg.archive)),cfg.archiveSha256,'DATA_PROOF_CONNECTED_ARCHIVE_CHANGED');
 const setup=await json(cfg.config),buildInfo=path.join(setup.installation,'.build.info');
 assert.equal(sha(await readFile(buildInfo)),prepared.cascBuildInfoSha256,'DATA_PROOF_CASC_BUILD_CHANGED');
 const connection=prepared.localDependencyProof?await json(prepared.localDependencyProof):undefined,folders=connection?.localModFolders??[];
 assert(folders.every(p=>!/^[lL]:/u.test(p)),'DATA_PROOF_REMOVED_DRIVE');
 if(connection?.connectedMod)assert.equal(sha(await readFile(connection.connectedMod)),connection.connectedModSha256,'DATA_PROOF_LOCAL_MOD_CHANGED');
 if(connection?.transitiveClosureProof)assert.equal(sha(await readFile(connection.transitiveClosureProof)),connection.transitiveClosureProofSha256,'DATA_PROOF_DEPENDENCY_RECEIPT_CHANGED');
 const sources=folders.length?new BoundedLocalModSources({installationDirectory:setup.installation,sources:folders.map(p=>({type:'mods',path:p,priority:-100}))}):undefined;
 const session=new MapSession({installation:setup.installation,...(sources?{sources}:{}),maxAstBytes:0,maxAstEntries:0});
 try{
  const context=await session.open({schemaVersion:1,target:cfg.archive});assert(!context.unresolved.length,'DATA_PROOF_UNRESOLVED_DEPENDENCY');
  assert.deepEqual(context.layers.map(l=>({sourceId:l.sourceId,sourcePath:l.sourcePath,role:l.role})),prepared.actualChain.map(l=>({sourceId:l.sourceId,sourcePath:l.sourcePath,role:l.role})),'DATA_PROOF_MOUNTED_CHAIN_CHANGED');
  return {context,async close(){let unchanged;try{unchanged=await session.verifyDependencyFiles();assert(unchanged,'DATA_PROOF_DEPENDENCY_CHANGED_DURING_PROOF');assert.equal(sha(await readFile(buildInfo)),prepared.cascBuildInfoSha256,'DATA_PROOF_CASC_BUILD_CHANGED');}finally{await session.dispose();}return {dependenciesUnchanged:unchanged,sessionDisposed:true};}};
 }catch(error){await session.dispose();throw error;}
}

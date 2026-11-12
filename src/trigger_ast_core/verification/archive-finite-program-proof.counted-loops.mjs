import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prepareArchiveProofContext,checkedArchiveProofFile} from './archive-proof-context.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
import {proveClosedFiniteProgramEquivalence} from './finite-program-proof-pipeline.counted-loops.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');

/** One complete comparison view. A partial alpha proof may align independent
 * storage; every other function, value, initializer and observer must still
 * pass the unchanged full-program checker. No per-function union exists. */
export async function proveArchiveFiniteProgramEquivalence(before,after,options){
 const context=await prepareArchiveProofContext(before,after,options),oracle=await openPinnedUserOracle();
 const rawRootComparison=await oracle.compare(before,after),rawArchiveComparison=await oracle.compare(context.before,context.after);
 const finite=await proveClosedFiniteProgramEquivalence(context.before,context.after,{
  ...options,declarations:context.declarations,guiLibraries:context.guiLibraries,closedContext:context.closedContext});
 await oracle.verify();for(const p of [options.sourceArchive,options.candidateArchive,options.exportFile])await checkedArchiveProofFile(p);
 const implementations=await Promise.all(['archive-finite-program-proof.counted-loops.mjs','archive-proof-context.mjs','archive-include-bindings.mjs',
  'map-owned-source-composition.include-once.v3.mjs','native-prefix-before-owned-composition.mjs','gui-global-binding-transport.storage-observers.mjs',
  '../analysis/named-storage-observers.mjs','gui-global-binding-transport.isolated-observers.mjs','finite-program-proof-pipeline.counted-loops.mjs'].map(async name=>{const url=new URL(name,import.meta.url);return {path:url.href,sha256:sha(await readFile(url))};}));
 return {kind:'ACTUAL_ARCHIVE_COMPLETE_PROGRAM_WITH_INDEPENDENT_GLOBAL_BINDINGS',...context.proof,
  inputSha256:{before:sha(before),after:sha(after)},rawRootComparison,rawArchiveComparison,
  globalBindingTransport:finite.proofs.before.find(p=>p.kind==='DECLARED_GUI_SCALAR_GLOBAL_BINDING_TRANSPORT'||p.kind==='GUI_GLOBAL_BINDING_TRANSPORT_REFUSED'),finite,finiteProgramEquivalent:finite.finiteProgramEquivalent,
  completeProgramPairOnly:true,perFunctionProofUnion:false,archiveBytesRechecked:true,
  implementations,oracleAssetsVerified:oracle.assets,oracleManifestSha256:oracle.manifestSha256,
  rawOracleReplaced:false,proofPartition:'INDEPENDENT_SCALAR_STORAGE_WITH_IDENTICAL_OBSERVER_REJECTION',persistentCache:false,
  sourceOrExportChanged:false,actualEditor:false,compile:false,wholeMapAccepted:false,fullOriginalLobbyProved:false};
}

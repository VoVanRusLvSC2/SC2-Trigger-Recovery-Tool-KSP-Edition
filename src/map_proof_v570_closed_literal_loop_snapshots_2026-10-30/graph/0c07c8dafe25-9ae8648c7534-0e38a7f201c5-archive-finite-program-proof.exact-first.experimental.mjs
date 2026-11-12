// Avoid semantic projections when the unchanged user oracle already proves
// the complete, archive-bound program equal. Unsupported/different pairs use
// the existing strict pipeline. This does not authorize GUI or lobby PASS.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {proveArchiveFiniteProgramEquivalence as previous} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_proof_v570_closed_literal_loop_snapshots_2026-10-30/graph/7108cf391a7f-b3d9032f1745-1c4d5f5953a5-archive-finite-program-proof.unused-snapshots.mjs';
import {prepareArchiveProofContext,checkedArchiveProofFile} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_proof_v526_data_namespace_2026-10-29/graph/636c789d01aa-archive-proof-context.mjs';
import {verifySourceCallDeclarationVisibility} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/source-call-declaration-visibility.mjs';
import {openPinnedUserOracle} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/pinned-user-oracle.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');

export async function proveArchiveFiniteProgramEquivalence(before,after,options){
 const started=performance.now(),oracle=await openPinnedUserOracle();
 const rawRootComparison=await oracle.compare(before,after);await oracle.verify();
 // A cheap negative gate avoids building the full closure twice for the
 // usual nonidentical pair. Root equality alone never grants acceptance.
 if(!rawRootComparison.syntaxValid||!rawRootComparison.exact)return previous(before,after,options);
 const context=await prepareArchiveProofContext(before,after,options);
 const rawArchiveComparison=await oracle.compare(context.before,context.after);
 await oracle.verify();
 if(!rawArchiveComparison.syntaxValid||!rawArchiveComparison.exact)return previous(before,after,options);
 const declarationVisibility={before:verifySourceCallDeclarationVisibility(context.before,context.closedContext),after:verifySourceCallDeclarationVisibility(context.after,context.closedContext)};
 if(!declarationVisibility.before.passed||!declarationVisibility.after.passed)return previous(before,after,options);
 await oracle.verify();
 for(const p of [options.sourceArchive,options.candidateArchive,options.exportFile])await checkedArchiveProofFile(p);
 const selectedProofView='UNCHANGED_ORACLE_EXACT_COMPLETE_ARCHIVE',pair=Object.freeze({before:context.before,after:context.after,beforeSha256:sha(context.before),afterSha256:sha(context.after),selectedProofView});
 if(options.observeComparisonPair)await options.observeComparisonPair(pair);
 const implementations=await Promise.all(['archive-finite-program-proof.exact-first.experimental.mjs','archive-proof-context.mjs','shared-archive-owned-declarations.mjs','archive-include-bindings.mjs','map-owned-source-composition.include-once.v3.mjs','source-call-declaration-visibility.mjs','pinned-user-oracle.mjs'].map(async name=>{const url=new URL(name,import.meta.url);return {path:url.href,sha256:sha(await readFile(url))};}));
 const finite={kind:'UNCHANGED_USER_ORACLE_COMPLETE_ARCHIVE_EQUALITY',rawComparison:rawArchiveComparison,comparison:rawArchiveComparison,
  finiteProgramEquivalent:true,selectedProofView,viewSha256:{before:pair.beforeSha256,after:pair.afterSha256},proofs:{before:[],after:[]},newEquivalenceRules:0,
  oracleManifestSha256:oracle.manifestSha256,oracleAssetsVerified:oracle.assets,implementations,
  timings:[{stage:'verified-exact-archive',milliseconds:performance.now()-started}],completeProgramPairOnly:true,perFunctionProofUnion:false,persistentCache:false};
 return {kind:'ACTUAL_ARCHIVE_COMPLETE_PROGRAM_WITH_INDEPENDENT_GLOBAL_BINDINGS',...context.proof,declarationVisibility,
  offlineConversionStatus:'PASS',offlineAcceptanceScope:'BUSINESS_LOGIC_AND_CLOSED_NON_NATIVE_DECLARATION_VISIBILITY; NOT A COMPLETE GALAXY COMPILER OR EDITOR PASS',
  inputSha256:{before:sha(before),after:sha(after)},rawRootComparison,rawArchiveComparison,finite,finiteProgramEquivalent:true,
  completeProgramPairOnly:true,perFunctionProofUnion:false,archiveBytesRechecked:true,implementations,
  oracleAssetsVerified:oracle.assets,oracleManifestSha256:oracle.manifestSha256,rawOracleReplaced:false,persistentCache:false,
  sourceOrExportChanged:false,actualEditor:false,compile:false,wholeMapAccepted:false,fullOriginalLobbyProved:false};
}

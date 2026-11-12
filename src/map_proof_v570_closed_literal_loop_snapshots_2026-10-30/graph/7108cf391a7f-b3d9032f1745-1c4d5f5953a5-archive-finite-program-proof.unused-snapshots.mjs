import assert from 'node:assert/strict';
import {normalizePrivateEmptyStartupStages} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/private-empty-startup-stages.mjs';
import {normalizeAdjacentArrayInitializationPair} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/adjacent-array-stage-proof.token-spans.v2.mjs';
import {normalizeSharedStraightLineCallFrames} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/shared-straight-line-call-frames.mjs';
import {normalizeIndependentLiteralGlobalInitializers} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/independent-literal-global-initializers.mjs';
import {verifySourceCallDeclarationVisibility} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/source-call-declaration-visibility.mjs';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prepareArchiveProofContext,checkedArchiveProofFile} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_proof_v526_data_namespace_2026-10-29/graph/636c789d01aa-archive-proof-context.mjs';
import {openPinnedUserOracle} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/pinned-user-oracle.mjs';
import {proveClosedFiniteProgramEquivalence} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_proof_v570_closed_literal_loop_snapshots_2026-10-30/graph/c70ff581b10a-finite-program-proof-pipeline.unused-snapshots.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');

/** One complete comparison view. A partial alpha proof may align independent
 * storage; every other function, value, initializer and observer must still
 * pass the unchanged full-program checker. No per-function union exists. */
export async function proveArchiveFiniteProgramEquivalence(before,after,options){
 const context=await prepareArchiveProofContext(before,after,options),oracle=await openPinnedUserOracle();
 const declarationVisibility={before:verifySourceCallDeclarationVisibility(context.before,context.closedContext),after:verifySourceCallDeclarationVisibility(context.after,context.closedContext)};
 const rawRootComparison=await oracle.compare(before,after),rawArchiveComparison=await oracle.compare(context.before,context.after);
 const empty=normalizePrivateEmptyStartupStages(context.before,context.after,context.declarations);
 const stages=normalizeAdjacentArrayInitializationPair(empty.before,empty.after,context.declarations);
 const calls=normalizeSharedStraightLineCallFrames(stages.before,stages.after,{externalSources:context.declarations});
 let selectedPair;
 let finite=await proveClosedFiniteProgramEquivalence(calls.before,calls.after,{
  ...options,observeComparisonPair:p=>{assert(!selectedPair,'INITIALIZATION_MULTIPLE_SELECTED_PAIRS');selectedPair=p;},declarations:context.declarations,guiLibraries:context.guiLibraries,closedContext:context.closedContext});
 assert(selectedPair&&sha(selectedPair.before)===finite.viewSha256.before&&sha(selectedPair.after)===finite.viewSha256.after,'INITIALIZATION_SELECTED_PAIR_SHA');
 const applied=Number(empty.proof.before.length+empty.proof.after.length>0)+Number(stages.proof.before.records.length+stages.proof.after.records.length>0)+Number(calls.proof.records.before.length+calls.proof.records.after.length>0);
 let globals={performed:false};
 if(!finite.finiteProgramEquivalent){
  const projected=normalizeIndependentLiteralGlobalInitializers(selectedPair.before,selectedPair.after,context.declarations);
  globals={performed:true,proof:projected.proof,selected:false};
  if(!projected.proof.refused){
   const checked=await oracle.compare(projected.before,projected.after);await oracle.verify();globals.comparison=checked;
   if(checked.syntaxValid&&checked.exact){
    const selectedProofView='CERTIFIED_STARTUP_SHARED_CALLS_AND_LITERAL_GLOBAL_ORDER';
    selectedPair={before:projected.before,after:projected.after,beforeSha256:sha(projected.before),afterSha256:sha(projected.after),selectedProofView};
    finite={...finite,comparison:checked,finiteProgramEquivalent:true,selectedProofView,viewSha256:{before:selectedPair.beforeSha256,after:selectedPair.afterSha256},newEquivalenceRules:(finite.newEquivalenceRules??0)+1};globals.selected=true;
   }
  }
 }
 finite={...finite,newEquivalenceRules:(finite.newEquivalenceRules??0)+applied};
 const initializationRefinement={emptyStages:empty.proof,adjacentArrayStages:stages.proof,unchangedSharedCalls:calls.proof,literalGlobals:globals,oneCompleteProgramPair:true,perFunctionProofUnion:false};
 if(options.observeComparisonPair)await options.observeComparisonPair(Object.freeze(selectedPair));
 await oracle.verify();for(const p of [options.sourceArchive,options.candidateArchive,options.exportFile])await checkedArchiveProofFile(p);
 const implementations=await Promise.all(['archive-finite-program-proof.unused-snapshots.mjs','private-empty-startup-stages.mjs','adjacent-array-stage-proof.token-spans.v2.mjs','shared-straight-line-call-frames.mjs','independent-literal-global-initializers.mjs','finite-program-proof-pipeline.unused-snapshots.mjs','unreferenced-constant-snapshot-locals.mjs','finite-program-proof-pipeline.constant-range-snapshots.mjs','source-call-declaration-visibility.mjs','file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/source-function-families.mjs','archive-proof-context.mjs','archive-include-bindings.mjs',
  'shared-archive-owned-declarations.mjs','map-owned-source-composition.include-once.v3.mjs','native-prefix-before-owned-composition.mjs','gui-global-binding-transport.storage-observers.mjs',
  'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/analysis/named-storage-observers.mjs','gui-global-binding-transport.isolated-observers.mjs','finite-program-proof-pipeline.closed-storage-frames.mjs'].map(async name=>{const url=new URL(name,import.meta.url);return {path:url.href,sha256:sha(await readFile(url))};}));
 return {kind:'ACTUAL_ARCHIVE_COMPLETE_PROGRAM_WITH_INDEPENDENT_GLOBAL_BINDINGS',...context.proof,declarationVisibility,initializationRefinement,
  offlineConversionStatus:finite.finiteProgramEquivalent&&declarationVisibility.after.passed?'PASS':'REVIEW',
  offlineAcceptanceScope:'BUSINESS_LOGIC_AND_CLOSED_NON_NATIVE_DECLARATION_VISIBILITY; NOT A COMPLETE GALAXY COMPILER OR EDITOR PASS',
  inputSha256:{before:sha(before),after:sha(after)},rawRootComparison,rawArchiveComparison,
  globalBindingTransport:finite.proofs.before.find(p=>p.kind==='DECLARED_GUI_SCALAR_GLOBAL_BINDING_TRANSPORT'||p.kind==='GUI_GLOBAL_BINDING_TRANSPORT_REFUSED'),finite,finiteProgramEquivalent:finite.finiteProgramEquivalent,
  completeProgramPairOnly:true,perFunctionProofUnion:false,archiveBytesRechecked:true,
  implementations,oracleAssetsVerified:oracle.assets,oracleManifestSha256:oracle.manifestSha256,
  rawOracleReplaced:false,proofPartition:'INDEPENDENT_SCALAR_STORAGE_WITH_IDENTICAL_OBSERVER_REJECTION',persistentCache:false,
  sourceOrExportChanged:false,actualEditor:false,compile:false,wholeMapAccepted:false,fullOriginalLobbyProved:false};
}

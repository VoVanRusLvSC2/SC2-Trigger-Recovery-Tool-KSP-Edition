import {composeArchiveRootAlpha} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/archive-root-alpha-composition.mjs';
import {refineObservableLocalFillPair} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_proof_v561_batched_storage_observers_2026-10-30/graph/8447d7e405f1-8e083ebb1613-observable-local-fill-pair.mjs';
import {refineClosedCaptureEntryPair} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/closed-capture-entry-pair.mjs';
import {refinePrivateEntryRangePair} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/private-entry-range-pair.mjs';
import {prepareArchiveProofContext} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/archive-proof-context.mjs';
// A bounded alpha refinement of one complete, archive-verified program pair.
// Preserve every raw oracle result; never combine per-function acceptances.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {proveArchiveFiniteProgramEquivalence as previous} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_proof_v570_closed_literal_loop_snapshots_2026-10-30/graph/0c07c8dafe25-9ae8648c7534-0e38a7f201c5-archive-finite-program-proof.exact-first.experimental.mjs';
import {readPrivateRootArchiveScope,projectPrivateRootCallbackAlpha,verifyProtectedRootSourcesUnchanged} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v560_catalog_demand_source_closure_2026-10-30/graph/fc54aa3a2e8b-ae2dbafa27dd-2bfac4832f86-private-root-callback-alpha.typed-resource-ranges.mjs';
import {openPinnedUserOracle} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/pinned-user-oracle.mjs';
import {checkedArchiveProofFile} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_proof_v526_data_namespace_2026-10-29/graph/636c789d01aa-archive-proof-context.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
async function previousArchive(before,after,options){
 let pair;const base=await previous(before,after,{...options,observeComparisonPair:p=>{assert(!pair);pair=p;}});
 assert(pair&&sha(pair.before)===base.finite.viewSha256.before&&sha(pair.after)===base.finite.viewSha256.after,'ROOT_ALPHA_BASE_PAIR_IDENTITY');
 let chosen=pair,result=base,refinement={performed:false};
 if(!base.finiteProgramEquivalent){
  try{
   const scope=await readPrivateRootArchiveScope(options.sourceArchive,before,{openDataContext:options.openDataProofContext,externalSources:options.declarations??[]});let view=projectPrivateRootCallbackAlpha(pair.before,pair.after,{scope,sourceRoot:before,candidateRoot:after,externalSources:options.declarations??[]});
   const protectedSources=await verifyProtectedRootSourcesUnchanged(scope,options.candidateArchive);
   const oracle=await openPinnedUserOracle();assert.equal(oracle.manifestSha256,base.oracleManifestSha256);let checked=await oracle.compare(view.before,view.after);await oracle.verify();
   let privateEntryRefinement;
   if(!checked.exact){try{const closure=await prepareArchiveProofContext(before,after,options),projected=refinePrivateEntryRangePair(view.before,view.after,{context:closure.closedContext,observerRoots:[before,after],externalSources:[...(closure.closedContext.ownedSources??[]),...(closure.closedContext.externalSources??[])]}),candidate=await oracle.compare(projected.before,projected.after);await oracle.verify();privateEntryRefinement={proof:projected.proof,comparison:candidate,selected:candidate.syntaxValid&&candidate.exact};if(privateEntryRefinement.selected){view={before:projected.before,after:projected.after,proof:{...view.proof,privateEntryRefinement}};checked=candidate;}}catch(e){privateEntryRefinement={refused:e.message,selected:false};}}
   view={...view,proof:{...view.proof,privateEntryRefinement}};
   refinement={performed:true,proof:{...view.proof,protectedSources},comparison:checked,completeProgramCompared:true,selected:checked.syntaxValid&&checked.exact};
   if(refinement.selected){
    const selectedProofView='ARCHIVE_BOUND_PRIVATE_ROOT_CALLBACK_IDENTITIES';chosen={before:view.before,after:view.after,beforeSha256:sha(view.before),afterSha256:sha(view.after),selectedProofView};
    const finite={...base.finite,comparison:checked,finiteProgramEquivalent:true,selectedProofView,viewSha256:{before:chosen.beforeSha256,after:chosen.afterSha256},newEquivalenceRules:(base.finite.newEquivalenceRules??0)+1};
    result={...base,finite,finiteProgramEquivalent:true,offlineConversionStatus:base.declarationVisibility.after.passed?'PASS':'REVIEW'};
   }
  }catch(e){refinement={performed:true,refused:e.message,selected:false,bothFullInputsRetained:true};}
 }
 const implementations=await Promise.all([import.meta.url,'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v560_catalog_demand_source_closure_2026-10-30/graph/fc54aa3a2e8b-ae2dbafa27dd-2bfac4832f86-private-root-callback-alpha.typed-resource-ranges.mjs','file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/passes/qualified-root-trigger-aliases.protected-sources.mjs','file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/passes/source-bound-trigger-aliases.preserve-identities.mjs','file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/analysis/protocol-name-flow.projected-string-types.mjs'].map(async name=>{const url=new URL(name,import.meta.url);return {path:url.href,sha256:sha(await readFile(url))};}));
 for(const pin of [options.sourceArchive,options.candidateArchive,options.exportFile])await checkedArchiveProofFile(pin);
 result={...result,finite:{...result.finite,implementations:[...(result.finite.implementations??[]),...implementations]}};
 if(options.observeComparisonPair)await options.observeComparisonPair(Object.freeze(chosen));
 return {...result,rootCallbackAlphaRefinement:refinement,implementations:[...base.implementations,...implementations],completeProgramPairOnly:true,perFunctionProofUnion:false,rawOracleReplaced:false,sourceOrExportChanged:false,wholeMapAccepted:false};
}

async function previousObservableArchive(before,after,options){
 let pair;const base=await previousArchive(before,after,{...options,observeComparisonPair:p=>{assert(!pair,'CAPTURE_ENTRY_MULTIPLE_BASE_PAIRS');pair=p;}});
 assert(pair&&sha(pair.before)===base.finite.viewSha256.before&&sha(pair.after)===base.finite.viewSha256.after,'CAPTURE_ENTRY_BASE_PAIR_IDENTITY');
 let chosen=pair,result=base,refinement={performed:false};
 if(!base.finiteProgramEquivalent){try{
  const closure=await prepareArchiveProofContext(before,after,options),view=refineClosedCaptureEntryPair(pair.before,pair.after,{context:closure.closedContext,observerRoots:[before,after],externalSources:[...(closure.closedContext.ownedSources??[]),...(closure.closedContext.externalSources??[])]}),oracle=await openPinnedUserOracle();
  assert.equal(oracle.manifestSha256,base.oracleManifestSha256,'CAPTURE_ENTRY_ORACLE_CHANGED');const checked=await oracle.compare(view.before,view.after);await oracle.verify();
  refinement={performed:true,proof:view.proof,comparison:checked,completeProgramCompared:true,selected:checked.syntaxValid&&checked.exact};
  if(refinement.selected){const selectedProofView='CLOSED_CAPTURE_ENTRY_EFFECTS_COMPLETE_ARCHIVE';chosen={before:view.before,after:view.after,beforeSha256:sha(view.before),afterSha256:sha(view.after),selectedProofView};result={...base,finite:{...base.finite,comparison:checked,finiteProgramEquivalent:true,selectedProofView,viewSha256:{before:chosen.beforeSha256,after:chosen.afterSha256},newEquivalenceRules:(base.finite.newEquivalenceRules??0)+1},finiteProgramEquivalent:true,offlineConversionStatus:base.declarationVisibility.after.passed?'PASS':'REVIEW'};}
 }catch(e){refinement={performed:true,refused:e.message,selected:false};}}
 for(const pin of [options.sourceArchive,options.candidateArchive,options.exportFile])await checkedArchiveProofFile(pin);
 if(options.observeComparisonPair)await options.observeComparisonPair(Object.freeze(chosen));return{...result,closedCaptureEntryRefinement:refinement,perFunctionProofUnion:false,sourceOrExportChanged:false,wholeMapAccepted:false};
}

export async function proveArchiveFiniteProgramEquivalence(before,after,options){
 let pair;const base=await previousObservableArchive(before,after,{...options,observeComparisonPair:p=>{assert(!pair,'OBSERVABLE_FILL_MULTIPLE_BASE_PAIRS');pair=p;}});
 assert(pair&&sha(pair.before)===base.finite.viewSha256.before&&sha(pair.after)===base.finite.viewSha256.after,'OBSERVABLE_FILL_BASE_PAIR_IDENTITY');
 let chosen=pair,result=base,refinement={performed:false};
 if(!base.finiteProgramEquivalent){try{
  const closure=await prepareArchiveProofContext(before,after,options),view=refineObservableLocalFillPair(pair.before,pair.after,{context:closure.closedContext,observerRoots:[before,after],externalSources:closure.declarations}),oracle=await openPinnedUserOracle();
  assert.equal(oracle.manifestSha256,base.oracleManifestSha256,'OBSERVABLE_FILL_ORACLE_CHANGED');const checked=await oracle.compare(view.before,view.after);await oracle.verify();
  refinement={performed:true,proof:view.proof,comparison:checked,completeProgramCompared:true,selected:checked.syntaxValid&&checked.exact};
  if(refinement.selected){const selectedProofView='OBSERVABLE_LOCAL_STORAGE_AND_COMPLETE_NULL_FILL_ARCHIVE';chosen={before:view.before,after:view.after,beforeSha256:sha(view.before),afterSha256:sha(view.after),selectedProofView};result={...base,finite:{...base.finite,comparison:checked,finiteProgramEquivalent:true,selectedProofView,viewSha256:{before:chosen.beforeSha256,after:chosen.afterSha256},newEquivalenceRules:(base.finite.newEquivalenceRules??0)+1},finiteProgramEquivalent:true,offlineConversionStatus:base.declarationVisibility.after.passed?'PASS':'REVIEW'};}
 }catch(e){refinement={performed:true,refused:e.message,selected:false};}}

 let lateRootCallbackAlphaRefinement={performed:false};
 if(!result.finiteProgramEquivalent&&base.rootCallbackAlphaRefinement?.proof?.permission){try{
  assert.equal(chosen.beforeSha256,result.finite.viewSha256.before,'COMPOSED_ROOT_BEFORE_VIEW_SHA');
  assert.equal(chosen.afterSha256,result.finite.viewSha256.after,'COMPOSED_ROOT_AFTER_VIEW_SHA');
  const composed=await composeArchiveRootAlpha({pair:chosen,before,after,options,oracleManifestSha256:base.oracleManifestSha256});
  lateRootCallbackAlphaRefinement={performed:true,proof:composed.proof,comparison:composed.comparison,selected:composed.selected,completeProgramCompared:true};
  if(composed.selected){
   const selectedProofView='COMPOSED_ROOT_IDENTITIES_AND_LITERAL_GLOBAL_STORES';
   chosen={before:composed.before,after:composed.after,beforeSha256:sha(composed.before),afterSha256:sha(composed.after),selectedProofView};
   result={...result,finite:{...result.finite,comparison:composed.comparison,finiteProgramEquivalent:true,selectedProofView,
    viewSha256:{before:chosen.beforeSha256,after:chosen.afterSha256},newEquivalenceRules:(result.finite.newEquivalenceRules??0)+1+composed.proof.newEquivalenceRules},
    finiteProgramEquivalent:true,offlineConversionStatus:result.declarationVisibility.after.passed?'PASS':'REVIEW'};
  }
 }catch(error){lateRootCallbackAlphaRefinement={performed:true,refused:error.message,selected:false};}}
 for(const pin of [options.sourceArchive,options.candidateArchive,options.exportFile])await checkedArchiveProofFile(pin);
 if(options.observeComparisonPair)await options.observeComparisonPair(Object.freeze(chosen));return{...result,observableLocalFillRefinement:refinement,lateRootCallbackAlphaRefinement,perFunctionProofUnion:false,sourceOrExportChanged:false,wholeMapAccepted:false};
}

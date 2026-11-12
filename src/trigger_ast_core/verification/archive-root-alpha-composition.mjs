// Reapply an already supported source-bound permission to the latest complete
// comparison pair. No function-wise verdicts or partially matching views merge.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readPrivateRootArchiveScope,projectPrivateRootCallbackAlpha,verifyProtectedRootSourcesUnchanged} from '../../map_global_repair_v560_catalog_demand_source_closure_2026-10-30/graph/fc54aa3a2e8b-ae2dbafa27dd-2bfac4832f86-private-root-callback-alpha.typed-resource-ranges.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
import {canonicalIndependentLiteralGlobalAnchors} from './independent-literal-global-anchors.mjs';
import {checkedArchiveProofFile} from '../../map_proof_v526_data_namespace_2026-10-29/graph/636c789d01aa-archive-proof-context.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');

export async function composeArchiveRootAlpha({pair,before,after,options,oracleManifestSha256}) {
 assert(pair&&pair.beforeSha256===sha(pair.before)&&pair.afterSha256===sha(pair.after),'ROOT_ALPHA_COMPOSITION_INPUT_PAIR_SHA');
 for(const pin of [options.sourceArchive,options.candidateArchive,options.exportFile])await checkedArchiveProofFile(pin);
 const scope=await readPrivateRootArchiveScope(options.sourceArchive,before,{openDataContext:options.openDataProofContext,externalSources:options.declarations??[]});
 let view=projectPrivateRootCallbackAlpha(pair.before,pair.after,{scope,sourceRoot:before,candidateRoot:after,externalSources:options.declarations??[]});
 const protectedSources=await verifyProtectedRootSourcesUnchanged(scope,options.candidateArchive);
 const oracle=await openPinnedUserOracle();assert.equal(oracle.manifestSha256,oracleManifestSha256,'ROOT_ALPHA_COMPOSITION_ORACLE_CHANGED');
 let comparison=await oracle.compare(view.before,view.after);await oracle.verify();let literalGlobalAnchors;
 if(!comparison.exact){
  const a=canonicalIndependentLiteralGlobalAnchors(view.before),b=canonicalIndependentLiteralGlobalAnchors(view.after);
  if(a.proof.records.length||b.proof.records.length){
   const composed=await oracle.compare(a.text,b.text);await oracle.verify();
   literalGlobalAnchors={before:a.proof,after:b.proof,comparison:composed,completeProgramCompared:true,selected:composed.syntaxValid&&composed.exact};
   if(literalGlobalAnchors.selected){view={before:a.text,after:b.text,proof:view.proof};comparison=composed;}
  }
 }
 for(const pin of [options.sourceArchive,options.candidateArchive,options.exportFile])await checkedArchiveProofFile(pin);
 return {before:view.before,after:view.after,comparison,selected:comparison.syntaxValid&&comparison.exact,
  proof:{kind:'SOURCE_BOUND_ROOT_ALIAS_AFTER_COMPLETE_VIEW',inputPairSha256:{before:pair.beforeSha256,after:pair.afterSha256},
   outputPairSha256:{before:sha(view.before),after:sha(view.after)},projection:view.proof,protectedSources,
   oracleManifestSha256,oracleAssetsVerified:oracle.assets,literalGlobalAnchors,newEquivalenceRules:literalGlobalAnchors?.selected?1:0,
   completeProgramCompared:true,perFunctionUnion:false,sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false}};
}

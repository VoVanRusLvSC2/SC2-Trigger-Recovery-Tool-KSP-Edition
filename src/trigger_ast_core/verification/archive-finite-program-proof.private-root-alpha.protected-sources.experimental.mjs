// A bounded alpha refinement of one complete, archive-verified program pair.
// Preserve every raw oracle result; never combine per-function acceptances.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {proveArchiveFiniteProgramEquivalence as previous} from './archive-finite-program-proof.exact-first.experimental.mjs';
import {readPrivateRootArchiveScope,projectPrivateRootCallbackAlpha,verifyProtectedRootSourcesUnchanged} from './private-root-callback-alpha.protected-sources.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
import {checkedArchiveProofFile} from './archive-proof-context.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
export async function proveArchiveFiniteProgramEquivalence(before,after,options){
 let pair;const base=await previous(before,after,{...options,observeComparisonPair:p=>{assert(!pair);pair=p;}});
 assert(pair&&sha(pair.before)===base.finite.viewSha256.before&&sha(pair.after)===base.finite.viewSha256.after,'ROOT_ALPHA_BASE_PAIR_IDENTITY');
 let chosen=pair,result=base,refinement={performed:false};
 if(!base.finiteProgramEquivalent){
  try{
   const scope=await readPrivateRootArchiveScope(options.sourceArchive,before),view=projectPrivateRootCallbackAlpha(pair.before,pair.after,{scope,sourceRoot:before,candidateRoot:after,externalSources:options.declarations??[]});
   const protectedSources=await verifyProtectedRootSourcesUnchanged(scope,options.candidateArchive);
   const oracle=await openPinnedUserOracle();assert.equal(oracle.manifestSha256,base.oracleManifestSha256);const checked=await oracle.compare(view.before,view.after);await oracle.verify();
   refinement={performed:true,proof:{...view.proof,protectedSources},comparison:checked,completeProgramCompared:true,selected:checked.syntaxValid&&checked.exact};
   if(refinement.selected){
    const selectedProofView='ARCHIVE_BOUND_PRIVATE_ROOT_CALLBACK_IDENTITIES';chosen={before:view.before,after:view.after,beforeSha256:sha(view.before),afterSha256:sha(view.after),selectedProofView};
    const finite={...base.finite,comparison:checked,finiteProgramEquivalent:true,selectedProofView,viewSha256:{before:chosen.beforeSha256,after:chosen.afterSha256},newEquivalenceRules:(base.finite.newEquivalenceRules??0)+1};
    result={...base,finite,finiteProgramEquivalent:true,offlineConversionStatus:base.declarationVisibility.after.passed?'PASS':'REVIEW'};
   }
  }catch(e){refinement={performed:true,refused:e.message,selected:false,bothFullInputsRetained:true};}
 }
 const implementations=await Promise.all(['archive-finite-program-proof.private-root-alpha.protected-sources.experimental.mjs','private-root-callback-alpha.protected-sources.mjs','../passes/qualified-root-trigger-aliases.protected-sources.mjs','../passes/source-bound-trigger-aliases.preserve-identities.mjs','../analysis/protocol-name-flow.projected-string-types.mjs'].map(async name=>{const url=new URL(name,import.meta.url);return {path:url.href,sha256:sha(await readFile(url))};}));
 for(const pin of [options.sourceArchive,options.candidateArchive,options.exportFile])await checkedArchiveProofFile(pin);
 result={...result,finite:{...result.finite,implementations:[...(result.finite.implementations??[]),...implementations]}};
 if(options.observeComparisonPair)await options.observeComparisonPair(Object.freeze(chosen));
 return {...result,rootCallbackAlphaRefinement:refinement,implementations:[...base.implementations,...implementations],completeProgramPairOnly:true,perFunctionProofUnion:false,rawOracleReplaced:false,sourceOrExportChanged:false,wholeMapAccepted:false};
}

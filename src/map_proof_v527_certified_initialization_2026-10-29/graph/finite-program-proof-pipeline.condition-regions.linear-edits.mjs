import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {proveClosedFiniteProgramEquivalence as establishedProof} from './finite-program-proof-pipeline.symmetric-attributes.linear-edits.mjs';
import {projectClosedConditionFunctions} from './closed-condition-function-view.compiler-contracts.mjs';
import {canonicalLocalIntegerControlValues} from './local-integer-control-values.linear-edits.mjs';
import {qualifyDocumentAttributePair} from './document-attribute-selector-pair.mjs';
const sha=text=>createHash('sha256').update(text).digest('hex');

// Try one additional complete-program proof. Never combine function subsets,
// replace the raw oracle result, or revoke an established complete proof.
export async function proveClosedFiniteProgramEquivalence(before,after,options={}) {
  const previous=await establishedProof(before,after,options);
  const implementations=await Promise.all([
    'finite-program-proof-pipeline.condition-regions.linear-edits.mjs','closed-condition-function-view.compiler-contracts.mjs',
    '../model/closed-source-function-reachability.compiler-contracts.mjs','../model/finite-function-reference-targets.compiler-contracts.mjs',
    'document-attribute-selector-pair.mjs','document-attribute-selector-view.mjs','../model/compiler-contract-analysis-inputs.mjs','../types/qualified-compiler-contracts.mjs',
    'local-integer-control-values.linear-edits.mjs','../model/reversible-source-edits.linear.mjs','../model/closed-condition-region.mjs',
  ].map(async name=>{const url=new URL(name,import.meta.url);return {path:url.href,sha256:sha(await readFile(url))};}));
  previous.implementations.push(...implementations);
  if(previous.finiteProgramEquivalent)return previous;
  let attributePair,attribute,region,control;
  const started=performance.now();
  try{
    if(options.documentAttributes){attributePair=await qualifyDocumentAttributePair(before,after,{...options.closedContext,...options.documentAttributes});attribute=attributePair.before;}
    region=projectClosedConditionFunctions(attribute?.text??before,attributePair?.after.text??after,
      {...options.closedContext,nativeGuiLibraries:options.nativeGuiLibraries,compilerQualification:options.compilerQualification??options.closedContext?.compilerQualification});
    // The region proof has a required dispatch obligation. Do not repeat the
    // entire numeric pipeline while that obligation and new functions remain.
    if(region.proof.reason?.startsWith('UNCLOSED_DISPATCH:')&&
      (previous.comparison.functions.added.length||previous.comparison.functions.missing.length))
      return {...previous,conditionRegionRefinement:{region:region.proof,refused:'FUNCTION_INVENTORY_REQUIRES_CLOSED_REGION_PROOF',
        repeatedFullNumericPipelineSkipped:true,wholeMapAccepted:false}};
    control={before:canonicalLocalIntegerControlValues(region.before),after:canonicalLocalIntegerControlValues(region.after)};
    if(!region.proof.byteInverseVerified&&control.before.text===region.before&&control.after.text===region.after)return previous;
    const projectionMilliseconds=performance.now()-started;
    const alternate=await establishedProof(control.before.text,control.after.text,{...options,documentAttributes:undefined});
    const stage={region:region.proof,control:{before:control.before.proof,after:control.after.proof},attribute:attribute?.proof,attributeTarget:attributePair?.after.proof,attributePair:attributePair?.proof,
      originalComparison:previous.comparison,completeComparison:alternate.comparison,
      comparedSources:options.captureComparedViews?alternate.comparedSources:undefined,completeProgramCompared:true};
    const accounting={rawOracleComparisons:previous.rawOracleComparisons+alternate.rawOracleComparisons,
      finalOracleComparisons:previous.finalOracleComparisons+alternate.finalOracleComparisons,
      timings:[...previous.timings,{stage:'closed-condition-and-integer-control-projection',milliseconds:projectionMilliseconds},
        ...alternate.timings.map(row=>({...row,stage:'condition-projection:'+row.stage}))]};
    if(!alternate.finiteProgramEquivalent)return {...previous,...accounting,conditionRegionRefinement:stage};
    return {...alternate,inputSha256:previous.inputSha256,rawVerdict:previous.rawVerdict,rawComparison:previous.rawComparison,
      selectedProofView:'CLOSED_CONDITION_REGIONS_AND_INTEGER_CONTROL',conditionRegionRefinement:stage,
      documentAttributeSelectorStage:attribute?.proof??previous.documentAttributeSelectorStage,documentAttributeTargetSelectorStage:attributePair?.after.proof??previous.documentAttributeTargetSelectorStage,documentAttributePairStage:attributePair?.proof??previous.documentAttributePairStage,
      implementations:[...alternate.implementations,...implementations],
      ...accounting,
      rawOracleReplaced:false,sourceOrExportChanged:false,wholeMapAccepted:false};
  }catch(error){return {...previous,conditionRegionRefinement:{refused:error.message,sourceOrExportChanged:false,wholeMapAccepted:false}};}
}

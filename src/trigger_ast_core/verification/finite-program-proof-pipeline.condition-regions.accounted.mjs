import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {proveClosedFiniteProgramEquivalence as establishedProof} from './finite-program-proof-pipeline.typed-double-negation.trivia-safe.mjs';
import {projectClosedConditionFunctions} from './closed-condition-function-view.mjs';
import {canonicalLocalIntegerControlValues} from './local-integer-control-values.mjs';
import {qualifyDocumentAttributeView} from './document-attribute-selector-view.mjs';
const sha=text=>createHash('sha256').update(text).digest('hex');

// Try one additional complete-program proof. Never combine function subsets,
// replace the raw oracle result, or revoke an established complete proof.
export async function proveClosedFiniteProgramEquivalence(before,after,options={}) {
  const previous=await establishedProof(before,after,options);
  const implementations=await Promise.all([
    'finite-program-proof-pipeline.condition-regions.accounted.mjs','closed-condition-function-view.mjs',
    'local-integer-control-values.mjs','../model/reversible-source-edits.mjs','../model/closed-condition-region.mjs',
  ].map(async name=>{const url=new URL(name,import.meta.url);return {path:url.href,sha256:sha(await readFile(url))};}));
  previous.implementations.push(...implementations);
  if(previous.finiteProgramEquivalent)return previous;
  let attribute,region,control;
  const started=performance.now();
  try{
    if(options.documentAttributes)attribute=qualifyDocumentAttributeView(before,{...options.closedContext,...options.documentAttributes});
    region=projectClosedConditionFunctions(attribute?.text??before,after,
      {...options.closedContext,nativeGuiLibraries:options.nativeGuiLibraries});
    control={before:canonicalLocalIntegerControlValues(region.before),after:canonicalLocalIntegerControlValues(region.after)};
    if(!region.proof.byteInverseVerified&&control.before.text===region.before&&control.after.text===region.after)return previous;
    const projectionMilliseconds=performance.now()-started;
    const alternate=await establishedProof(control.before.text,control.after.text,{...options,documentAttributes:undefined});
    const stage={region:region.proof,control:{before:control.before.proof,after:control.after.proof},attribute:attribute?.proof,
      originalComparison:previous.comparison,completeComparison:alternate.comparison,completeProgramCompared:true};
    const accounting={rawOracleComparisons:previous.rawOracleComparisons+alternate.rawOracleComparisons,
      finalOracleComparisons:previous.finalOracleComparisons+alternate.finalOracleComparisons,
      timings:[...previous.timings,{stage:'closed-condition-and-integer-control-projection',milliseconds:projectionMilliseconds},
        ...alternate.timings.map(row=>({...row,stage:'condition-projection:'+row.stage}))]};
    if(!alternate.finiteProgramEquivalent)return {...previous,...accounting,conditionRegionRefinement:stage};
    return {...alternate,inputSha256:previous.inputSha256,rawVerdict:previous.rawVerdict,rawComparison:previous.rawComparison,
      selectedProofView:'CLOSED_CONDITION_REGIONS_AND_INTEGER_CONTROL',conditionRegionRefinement:stage,
      documentAttributeSelectorStage:attribute?.proof??previous.documentAttributeSelectorStage,
      implementations:[...alternate.implementations,...implementations],
      ...accounting,
      rawOracleReplaced:false,sourceOrExportChanged:false,wholeMapAccepted:false};
  }catch(error){return {...previous,conditionRegionRefinement:{refused:error.message,sourceOrExportChanged:false,wholeMapAccepted:false}};}
}

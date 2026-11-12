import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {proveClosedFiniteProgramEquivalence as previous} from './finite-program-proof-pipeline.grouped-global-layout.mjs';
import {canonicalPassiveArrayLocalInitializers as canonical} from './passive-array-local-initializers.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const score=p=>p.comparison.functions.differing.length+p.comparison.functions.missing.length+p.comparison.functions.added.length;

// A second whole-program proof view. An existing proof is retained. No union
// of per-function successes and no predicate based on a map or function name.
export async function proveClosedFiniteProgramEquivalence(before,after,options={}){
 const base=await previous(before,after,options);if(base.finiteProgramEquivalent)return base;
 const left=canonical(before),right=canonical(after);if(!left.proof.edits.length&&!right.proof.edits.length)return base;
 const alternate=await previous(left.text,right.text,options);
 const applied=alternate.finiteProgramEquivalent||score(alternate)<score(base),selected=applied?alternate:base;
 const implementations=[];
 for(const name of ['finite-program-proof-pipeline.passive-local-arrays.mjs','passive-array-local-initializers.mjs']){
  const url=new URL(name,import.meta.url);implementations.push({path:url.href,sha256:sha(await readFile(url))});
 }
 return {...selected,inputSha256:base.inputSha256,rawComparison:base.rawComparison,rawVerdict:base.rawVerdict,
  proofs:applied?{before:[left.proof,...alternate.proofs.before],after:[right.proof,...alternate.proofs.after]}:base.proofs,
  selectedProofView:applied?'PASSIVE_LOCAL_ARRAYS/'+alternate.selectedProofView:base.selectedProofView,
  passiveLocalArrayRefinement:{applied,before:left.proof,after:right.proof,baseFiniteEquivalent:base.finiteProgramEquivalent,
   baseDifferingFunctions:base.comparison.functions.differing,alternateDifferingFunctions:alternate.comparison.functions.differing,
   completeAlternateOracleStillRequired:true},implementations:[...selected.implementations,...implementations],
  timings:[...base.timings,...alternate.timings.map(t=>({...t,stage:'passive-array-view:'+t.stage}))],
  rawOracleComparisons:base.rawOracleComparisons+alternate.rawOracleComparisons,
  finalOracleComparisons:base.finalOracleComparisons+alternate.finalOracleComparisons,
  originalRawOracleRetained:true,sourceOrExportChanged:false,wholeMapAccepted:false};
}

// Compose the existing source-bound native ABI literal proof with the common
// finite program tier. Original raw verdicts and both input byte hashes remain.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
import {canonicalClosedAbiFixedLiterals} from './closed-abi-fixed-literals.mjs';
import {qualifyNativePrefixBeforeComposition} from './native-prefix-before-owned-composition.mjs';
import {proveFiniteProgramEquivalence} from './finite-program-equivalence.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
export async function proveClosedFiniteProgramEquivalence(before,after,{declarations=[],nativeProof,closedContext={}}={}){
 const oracle=await openPinnedUserOracle(),rawComparison=oracle.compare(before,after),stages={};
 const views={};
 for(const [side,text]of [['before',before],['after',after]]){
  const prefix=qualifyNativePrefixBeforeComposition(text,{declarations,nativeProof});
  const fixed=canonicalClosedAbiFixedLiterals(prefix.text,closedContext);
  stages[side]=[prefix.proof,fixed.proof];views[side]=fixed.text;
 }
 const result=await proveFiniteProgramEquivalence(views.before,views.after,{declarations,nativeProof});
 await oracle.verify();
 const implementations=[...result.implementations];
 for(const name of ['finite-program-equivalence.closed-abi.mjs','closed-abi-fixed-literals.mjs','bounded-numeric-literal-arithmetic.recursive.mjs']){
  const url=new URL(name,import.meta.url);implementations.push({path:url.href,sha256:sha(await readFile(url))});
 }
 return {...result,kind:'CLOSED_ABI_FINITE_COMPLETE_PROGRAM_EQUIVALENCE',
  inputSha256:{before:sha(before),after:sha(after)},
  rawVerdict:rawComparison.exact?'MATCH':rawComparison.syntaxValid?'REVIEW':'INVALID_SYNTAX',rawComparison,
  closedAbiStages:stages,finiteTierInputSha256:result.inputSha256,implementations,
  newEquivalenceRules:0,sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false};
}

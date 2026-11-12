// Additional read-only proof tier. Keep the user's raw comparison untouched;
// full program equality is still required after verified private-counter SSA.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
import {normalizeBoundPrivateForCounters} from './private-for-counter-lifetimes.mjs';
import {proveClosedFiniteProgramEquivalence as previous} from './finite-program-equivalence.closed-abi.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
export async function proveClosedFiniteProgramEquivalence(before,after,options={}){
 const oracle=await openPinnedUserOracle(),rawComparison=oracle.compare(before,after);
 const counters=normalizeBoundPrivateForCounters(before,after);
 const result=await previous(counters.before,counters.after,options);
 await oracle.verify();
 const implementations=[...result.implementations];
 for(const name of ['private-for-counter-lifetimes.mjs','finite-program-equivalence.private-counters.mjs']){
  const url=new URL(name,import.meta.url);implementations.push({path:url.href,sha256:sha(await readFile(url))});
 }
 return {...result,kind:'BOUND_PRIVATE_COUNTER_CLOSED_ABI_COMPLETE_PROGRAM_EQUIVALENCE',
  inputSha256:{before:sha(before),after:sha(after)},privateCounterStage:counters.proof,
  privateCounterTierInputSha256:result.inputSha256,implementations,
  rawVerdict:rawComparison.exact?'MATCH':rawComparison.syntaxValid?'REVIEW':'INVALID_SYNTAX',rawComparison,
  newEquivalenceRules:1,sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false};
}

import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {proveClosedFiniteProgramEquivalence as previous} from './finite-program-equivalence.private-counters.mjs';
import {verifyPrivateCounterReferences} from './private-counter-reference-guard.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function proveClosedFiniteProgramEquivalence(before,after,options={}){
 const proof=await previous(before,after,options);
 const guards={before:verifyPrivateCounterReferences(before,proof.privateCounterStage.before),after:verifyPrivateCounterReferences(after,proof.privateCounterStage.after)};
 const implementations=[...proof.implementations];
 for(const name of ['private-counter-reference-guard.mjs','finite-program-equivalence.private-counters.guarded.mjs']){
  const url=new URL(name,import.meta.url);implementations.push({path:url.href,sha256:sha(await readFile(url))});
 }
 return {...proof,kind:'GUARDED_BOUND_PRIVATE_COUNTER_COMPLETE_PROGRAM_EQUIVALENCE',privateCounterReferenceGuards:guards,implementations};
}

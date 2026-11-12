// Only a live declaration transaction may transport initializer provenance.
// A JSON report copied from disk cannot authorize the same operation.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {reconcileAuthoredStructureIdentifiers as reconcile} from './authored-structure-identifiers.mjs';
const issued=new WeakMap(),sha=s=>createHash('sha256').update(s).digest('hex');
export function reconcileAuthoredStructureIdentifiers(args){
 const result=reconcile(args);
 issued.set(result.proof,{before:sha(args.xml),after:sha(result.xml),proof:sha(JSON.stringify(result.proof))});
 return result;
}
export function requireIssuedStructureIdentity(proof,beforeXml,afterXml){
 const pin=issued.get(proof);assert(pin,'UNISSUED_STRUCTURE_IDENTITY_TRANSACTION');
 assert.equal(pin.before,sha(beforeXml),'STRUCTURE_IDENTITY_ORIGINAL_XML_CHANGED');
 assert.equal(pin.after,sha(afterXml),'STRUCTURE_IDENTITY_RESULT_XML_CHANGED');
 assert.equal(pin.proof,sha(JSON.stringify(proof)),'STRUCTURE_IDENTITY_QUALIFICATION_CHANGED');
 return proof.records;
}

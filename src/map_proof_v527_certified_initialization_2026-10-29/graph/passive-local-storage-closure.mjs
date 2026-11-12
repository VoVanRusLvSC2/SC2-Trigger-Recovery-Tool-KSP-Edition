import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalLocalInitializerSequence as initialize} from './local-initializer-sequence.shared-passive-storage.mjs';
import {canonicalIndependentLocalDeclarations as rank} from './local-declaration-order.passive-storage.mjs';
import {canonicalExpressionGrouping as group} from './expression-grouping-proof.typedef-terminators.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');

// Finish the already-proved storage rules after later passes have resolved
// their prerequisites. This composes complete views, never matching functions
// borrowed from different program comparisons.
export function canonicalPassiveLocalStorageClosure(source){
  const first=initialize(source),second=rank(first.text),changed=!!(first.proof.edits.length||second.proof.edits.length);
  assert(first.proof.edits.every(e=>e.intrinsicStorageOnly&&e.initializerEvaluationOrderPreserved));
  assert(second.proof.declarationContentsAndExecutableStatementOrderUnchanged);
  const final=changed?group(second.text):{text:source,proof:null};
  if(final.proof)assert(final.proof.completeParsedStructureUnchanged);
  return {text:final.text,proof:{kind:'PASSIVE_STORAGE_AFTER_BOUND_CONTEXT_CLOSURE',
    sourceSha256:sha(source),proofInputSha256:sha(final.text),changed,
    stages:[first.proof,second.proof,...final.proof?[final.proof]:[]],
    sourceOrExportChanged:false,wholeProgramComparisonStillRequired:true,
    partialFunctionMatchesNotCombined:true,persistentCache:false,wholeMapAccepted:false}};
}

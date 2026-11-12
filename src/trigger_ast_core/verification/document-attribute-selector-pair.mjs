import assert from 'node:assert/strict';
import {qualifyDocumentAttributeView} from './document-attribute-selector-view.mjs';

// The Editor may retain a short selector while the SDK emits its qualified
// spelling. Both sides must use the same independently verified document model.
// Foreign owners, shadowed APIs and arbitrary strings keep their existing refusals.
export async function qualifyDocumentAttributePair(before,after,options){
  const left=await qualifyDocumentAttributeView(before,options);
  const right=await qualifyDocumentAttributeView(after,options);
  assert.deepEqual(left.proof.context,right.proof.context,'ATTRIBUTE_PAIR_CONTEXT_MISMATCH');
  assert.equal(left.proof.nativeXmlSha256,right.proof.nativeXmlSha256);
  return {before:left,after:right,proof:{kind:'SYMMETRIC_VERIFIED_DOCUMENT_ATTRIBUTE_SELECTORS',
    before:left.proof,after:right.proof,bothNativeApiBindingsChecked:true,
    sameVerifiedDocumentModel:true,foreignOwnersNotMerged:true,sourceOrExportChanged:false,
    fullOriginalLobbyProved:false,wholeMapAccepted:false}};
}

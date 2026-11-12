import {createHash} from 'node:crypto';

const hash=/^[a-f\d]{64}$/u;
const key=(name,digest)=>name.replaceAll('\\','/').toLowerCase()+'\0'+digest;

/** Consume the result of the archive-owned composition proof in this operation.
 * The original-byte view qualifies only with the exact include-only transform
 * and an explicit complete-body witness. Opposite sides never share identity.
 * This is not a composition proof or an equivalence verdict on its own.
 */
export function createComposedSourceIdentity(proof) {
  const represented={before:new Map(),after:new Map()},observed=[];
  const removed=new Set((proof.removedDuplicateDeclarationViews??[])
    .filter(r=>r.completeNonredundantBodyNowInRoot===true&&typeof r.fileName==='string'&&hash.test(r.sha256))
    .map(r=>key(r.fileName,r.sha256)));
  for(const side of ['before','after'])for(const file of proof[side]?.files??[]) {
    if(typeof file.fileName!=='string'||!hash.test(file.sha256))continue;
    represented[side].set(key(file.fileName,file.sha256),{fileName:file.fileName,representation:'COMPOSED_BYTES'});
    if(file.sourceTransform==='ONLY_RESOLVED_ALREADY_ENTERED_INCLUDE_DIRECTIVES'&&
      hash.test(file.originalSha256)&&removed.has(key(file.fileName,file.originalSha256))) {
      represented[side].set(key(file.fileName,file.originalSha256),
        {fileName:file.fileName,representation:'ORIGINAL_BYTES_WITH_COMPLETE_BODY_WITNESS',originalSha256:file.originalSha256,composedSha256:file.sha256});
    }
  }
  return Object.freeze({
    contains(side,file) {
      if(!['before','after'].includes(side)||typeof file?.fileName!=='string'||typeof file.text!=='string')return false;
      const actual=createHash('sha256').update(file.text).digest('hex'),record=represented[side].get(key(file.fileName,actual));
      if(!record)return false;
      observed.push({side,...record,checkedSha256:actual});return true;
    },
    evidence:()=>({kind:'SIDE_BOUND_COMPOSED_SOURCE_IDENTITIES',observed:[...observed],
      originalBytesRequireCompleteBodyWitness:true,externalUnrepresentedFilesRetained:true,wholeProgramEquivalent:false}),
  });
}

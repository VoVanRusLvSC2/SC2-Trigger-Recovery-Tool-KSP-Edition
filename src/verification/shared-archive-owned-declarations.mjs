import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {logicalSourcePath} from "../model/source-ownership.mjs";

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const name=file=>logicalSourcePath(file.originalPath??file.fileName);

// An owned file reached through a dependency need not be moved into the root
// if both actual archives and the shared declaration input contain its exact
// body. Nothing is discarded or replaced with a prototype. All other missing
// composition coverage remains an error.
export async function proveSharedArchiveOwnedDeclarations({bindings,composed,declarations,readOwned}){
 assert.equal(bindings.sides.length,2,'SHARED_OWNED_TWO_SIDES_REQUIRED');
 const expected=bindings.sides.map(s=>new Set(s.ownedTargets));
 const actual=composed.map(s=>new Set(s.files.map(name)));
 for(let i=0;i<2;i++)for(const path of actual[i])assert(expected[i].has(path),'ARCHIVE_COMPOSITION_OWNED_TARGET_CHANGED');
 const missing=expected.map((paths,i)=>new Set([...paths].filter(p=>!actual[i].has(p))));
 assert.deepEqual([...missing[0]].sort(),[...missing[1]].sort(),'SHARED_OWNED_REACHABILITY_CHANGED');
 const records=[];
 for(const path of missing[0]){
  const bodies=await Promise.all([0,1].map(i=>readOwned(i,path)));
  assert(Buffer.isBuffer(bodies[0])&&Buffer.isBuffer(bodies[1]),'SHARED_OWNED_ARCHIVE_BYTES_REQUIRED');
  assert(bodies[0].equals(bodies[1]),'SHARED_OWNED_ARCHIVE_BODY_CHANGED');
  const digest=sha(bodies[0]),targets=declarations.filter(f=>name(f)===path);
  assert(targets.length,'SHARED_OWNED_DECLARATION_MISSING:'+path);
  for(const target of targets){assert.equal(sha(Buffer.from(target.text)),digest,'SHARED_OWNED_DECLARATION_BODY_CHANGED');if(target.sha256!==undefined)assert.equal(target.sha256,digest,'SHARED_OWNED_DECLARATION_PIN_CHANGED');}
  for(const side of bindings.sides){const edges=side.records.filter(r=>r.owned&&r.path===path);assert(edges.length,'SHARED_OWNED_EXPLICIT_EDGE_REQUIRED');assert(edges.every(e=>e.sha256===digest&&e.layerId===bindings.archiveLayerId),'SHARED_OWNED_LAYER_OR_BODY_CHANGED');}
  records.push({fileName:path,sha256:digest,bytes:bodies[0].length,retainedAsCompleteSharedDeclaration:true,sourceAndCandidateBytesEqual:true});
 }
 return {kind:'EXACT_SHARED_ARCHIVE_OWNED_DECLARATION_COVERAGE',records,allOwnedTargetsCovered:true,bodyComparisonOmitted:false,wholeProgramEquivalenceProved:false};
}

import assert from 'node:assert/strict';
// A host-scoped metadata completion, never a guess of a missing published mod.
// Only exact standard references already emitted by the direct parent's prefix
// may be inherited. The complete deduplicated host layer order must stay equal.
export function planInheritedStandardBases({root,nodes,isStandard}){
 const byId=new Map(nodes.map(n=>[n.id,n]));assert.equal(byId.size,nodes.length,'DEPENDENCY_NODE_AMBIGUOUS');
 assert(byId.has(root)&&typeof isStandard==='function');const additions=new Map(),active=new Set(),seen=new Set(),emitted=new Set(),before=[];
 function walk(id,prefix=[]){
  assert(!active.has(id),'DEPENDENCY_CYCLE');if(seen.has(id))return;const n=byId.get(id);assert(n,'DEPENDENCY_NODE_MISSING');
  active.add(id);
  if(n.metadataGap===true&&n.dependencies.length===0){
   const inherited=[...new Set(prefix.filter(isStandard))];assert(inherited.every(r=>emitted.has(r)),'INHERITED_BASE_NOT_DOMINATING');
   if(inherited.length)additions.set(id,inherited);
  }
  const passed=[];for(const edge of n.dependencies){
   if(isStandard(edge.reference)){if(!emitted.has(edge.reference)){emitted.add(edge.reference);before.push(['standard',edge.reference]);}}
   else{assert(edge.child,'CUSTOM_DEPENDENCY_UNRESOLVED');walk(edge.child,passed);}
   passed.push(edge.reference);
  }
  active.delete(id);seen.add(id);before.push(['node',id]);
 }
 walk(root);const after=[],seenAfter=new Set(),activeAfter=new Set();
 function check(id){assert(!activeAfter.has(id),'COMPLETED_DEPENDENCY_CYCLE');const key='node:'+id;if(seenAfter.has(key))return;activeAfter.add(id);
  const n=byId.get(id),dependencies=[...(additions.get(id)??[]).map(reference=>({reference})),...n.dependencies];
  for(const edge of dependencies){if(isStandard(edge.reference)){const k='standard:'+edge.reference;if(!seenAfter.has(k)){seenAfter.add(k);after.push(['standard',edge.reference]);}}else check(edge.child);}
  activeAfter.delete(id);seenAfter.add(key);after.push(['node',id]);
 }
 check(root);assert.deepEqual(after,before,'INHERITED_BASE_CHANGED_EFFECTIVE_HOST_ORDER');
 return{kind:'DOMINATING_PARENT_STANDARD_BASE_COMPLETION',root,additions:[...additions].map(([node,references])=>({node,references})),beforeOrder:before,afterOrder:after,
  newStandardReferences:0,effectiveHostLayerOrderChanged:false,scope:'This exact pinned host dependency graph; standalone/source published dependency metadata is not claimed recovered.',nativeVerified:false,wholeMapAccepted:false};
}

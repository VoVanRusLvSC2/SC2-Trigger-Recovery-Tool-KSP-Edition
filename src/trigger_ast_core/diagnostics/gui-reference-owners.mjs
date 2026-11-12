const identity=(ref,library)=>JSON.stringify([ref.library??library,ref.type,ref.id]);
const brief=e=>({library:e.library,type:e.type,id:e.id,name:e.identifier??e.name,flags:e.flags,scriptSample:e.scriptCode?.slice(0,160)});
/** A bounded reverse-reference graph for refusal diagnostics only. It cannot
 * change bindings, delete nodes or authorize code. Qualified identities keep
 * same-ID elements from other libraries/types distinct. */
export function inspectGuiReferenceOwners(elements,library,seeds,rootRefs=[],{maxNodes=64,maxDepth=10}={}){
 const values=[...new Set(Object.values(elements))],index=new Map(),incoming=new Map();
 for(const e of values){const key=identity(e,library),list=index.get(key)??[];list.push(e);index.set(key,list);}
 function refs(value,owner,field){
  if(Array.isArray(value)){value.forEach((v,i)=>refs(v,owner,`${field}[${i}]`));return;}
  if(!value||typeof value!=='object')return;
  if(value.type&&value.id){const key=identity(value,library),rows=incoming.get(key)??[];rows.push({owner,field});incoming.set(key,rows);return;}
  for(const [k,v]of Object.entries(value))refs(v,owner,field+'.'+k);
 }
 for(const e of values)for(const [field,value]of Object.entries(e))refs(value,identity(e,library),field);
 const roots=new Set(rootRefs.map(r=>identity(r,library)));
 return seeds.map(seed=>{
  const initial=identity(seed,library),queue=[{key:initial,depth:0}],seen=new Set(),nodes=[],edges=[];
  while(queue.length&&nodes.length<maxNodes){
   const {key,depth}=queue.shift();if(seen.has(key))continue;seen.add(key);
   const found=index.get(key)??[],owners=incoming.get(key)??[];
   nodes.push({identity:JSON.parse(key),elements:found.map(brief),ambiguous:found.length>1,explicitRoot:roots.has(key),incomingCount:owners.length,depth});
   if(depth>=maxDepth)continue;
   for(const owner of owners){edges.push({from:JSON.parse(owner.owner),field:owner.field,to:JSON.parse(key)});if(!seen.has(owner.owner))queue.push({key:owner.owner,depth:depth+1});}
  }
  return{seed,rootReachable:nodes.some(n=>n.explicitRoot),nodes,edges,truncated:queue.length>0,limit:{maxNodes,maxDepth},bindingOrAcceptanceChanged:false};
 });
}

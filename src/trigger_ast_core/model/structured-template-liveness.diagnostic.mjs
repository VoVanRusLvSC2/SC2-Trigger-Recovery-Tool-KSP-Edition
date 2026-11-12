import {AsyncLocalStorage} from 'node:async_hooks';
const scope=new AsyncLocalStorage();
export function withGeneratedStructuredTemplateScope(operation){
 const frame={active:true,generated:new WeakSet()};
 try{const result=scope.run(frame,operation);
  if(result?.then)return Promise.resolve(result).finally(()=>{frame.active=false;});
  frame.active=false;return result;
 }catch(error){frame.active=false;throw error;}
}
export function markGeneratedStructuredTemplate(definition){const frame=scope.getStore();if(frame?.active)frame.generated.add(definition);}
const identity=(library,type,id)=>JSON.stringify([library,type,id]);

// Failed speculative matching may leave a new inline template in the graph.
// Existing/authored definitions and runtime function bodies are never candidates.
export function pruneUnusedGeneratedStructuredTemplates(elements,library,rootRefs=[]){
 const frame=scope.getStore();if(!frame?.active)return {kind:'UNUSED_NEW_INLINE_TEMPLATE_RETIREMENT',removed:[],retiredFormals:[],categoryEdgesRemoved:0,
  authoredDefinitionsRemoved:0,nativeDefinitionsRemoved:0,runtimeBodiesRemoved:0,scriptEquivalenceProved:false,notApplied:'NO_ACTIVE_GENERATION_SCOPE'};
 const generated=frame.generated;
 const aliases=new Map();for(const [name,e]of Object.entries(elements)){const keys=aliases.get(e)??[];keys.push(name);aliases.set(e,keys);}
 const values=[...aliases.keys()],uses=new Set(),roots=new Set(rootRefs.map(r=>identity(r.library??library,r.type,r.id)));
 function refs(value,output){
  if(Array.isArray(value)){for(const child of value)refs(child,output);return;}
  if(!value||typeof value!=='object')return;
  if(value.type&&value.id){output.add(identity(value.library??library,value.type,value.id));return;}
  for(const child of Object.values(value))refs(child,output);
 }
 for(const e of values)for(const [field,value]of Object.entries(e)){
  if(e.type==='Category'&&field==='items')continue;
  refs(value,uses);
 }
 const removed=[],formals=[];
 for(const e of values){
  const key=identity(e.library??library,e.type,e.id);
  if(e.type!=='FunctionDef'||e.library!==library||!generated.has(e)||!e.flags?.includes('Operator')||
   e.flags.includes('Native')||e.actions?.length||e.localVariables?.length||uses.has(key)||roots.has(key))continue;
  removed.push({library,type:e.type,id:e.id});formals.push(...(e.parameters??[]),...(e.subFunctionTypes??[]));
  for(const alias of aliases.get(e))delete elements[alias];
 }
 const deleted=new Set(removed.map(r=>identity(r.library,r.type,r.id)));
 let categoryEdgesRemoved=0;
 for(const e of new Set(Object.values(elements)))if(e.type==='Category'&&e.items){
  const prior=e.items;e.items=prior.filter(r=>!deleted.has(identity(r.library??library,r.type,r.id)));categoryEdgesRemoved+=prior.length-e.items.length;
 }
 // A formal may be shared or explicitly rooted. Retire it only after checking
 // the remaining graph, using typed references rather than ID text matches.
 const remaining=new Set(roots);
 for(const e of new Set(Object.values(elements)))for(const value of Object.values(e))refs(value,remaining);
 const retiredFormals=[];
 for(const ref of formals){
  const key=identity(ref.library??library,ref.type,ref.id);
  if((ref.library??library)!==library||!['ParamDef','SubFuncType'].includes(ref.type)||remaining.has(key))continue;
  const candidates=[...new Set([elements[ref.id],elements[ref.type+':'+ref.id]].filter(Boolean))];
  if(candidates.length!==1)continue;const e=candidates[0];
  if(e.type!==ref.type||e.library!==library||e.id!==ref.id)continue;
  for(const alias of aliases.get(e)??[])delete elements[alias];retiredFormals.push({library,type:e.type,id:e.id});
 }
 const liveElements=[...new Set(Object.values(elements))];
 const nodeKey=e=>identity(e.library??library,e.type,e.id);
 const byKey=new Map(liveElements.map(e=>[nodeKey(e),e])),edges=new Map(),incoming=new Map();
 for(const e of liveElements){
  const from=nodeKey(e),targets=new Set();
  for(const [field,value] of Object.entries(e)){if(['id','type','library'].includes(field))continue;refs(value,targets);}
  edges.set(from,targets);
  for(const to of targets){const list=incoming.get(to)??[];list.push(from);incoming.set(to,list);}
 }
 const reached=new Set(),queue=[...roots];
 for(let i=0;i<queue.length;i++){const next=queue[i];if(reached.has(next))continue;reached.add(next);for(const edge of edges.get(next)??[])queue.push(edge);}
 const retainedGenerated=liveElements.filter(e=>e.type==='FunctionDef'&&generated.has(e)&&!e.flags?.includes('Native')).map(e=>({
  definition:{library:e.library??library,type:e.type,id:e.id},scriptCode:e.scriptCode,rootReachable:reached.has(nodeKey(e)),
  incoming:(incoming.get(nodeKey(e))??[]).map(k=>({identity:JSON.parse(k),rootReachable:reached.has(k),element:byKey.get(k)}))
 }));
 const reachabilityDiagnosis={rootCount:roots.size,reachableCount:reached.size,retainedGenerated,mutationsApplied:false};
 return {kind:'UNUSED_NEW_INLINE_TEMPLATE_RETIREMENT',removed,retiredFormals,categoryEdgesRemoved,reachabilityDiagnosis,
  authoredDefinitionsRemoved:0,nativeDefinitionsRemoved:0,runtimeBodiesRemoved:0,scriptEquivalenceProved:false};
}

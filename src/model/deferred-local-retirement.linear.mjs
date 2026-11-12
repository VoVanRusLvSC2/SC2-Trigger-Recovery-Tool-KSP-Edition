// Two-phase removal: matchers may unbind a compiler local, but only the final
// pruned GUI graph can prove that no committed parameter still references it.
const pendingKey=Symbol('conversion-local-retirement');
const same=(ref,library,id)=>ref?.type==='Variable'&&(ref.library??library)===library&&ref.id===id;
export function deferLocalRetirement(id,ctx) {
 const variable=ctx.elements[id],locals=ctx.structuredLocals;
 if(variable?.type!=='Variable'||(variable.library??ctx.libId)!==ctx.libId)throw Error('Retired local has no exact owned Variable');
 const index=locals?.findIndex(ref=>same(ref,ctx.libId,id))??-1;
 if(index<0)throw Error('Retired local has no exact lexical ownership');
 if(!ctx.elements[pendingKey])Object.defineProperty(ctx.elements,pendingKey,{value:new Map(),configurable:true});
 const pending=ctx.elements[pendingKey];
 if(!pending.has(id))pending.set(id,{id,library:ctx.libId,variable,locals,index,ref:locals[index]});
}
export function finalizeLocalRetirements(elements,library) {
 const pending=elements[pendingKey];if(!pending)return {removed:[],retained:[]};
 const used=new Set(),all=Object.values(elements),owners=new Map();
 for(const owner of all)if(Array.isArray(owner.localVariables)&&!owners.has(owner.localVariables))
  owners.set(owner.localVariables,new Set(owner.localVariables.filter(ref=>ref.type==='Variable'&&(ref.library??library)===library).map(ref=>ref.id)));
 for(const element of all){
  const work=Object.entries(element).filter(([field])=>!['type','id','library','localVariables'].includes(field)).map(([,value])=>value),seen=new Set();
  while(work.length){
   const value=work.pop();if(!value||typeof value!=='object'||seen.has(value))continue;seen.add(value);
   if(Array.isArray(value)){work.push(...value);continue;}
   if(value.type==='Variable'&&(value.library??library)===library&&pending.has(value.id))used.add(value.id);
   work.push(...Object.values(value));
  }
 }
 const removed=[],retained=[];
 for(const item of pending.values()){
  if(item.library!==library||elements[item.id]!==item.variable)throw Error('Deferred local identity changed before final graph');
  if(used.has(item.id)){
   if(!owners.has(item.locals))throw Error('Retained local lost its lexical owner');
   if(!owners.get(item.locals).has(item.id)){item.locals.splice(Math.min(item.index,item.locals.length),0,item.ref);owners.get(item.locals).add(item.id);}
   retained.push(item.id);
  }else{
   delete elements[item.id];
   removed.push(item.id);
  }
 }
 const dropped=new Set(removed);
 for(const locals of owners.keys())for(let i=locals.length-1;i>=0;i--){const ref=locals[i];if(ref.type==='Variable'&&(ref.library??library)===library&&dropped.has(ref.id))locals.splice(i,1);}
 delete elements[pendingKey];return {removed,retained};
}

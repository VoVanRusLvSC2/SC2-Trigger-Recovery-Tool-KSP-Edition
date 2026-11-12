// Keep symbol bindings available until every action in this statement list has
// been converted. A nested list cannot delete symbols used by a sibling list.
export function deferredScaffoldingCleanup(nodes,ctx,scoped,symbolIndex){
 const pending=new Map();
 return {stage(names){for(const name of names){const id=scoped.localVarByGalaxyName.get(name);if(id)pending.set(name,id);}},finish(){
  const whole=symbolIndex(ctx.structuredFunctionStatements??nodes),local=symbolIndex(nodes);
  for(const[name,id]of pending){
   if(whole.uses.get(name)!==local.uses.get(name)||ctx.localVarByGalaxyName.get(name)!==id)continue;
   scoped.localVarByGalaxyName.delete(name);ctx.localVarByGalaxyName.delete(name);
   const at=ctx.structuredLocals?.findIndex(r=>r.id===id&&(r.library??ctx.libId)===ctx.libId)??-1;
   if(at>=0)ctx.structuredLocals.splice(at,1);
   delete ctx.elements[id];
  }
 }};
}

/** Determine event positions from typed incoming edges, never a child's own
 * role tag alone. A shared call must be valid at every incoming position.
 * This validates GUI structure; it is not a native ABI certificate. */
export function collectGuiEventContexts(libraries,catalog){
 const key=(ref,owner)=>JSON.stringify([ref.library??owner,ref.type,ref.id]);
 const eventSites=new Set(),ordinarySites=new Set(),issues=[];
 const add=(ref,owner,event)=>{
  const call=catalog.resolve(ref,owner,'FunctionCall');
  if(!call){issues.push({library:owner,ref,reason:'GUI_CALL_EDGE_UNRESOLVED'});return;}
  const callKey=key(ref,owner);
  (event?eventSites:ordinarySites).add(callKey);
  if(event){
   const definition=catalog.resolve(call.functionDef,ref.library??owner,'FunctionDef');
   if(definition&&!definition.flags?.includes('Event'))issues.push({library:owner,id:call.id,definition:call.functionDef,reason:'GUI_EVENT_ROLE_REQUIRED'});
  }
 };
 for(const [owner,lib]of libraries)for(const e of Object.values(lib.elements??{})){
  if(e.type==='Trigger'){
   for(const r of e.events??[])add(r,owner,true);
   for(const r of [...e.actions??[],...e.conditions??[]])add(r,owner,false);
  }else if(e.type==='FunctionDef'){
   for(const r of e.actions??[])add(r,owner,false);
  }else if(e.type==='Param'&&e.functionCall){
   add(e.functionCall,owner,false);
  }else if(e.type==='FunctionCall'){
   const definition=catalog.resolve(e.functionDef,owner,'FunctionDef');
   const definitionOwner=definition?.library??e.functionDef?.library??owner;
   const declared=new Set((definition?.subFunctionTypes??[]).map(r=>key(r,definitionOwner)));
   for(const r of e.subFunctions??[]){
    const child=catalog.resolve(r,owner,'FunctionCall'),childOwner=r.library??owner;
    const role=child?.subFunctionType;
    const isEvent=role&&catalog.resolve(role,childOwner,'SubFuncType')?.isEvent;
    const authorized=!!isEvent&&declared.has(key(role,childOwner));
    if(isEvent&&!authorized)issues.push({library:owner,id:child.id,parent:e.id,role,reason:'EVENT_SUBFUNCTION_ROLE_NOT_DECLARED'});
    add(r,owner,authorized);
   }
  }
 }
 return {issues,eventSites,ordinarySites,isEventSite(ref,owner){const k=key(ref,owner);return eventSites.has(k)&&!ordinarySites.has(k);}};
}

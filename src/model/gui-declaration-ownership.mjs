const identity=(ref,owner)=>JSON.stringify([ref.library??owner,ref.type,ref.id]);
const declarations=new Set(['Variable','ParamDef','Structure','FunctionDef','Trigger']);

/** Linear, qualified declaration ownership evidence. Category membership is
 * visibility; it is never a lexical function/structure scope. Names do not bind
 * anything. These facts alone cannot authorize a source/GUI interface. */
export function indexGuiDeclarationOwnership({elements,library,rootRefs=[]}){
 const values=[...new Set(Object.values(elements))],by=new Map(),incoming=new Map(),issues=[];
 for(const e of values){const key=identity(e,library),rows=by.get(key)??[];rows.push(e);by.set(key,rows);}
 for(const [key,rows]of by)if(rows.length!==1)issues.push({code:'DUPLICATE_QUALIFIED_DECLARATION',identity:key});
 const add=(owner,field,refs,role,expected)=>{
  const local=new Set();
  for(const [position,ref]of (refs??[]).entries()){
   const ownerLibrary=owner?.library??library,key=identity(ref,ownerLibrary),ownerKey=owner?identity(owner,library):null;
   if(local.has(key))issues.push({code:'DUPLICATE_DECLARATION_OWNER_EDGE',owner:ownerKey,field,identity:key});local.add(key);
   if(expected&&ref.type!==expected)issues.push({code:'WRONG_DECLARATION_OWNER_REFERENCE_TYPE',owner:ownerKey,field,identity:key,expected});
   if(by.get(key)?.length!==1)issues.push({code:'UNRESOLVED_OR_AMBIGUOUS_OWNER_EDGE',owner:ownerKey,field,identity:key});
   const edges=incoming.get(key)??[];edges.push({owner:ownerKey,field,position,role});incoming.set(key,edges);
  }
 };
 add(null,'rootRefs',rootRefs,'ROOT');
 for(const e of values){
  if(e.type==='Category')add(e,'items',e.items,'CATEGORY');
  if(e.type==='Structure')add(e,'variables',e.variables,'MEMBER','Variable');
  if(['FunctionDef','Trigger'].includes(e.type))add(e,'localVariables',e.localVariables,'LOCAL','Variable');
  if(e.type==='FunctionDef')add(e,'parameters',e.parameters,'PARAMETER','ParamDef');
 }
 const reachable=new Set(),queue=rootRefs.map(r=>identity(r,library));
 for(let i=0;i<queue.length;i++){
  const key=queue[i];if(reachable.has(key))continue;
  const rows=by.get(key);if(rows?.length!==1||rows[0].disabled)continue;
  reachable.add(key);const e=rows[0];
  if(e.type==='Category')for(const ref of e.items??[])queue.push(identity(ref,e.library??library));
 }
 // Kahn's pass also rejects disconnected cyclic folder graphs. A detached
 // declaration cannot acquire a safe global identity through a folder cycle.
 const categories=new Map(values.filter(e=>e.type==='Category').map(e=>[identity(e,library),e])),degrees=new Map([...categories.keys()].map(k=>[k,0]));
 for(const e of categories.values())for(const ref of e.items??[]){const key=identity(ref,e.library??library);if(categories.has(key))degrees.set(key,degrees.get(key)+1);}
 const ready=[...degrees].filter(([,n])=>n===0).map(([k])=>k);let removed=0;
 for(let i=0;i<ready.length;i++){const e=categories.get(ready[i]);removed++;for(const ref of e.items??[]){const key=identity(ref,e.library??library);if(degrees.has(key)){const n=degrees.get(key)-1;degrees.set(key,n);if(!n)ready.push(key);}}}
 if(removed!==categories.size)issues.push({code:'CYCLIC_CATEGORY_OWNERSHIP',identities:[...degrees].filter(([,n])=>n>0).map(([k])=>k)});
 const records=[];
 for(const [key,rows]of by){
  const e=rows[0];if(!declarations.has(e.type))continue;
  const edges=incoming.get(key)??[],lexical=edges.filter(r=>['LOCAL','MEMBER','PARAMETER'].includes(r.role));
  let scope='UNROOTED';
  if(rows.length!==1||lexical.length>1||lexical.length&&reachable.has(key))scope='AMBIGUOUS';
  else if(lexical.length)scope=lexical[0].role;
  else if(reachable.has(key))scope=e.type==='Variable'?'GLOBAL':'TREE_DECLARATION';
  if(scope==='AMBIGUOUS')issues.push({code:'AMBIGUOUS_DECLARATION_SCOPE',identity:key});
  records.push({identity:JSON.parse(key),scope,treeReachable:reachable.has(key),disabled:!!e.disabled,owners:edges,
   ...(lexical.length===1?{lexicalOwner:JSON.parse(lexical[0].owner),lexicalOwnerTreeReachable:reachable.has(lexical[0].owner)}:{})});
 }
 return {kind:'QUALIFIED_GUI_DECLARATION_OWNERSHIP',records,issues,complete:!issues.length,
  complexity:'O(elements + ownership references)',nameMatchingUsed:false,sourceChanged:false,guiEmissionAuthorized:false};
}

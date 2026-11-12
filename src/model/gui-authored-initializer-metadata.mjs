import assert from 'node:assert/strict';
const identity=(r,owner)=>JSON.stringify([r.library??owner,r.type,r.id]);
const identifier=s=>typeof s==='string'&&/^[_A-Za-z]\w*$/u.test(s);

// A whole qualified GUI phase, never a per-element name allowlist. The caller
// must recompute source schedules from sealed originals before using this fact.
// Empty InitFunc metadata is not a new executable source body or a Native.
export function verifyGuiAuthoredInitializerMetadata({elements,library,rootRefs,schedule}){
 assert(schedule?.status==='EXACT_SOURCE_CALL_SCHEDULE'&&schedule.library===library,'AUTHORED_METADATA_EXACT_SOURCE_PHASE_REQUIRED');
 assert(schedule.calls.every((c,i)=>c.ordinal===i&&identifier(c.name)&&c.library===library),'AUTHORED_METADATA_SOURCE_CALLS_INVALID');
 const by=new Map(),incoming=new Map();
 for(const e of new Set(Object.values(elements))){
  assert(typeof e.type==='string'&&typeof e.id==='string'&&e.id,'AUTHORED_METADATA_TYPED_IDENTITY_REQUIRED');
  const key=identity(e,library);assert(!by.has(key),'AUTHORED_METADATA_DUPLICATE_QUALIFIED_ID');by.set(key,e);
 }
 const add=(refs,owner)=>{for(const ref of refs??[]){const key=identity(ref,owner);incoming.set(key,(incoming.get(key)??0)+1);}};
 add(rootRefs,library);for(const e of by.values())if(e.type==='Category')add(e.items,e.library??library);
 const visited=new Set(),active=new Set(),ordered=[],stack=[{refs:rootRefs??[],owner:library,index:0}];
 while(stack.length){
  const frame=stack.at(-1);
  if(frame.index===frame.refs.length){if(frame.key)active.delete(frame.key);stack.pop();continue;}
  const ref=frame.refs[frame.index++],key=identity(ref,frame.owner),e=by.get(key);
  assert((ref.library??frame.owner)===library,'AUTHORED_METADATA_FOREIGN_TREE_SCOPE');
  assert(e,'AUTHORED_METADATA_DANGLING_TREE_REFERENCE');
  assert(!active.has(key),'AUTHORED_METADATA_CATEGORY_CYCLE');
  assert(incoming.get(key)===1&&!visited.has(key),'AUTHORED_METADATA_AMBIGUOUS_TREE_OWNER');visited.add(key);
  if(e.disabled)continue;
  if(e.type==='Category'){active.add(key);stack.push({key,refs:e.items??[],owner:e.library??library,index:0});continue;}
  if(e.type!=='CustomScript'||e.initFunc===undefined||e.initFunc==='')continue;
  assert(identifier(e.initFunc),'AUTHORED_METADATA_INITIALIZER_IDENTIFIER');
  assert((e.scriptCode??'')===''&&e.expressionCode===undefined&&!e.flags?.length,'AUTHORED_METADATA_MUST_BE_CODE_FREE');
  ordered.push(e);
 }
 for(const [key,e]of by)if((e.library??library)===library&&e.type==='CustomScript'&&e.initFunc&&!e.disabled)
  assert(visited.has(key),'AUTHORED_METADATA_UNROOTED_INITIALIZER');
 assert.equal(ordered.length,schedule.calls.length,'AUTHORED_METADATA_CALL_MULTIPLICITY');
 const records=ordered.map((e,i)=>{
  const call=schedule.calls[i];assert.equal(e.initFunc,call.name,'AUTHORED_METADATA_CALL_ORDER_OR_TARGET');
  return {type:e.type,id:e.id,library,initFunc:e.initFunc,code:'',kind:'ORIGINAL_INITIALIZER_METADATA',
   ordinal:i,phaseName:schedule.name,phaseSha256:schedule.sha256,callSha256:call.callSha256,targetSha256:call.targetSha256};
 });
 return {kind:'EXACT_GUI_AUTHORED_INITIALIZER_METADATA',library,phaseName:schedule.name,phaseSha256:schedule.sha256,
  records,exactOrder:true,exactMultiplicity:true,newNative:0,newRuntimeFunctions:0,newExecutableSourceBodies:0,
  sourceComponentClosureProved:false,guiEmissionAuthorized:false,wholeMapAccepted:false};
}

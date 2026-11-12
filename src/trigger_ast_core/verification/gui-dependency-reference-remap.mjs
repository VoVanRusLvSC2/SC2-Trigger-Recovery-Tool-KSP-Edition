import assert from 'node:assert/strict';

const bookkeeping=new Set(['parent','xmlSource','rawXml']);
const allowed=new Set(['FunctionDef','ParamDef','Param','FunctionCall','Preset','PresetValue']);
const key=(r,owner)=>JSON.stringify([r.library??owner,r.type,r.id]);
const reference=v=>v&&typeof v==='object'&&!Array.isArray(v)&&v.type&&v.id&&Object.keys(v).every(k=>['type','id','library'].includes(k));
const index=(elements,owner)=>{
 const out=new Map();for(const e of new Set(Object.values(elements))){const k=key(e,owner);assert(!out.has(k),'GUI_REMAP_DUPLICATE_TYPED_ID');out.set(k,e);}return out;
};

/** Independent structural gate for dependency-call reification. It cannot
 * prove source ABI or native export equivalence. It proves that old GUI nodes,
 * argument values, ordering and categories survived; only qualified external
 * references may change to fresh local metadata. No generation code is used. */
export function auditGuiDependencyReferenceRemap({before,after,libraryId}){
 assert(before?.elements&&after?.elements&&libraryId,'GUI_REMAP_INPUT_REQUIRED');
 const old=index(before.elements,libraryId),next=index(after.elements,libraryId),pairs=new Map(),reverse=new Map(),changes=[];
 function compare(a,b,location){
  if(reference(a)&&reference(b)){
   const from=key(a,libraryId),to=key(b,libraryId);if(from===to)return;
   assert(a.type===b.type&&allowed.has(a.type)&&(a.library??libraryId)!==libraryId&&(b.library??libraryId)===libraryId,'GUI_REMAP_EXTERNAL_TO_LOCAL_ONLY:'+location);
   assert(!old.has(to)&&next.has(to),'GUI_REMAP_FRESH_TYPED_TARGET:'+location);
   assert(!pairs.has(from)||pairs.get(from)===to,'GUI_REMAP_ONE_SOURCE_ONE_TARGET');
   assert(!reverse.has(to)||reverse.get(to)===from,'GUI_REMAP_ONE_TARGET_ONE_SOURCE');
   pairs.set(from,to);reverse.set(to,from);changes.push({location,from:JSON.parse(from),to:JSON.parse(to)});return;
  }
  if(Array.isArray(a)||Array.isArray(b)){
   assert(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length,'GUI_REMAP_ARRAY_SHAPE:'+location);
   for(let i=0;i<a.length;i++)compare(a[i],b[i],location+'['+i+']');return;
  }
  if(a&&b&&typeof a==='object'&&typeof b==='object'){
   const keys=v=>Object.keys(v).filter(k=>!bookkeeping.has(k)&&v[k]!==undefined).sort();
   assert.deepEqual(keys(a),keys(b),'GUI_REMAP_FIELDS_CHANGED:'+location);
   for(const k of keys(a))compare(a[k],b[k],location+'.'+k);return;
  }
  assert.deepEqual(a,b,'GUI_REMAP_VALUE_CHANGED:'+location);
 }
 for(const [k,e]of old){assert(next.has(k),'GUI_REMAP_OLD_ELEMENT_REMOVED:'+k);compare(e,next.get(k),k);}
 const beforeRoots=before.items??before.rootRefs??[],afterRoots=after.items??after.rootRefs??[];
 assert.deepEqual(afterRoots.filter(r=>old.has(key(r,libraryId))).map(r=>key(r,libraryId)),beforeRoots.map(r=>key(r,libraryId)),'GUI_REMAP_ROOT_ORDER_CHANGED');
 const added=[];
 for(const [k,e]of next)if(!old.has(k)){
  assert(allowed.has(e.type),'GUI_REMAP_NEW_RUNTIME_OR_STRUCTURE_ELEMENT:'+e.type);
  if(e.type==='FunctionDef'){
   const flags=new Set(e.flags??[]);
   assert(flags.has('Operator')&&flags.has('NoScriptPrefix')&&[...flags].every(f=>['Operator','NoScriptPrefix','Action','Call'].includes(f)),'GUI_REMAP_INLINE_FLAGS_REQUIRED');
   assert(!e.actions?.length&&!e.localVariables?.length&&!e.expressionCode&&!e.subFunctionTypes?.length,'GUI_REMAP_NO_NEW_BODY');
   assert(typeof e.scriptCode==='string'&&/^\s*[A-Za-z_]\w*\s*\(\s*(?:#PARAM\([A-Za-z_]\w*\)(?:\s*,\s*#PARAM\([A-Za-z_]\w*\))*)?\s*\)\s*;?\s*$/u.test(e.scriptCode),'GUI_REMAP_ONE_DIRECT_CALL_TEMPLATE');
  }
  if(e.type==='Preset')assert(!e.generateConstants&&!e.integer&&!e.generateIdentifier&&!e.asBits,'GUI_REMAP_NO_NEW_RUNTIME_CONSTANTS');
  added.push({library:e.library??libraryId,type:e.type,id:e.id});
 }
 for(const r of afterRoots)if(!old.has(key(r,libraryId)))assert(['FunctionDef','Preset'].includes(r.type)&&next.has(key(r,libraryId)),'GUI_REMAP_NEW_ROOT_METADATA_ONLY');
 return {kind:'INDEPENDENT_GUI_DEPENDENCY_REFERENCE_REMAP',oldElements:old.size,addedElements:added.length,
  oldRootOrderPreserved:true,oldElementPayloadsPreserved:true,categoriesPreserved:true,changes,added,
  newNative:0,newRuntimeBodies:0,newOpaqueCustomScript:0,sourceAbiStillRequired:true,actualNativeExportStillRequired:true,wholeMapAccepted:false};
}

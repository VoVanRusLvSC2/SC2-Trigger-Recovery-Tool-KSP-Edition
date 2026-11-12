import assert from 'node:assert/strict';
import {indexSourceFunctionDeclarations} from '../model/source-function-declarations.mjs';
import {planSourceEntryStartup,readSourceEntryStartup} from '../model/source-entry-startup-plan.mjs';
import {declaredTriggerConstructorFrame} from '../model/declared-trigger-constructor-frame.mjs';
const key=r=>JSON.stringify([r.library,r.type,r.id]);

/** Reorder only existing trigger slots within the same parent. Categories,
 * other items, identities and bodies retain their positions and ownership.
 * An impossible cross-folder schedule fails before mutating any array. */
export function reorderOwnedTriggerSlots({elements,rootRefs,library,orderedTriggers}){
 const index=new Map();
 for(const e of new Set(Object.values(elements))){const k=key({library:e.library??library,type:e.type,id:e.id});
  assert(!index.has(k),'SOURCE_TRIGGER_ORDER_DUPLICATE_IDENTITY');index.set(k,e);}
 const expected=orderedTriggers.map(r=>{assert(r.type==='Trigger'&&(r.library??library)===library,'SOURCE_TRIGGER_ORDER_EXPECTED_OWNER');
  return key({...r,library});});
 assert.equal(new Set(expected).size,expected.length,'SOURCE_TRIGGER_ORDER_DUPLICATE_EXPECTATION');
 const rank=new Map(expected.map((k,i)=>[k,i])),groups=new Map(),seen=new Set(),actual=[];
 const walk=(refs,projected,collect)=>{for(const [ordinal,r]of (projected?.get(refs)??refs).entries()){
  const owner=r.library??library;assert.equal(owner,library,'SOURCE_TRIGGER_ORDER_FOREIGN_TREE_ITEM');
  const k=key({...r,library:owner}),e=index.get(k);assert(e,'SOURCE_TRIGGER_ORDER_DANGLING_TREE_ITEM');
  assert(!seen.has(k),'SOURCE_TRIGGER_ORDER_DUPLICATE_TREE_OWNER');seen.add(k);if(e.disabled)continue;
  if(e.type==='Category')walk(e.items??[],projected,collect);
  if(e.type==='Trigger'){actual.push(k);if(collect){const slots=groups.get(refs)??[];slots.push({ordinal,ref:r,key:k});groups.set(refs,slots);}}
 }};
 walk(rootRefs,undefined,true);
 assert.deepEqual([...actual].sort(),[...expected].sort(),'SOURCE_TRIGGER_ORDER_ACTIVE_SET_CHANGED');
 const before=[...actual],projected=new Map();
 for(const [refs,slots]of groups){const view=[...refs],sorted=[...slots].sort((a,b)=>rank.get(a.key)-rank.get(b.key));
  for(const [i,slot]of slots.entries())view[slot.ordinal]=sorted[i].ref;projected.set(refs,view);}
 seen.clear();actual.length=0;walk(rootRefs,projected,false);
 assert.deepEqual(actual,expected,'SOURCE_TRIGGER_ORDER_FOLDER_CONSTRAINT');
 const moved=before.filter((k,i)=>k!==expected[i]).length;
 for(const [refs,view]of projected)for(let i=0;i<refs.length;i++)refs[i]=view[i];
 return {kind:'WITHIN_PARENT_SOURCE_TRIGGER_INITIALIZATION_ORDER',orderedTriggers,changedPositions:moved,
  parentOwnershipPreserved:true,categoriesAndOtherItemsUnchanged:true,bodyChanges:0,newNative:0,newRuntimeFunctions:0,
  newCustomScript:0,sourceScheduleProved:false,wholeMapAccepted:false};
}

export function alignSourceTriggerInitializationOrder({program,libraryId,elements,rootRefs,triggerByHandleName,automaticConstructors}){
 assert(program&&!program.closed&&libraryId==='Map','SOURCE_TRIGGER_ORDER_BOUND_MAP_REQUIRED');
 const index=indexSourceFunctionDeclarations(program.documents),root=index.get('InitMap')?.body;
 assert(root,'SOURCE_TRIGGER_ORDER_SOURCE_ENTRY_REQUIRED');
 const planned=planSourceEntryStartup({program,fileName:root.fileName,automaticConstructors:[...automaticConstructors]}),
  schedule=readSourceEntryStartup(planned.capability,program);
 const orderedTriggers=schedule.automaticConstructors.map(name=>{
  const frame=declaredTriggerConstructorFrame(index.get(name)?.body?.node);assert(frame,'SOURCE_TRIGGER_ORDER_SOURCE_CONSTRUCTOR_REQUIRED');
  const trigger=triggerByHandleName.get(frame.handle);assert(trigger?.type==='Trigger'&&trigger.library===libraryId&&!trigger.disabled,
   'SOURCE_TRIGGER_ORDER_BOUND_TRIGGER_REQUIRED');
  return {type:'Trigger',library:libraryId,id:trigger.id};
 });
 return {...reorderOwnedTriggerSlots({elements,rootRefs,library:libraryId,orderedTriggers}),sourceScheduleProved:true,
  sourcePhase:schedule.phase,sourceEntry:schedule.entry,automaticConstructors:schedule.automaticConstructors};
}

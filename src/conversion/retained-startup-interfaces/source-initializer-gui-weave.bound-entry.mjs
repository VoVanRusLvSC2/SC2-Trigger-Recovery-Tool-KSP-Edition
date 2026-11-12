import {createRetainedSourceStartupInterface} from "../../bindings/retained-source-startup-interface.mjs";
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {indexSourceFunctionDeclarations} from "../../model/source-function-declarations.mjs";
import {planSourceEntryStartup,readSourceEntryStartup} from "../../model/source-entry-startup-plan.mjs";
import {proveSourceInitializerWeaveLifetimes,readSourceInitializerWeaveLifetimes} from "../../model/source-initializer-weave-lifetimes.mjs";
import {declaredTriggerConstructorFrame} from "../../model/declared-trigger-constructor-frame.mjs";
import {lowerSourceInitializerActionList} from "./source-initializer-action-list.native-action-role.mjs";
import {createStructuredInitializerRegion} from "../../gui/structured-initializer-region.mjs";
import {SyntaxKind as K,Printer} from "../../sdk/array-values/modules/galaxy/language-core/index.js";
const plans=new WeakMap(),macros=new WeakMap(),printer=new Printer(),digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

export function planSourceInitializerGuiWeave({program,statements,libraryId,generatedInitializers,ordinaryRecords=[],constructorRefusals=[],recognize}){
 if(!program||program.closed||libraryId!=='Map'||!generatedInitializers.size)return;
 const index=indexSourceFunctionDeclarations(program.documents),root=index.get('InitMap');if(!root?.body)return;
 const entry=planSourceEntryStartup({program,fileName:root.body.fileName,automaticConstructors:[...generatedInitializers]}),schedule=entry.proof;
 const entryNode=root.body.node,phase=index.get(schedule.phaseName).body.node;
 assert(entryNode.body.statements.every(s=>s.kind!==K.VariableDeclaration),'SOURCE_WEAVE_ENTRY_LOCAL_STORAGE_REQUIRED');
 const match=name=>{const nodes=statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body&&n.name.name===name);assert.equal(nodes.length,1,'SOURCE_WEAVE_PRIMARY_PHASE_REQUIRED');return nodes[0];};
 const inputEntry=match('InitMap'),inputPhase=match(schedule.phaseName);
 assert.equal(printer.printNode(inputEntry),printer.printNode(entryNode),'SOURCE_WEAVE_ENTRY_SOURCE_CHANGED');
 assert.equal(printer.printNode(inputPhase),printer.printNode(phase),'SOURCE_WEAVE_PHASE_SOURCE_CHANGED');
 const automatic=new Set(schedule.automaticConstructors),phaseProjection={...inputPhase,body:{...inputPhase.body,
  statements:inputPhase.body.statements.filter((_,i)=>automatic.has(schedule.allPhaseCalls[i].name))}},
  entryProjection={...inputEntry,body:{...inputEntry.body,statements:inputEntry.body.statements.slice(0,schedule.sourcePhaseAnchor+1)}};
 const view=statements.map(n=>n===inputEntry?entryProjection:n===inputPhase?phaseProjection:n),initialization=recognize(view,{automaticNames:schedule.automaticConstructors});
 assert(initialization?.functions?.has('InitMap')&&initialization.functions.has(schedule.phaseName),'SOURCE_WEAVE_CANONICAL_CORE_NOT_RECOGNIZED');
 assert(!initialization.customInitializerBody,'SOURCE_WEAVE_OPAQUE_INITIALIZER_FORBIDDEN');
 assert(!initialization.droppedDependencyCalls?.length,'SOURCE_WEAVE_DROPPED_DEPENDENCY_FORBIDDEN');
 const life=proveSourceInitializerWeaveLifetimes({program,fileName:index.get(schedule.phaseName).body.fileName,phaseName:schedule.phaseName,automaticNames:schedule.automaticConstructors});
 const ordinary=new Map(ordinaryRecords.map(r=>[r.constructor,r]));
 const targets=schedule.allPhaseCalls.filter(c=>!automatic.has(c.name)).map(c=>({constructor:c.name,source:c.target,
  reason:ordinary.get(c.name)?.reason??'BOUND_ORDINARY_SOURCE_PHASE_CALL',constructorGuiRefusal:ordinary.get(c.name)?.constructorGuiRefusal,
  priorRefusal:constructorRefusals.find(r=>r.constructor===c.name)}));
 const proof={kind:'BOUND_SOURCE_ENTRY_INITIALIZER_GUI_WEAVE',entrySchedule:schedule,sourcePhaseSha256:life.proof.sourcePhaseSha256,
  ordinaryConstructors:targets,canonicalSourcePhases:[...initialization.functions],adapters:[],
  sourceEntrySuffixStatements:schedule.suffix.length,nativeMacroShape:'Event+Operator+SubFunctions/#SUBFUNCS(actions)',
  originalSourceChanged:false,guiEmissionAuthorized:false,wholePhaseAccepted:false,wholeMapAccepted:false};
 const capability=Object.freeze({kind:proof.kind});plans.set(capability,{program,index,entry:entry.capability,life:life.capability,entryNode,proof});
 return {capability,initialization,proof};
}

export function emitSourceInitializerGuiWeave(capability,{program,libraryId,elements,funcNameToFuncDef,triggerByHandleName,allocateId,lowerEntryTail}){
 const state=plans.get(capability);assert(state?.program===program,'SOURCE_WEAVE_UNTRUSTED_PLAN');
 const schedule=readSourceEntryStartup(state.entry,program),lifetime=readSourceInitializerWeaveLifetimes(state.life,program),byType={};
 for(const e of Object.values(elements))(byType[e.type]??={})[e.id]=e;
 const library={id:libraryId,implicit:true,elements,elementsByType:byType},libraries=new Map([[libraryId,library]]),targets=new Map(),pending=[];
 const getTrigger=name=>{const node=state.index.get(name)?.body?.node,frame=declaredTriggerConstructorFrame(node);assert(frame,'SOURCE_WEAVE_PREDECESSOR_FRAME_LOST');
  const trigger=triggerByHandleName.get(frame.handle);assert(trigger?.type==='Trigger'&&!trigger.disabled,'SOURCE_WEAVE_EXISTING_TRIGGER_REQUIRED');return trigger;};
 for(const record of state.proof.ordinaryConstructors){const node=state.index.get(record.constructor)?.body?.node;let def=funcNameToFuncDef.get(record.constructor);
  if(node&&!def){
   let primary=state.entryNode;while(primary.parent)primary=primary.parent;
   const description=createRetainedSourceStartupInterface({program,declaration:node,primaryFileName:primary.fileName,library:libraryId,allocate:()=>allocateId(),
    existingIdentities:new Set(Object.values(elements).map(e=>JSON.stringify([e.library,e.type,e.id])))});
   def=description.definition;assert(!elements[def.id],'SOURCE_WEAVE_SOURCE_INTERFACE_ID_COLLISION');elements[def.id]=def;(byType.FunctionDef??={})[def.id]=def;
   funcNameToFuncDef.set(record.constructor,def);(state.proof.retainedSourceInterfaces??=[]).push(description.proof);
  }
  assert(node&&def?.library===libraryId&&elements[def.id]===def,'SOURCE_WEAVE_TARGET_GUI_BINDING_LOST');targets.set(node,{library:libraryId,type:'FunctionDef',id:def.id});}
 const add=(nodes,trigger,event,record)=>{for(const e of nodes){assert(!elements[e.id],'SOURCE_WEAVE_ID_COLLISION');elements[e.id]=e;(byType[e.type]??={})[e.id]=e;}
  trigger.events??=[];trigger.events.push(event);state.proof.adapters.push(record);pending.push({definition:nodes[0],trigger,nodes});};
 for(const changed of lifetime.changedConstructors){const trigger=getTrigger(changed.name),lowered=lowerSourceInitializerActionList({program,
  fileName:lifetime.fileName,phaseName:lifetime.phaseName,automaticNames:lifetime.automaticNames,automaticName:changed.name,
  library:libraryId,libraries,targetFunctions:targets,allocateId});
  assert(lowered&&lowered.proof.prefixCallsStillRequired===0,'SOURCE_WEAVE_UNREPRESENTED_PREFIX');
  add(lowered.elements,trigger,lowered.event,{...lowered.proof,definitionId:lowered.elements[0].id,triggerId:trigger.id,sourceCaller:changed.directCalls[0]});
 }
 if(schedule.suffix.length){
  assert(typeof lowerEntryTail==='function','SOURCE_WEAVE_ENTRY_TAIL_LOWERER_REQUIRED');
  const tail={...state.entryNode,body:{...state.entryNode.body,statements:state.entryNode.body.statements.slice(schedule.sourcePhaseAnchor+1)}},
   lowered=lowerEntryTail(tail);assert(!lowered.localVariables?.length,'SOURCE_WEAVE_ENTRY_TAIL_LOCAL_STORAGE_REQUIRED');
  const region=createStructuredInitializerRegion({library:libraryId,elements,actions:lowered.actions,allocateId}),
   trigger=getTrigger(schedule.automaticConstructors.at(-1));
  add(region.nodes,trigger,region.event,{...region.proof,sourceSuffix:schedule.suffix,definitionId:region.definition.id,triggerId:trigger.id});
 }
 for(const item of pending){const reachable=new Map(),interfaces=new Set([...targets.values()].map(r=>elements[r.id])),visit=r=>{if(!r||typeof r!=='object')return;
  if(r.library===libraryId&&r.type==='FunctionDef'&&r.id){const fn=elements[r.id];assert(fn?.type==='FunctionDef','SOURCE_WEAVE_FUNCTION_REFERENCE');interfaces.add(fn);return;}
  if(r.library===libraryId&&['FunctionCall','Param','Variable'].includes(r.type)&&r.id){const e=elements[r.id];assert(e?.type===r.type,'SOURCE_WEAVE_REGION_REFERENCE');
   if(reachable.has(e))return;reachable.set(e,digest(e));for(const v of Object.values(e))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(visit):visit(v);return;}
  for(const v of Object.values(r))if(v&&typeof v==='object'){if(Array.isArray(v))v.forEach(visit);else visit(v);}
 };
 for(const e of item.nodes){reachable.set(e,digest(e));for(const v of Object.values(e))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(visit):visit(v);}
 macros.set(item.definition,{capability,libraryId,trigger:item.trigger,events:digest(item.trigger.events),nodes:[...reachable].map(([node,sha256])=>({node,sha256})),
  targets:[...interfaces].map(node=>({reference:{library:libraryId,type:'FunctionDef',id:node.id},node,sha256:digest(node)}))});}
 return state.proof;
}

export function isBoundSourceInitializerMacro(definition,elements,libraryId){
 const record=macros.get(definition);if(!record)return false;assert.equal(record.libraryId,libraryId,'SOURCE_WEAVE_MACRO_OWNER_CHANGED');
 const state=plans.get(record.capability);assert(state,'SOURCE_WEAVE_MACRO_PLAN_LOST');readSourceEntryStartup(state.entry,state.program);readSourceInitializerWeaveLifetimes(state.life,state.program);
 assert.equal(digest(record.trigger.events),record.events,'SOURCE_WEAVE_EVENT_ORDER_CHANGED');
 for(const {node,sha256}of record.nodes)assert(elements[node.id]===node&&digest(node)===sha256,'SOURCE_WEAVE_TYPED_REGION_CHANGED');
 for(const t of record.targets)assert(elements[t.reference.id]===t.node&&digest(t.node)===t.sha256,'SOURCE_WEAVE_SOURCE_TARGET_CHANGED');
 return true;
}

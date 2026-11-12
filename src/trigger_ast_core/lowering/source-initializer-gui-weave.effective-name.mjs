import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SyntaxKind as K,Printer} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {startupFunctionName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {indexSourceFunctionDeclarations} from '../model/source-function-declarations.mjs';
import {declaredTriggerConstructorFrame} from '../model/declared-trigger-constructor-frame.mjs';
import {proveSourceInitializerWeaveLifetimes,readSourceInitializerWeaveLifetimes} from '../model/source-initializer-weave-lifetimes.mjs';
import {lowerSourceInitializerActionList} from './source-initializer-action-list.effective-name.mjs';
const plans=new WeakMap(),macros=new WeakMap(),printer=new Printer();
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const callName=s=>s?.kind===K.ExpressionStatement&&s.expression?.kind===K.CallExpression&&s.expression.expression?.kind===K.Identifier&&s.expression.arguments.length===0?s.expression.expression.name:undefined;

// An experimental recognition view only. Original AST/source are never edited.
// The ordinary targets must already have bound constructor ownership records.
export function planSourceInitializerGuiWeave({program,statements,libraryId,generatedInitializers,ordinaryRecords,recognize}) {
 if(!program||program.closed||!generatedInitializers.size||!ordinaryRecords.length)return;
 const phaseName=startupFunctionName(libraryId,'InitTriggers'),index=indexSourceFunctionDeclarations(program.documents),group=index.get(phaseName);
 if(group?.status!=='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES')return;
 const phase=group.body.node,names=phase.body.statements.map(callName),ordinary=new Map(ordinaryRecords.map(r=>[r.constructor,r]));
 if(!names.some(n=>ordinary.has(n))||!names.some(n=>generatedInitializers.has(n)))return;
 assert(names.every(Boolean),'SOURCE_WEAVE_NONCALL_PHASE_EFFECT');
 assert(names.every(n=>generatedInitializers.has(n)||ordinary.has(n)),'SOURCE_WEAVE_UNPROVED_MANUAL_TARGET');
 const automaticNames=names.filter(n=>generatedInitializers.has(n));
 const input=statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body&&n.name.name===phaseName);
 assert(input.length===1&&printer.printNode(input[0])===printer.printNode(phase),'SOURCE_WEAVE_RECOGNITION_SOURCE_CHANGED');
 const life=proveSourceInitializerWeaveLifetimes({program,fileName:group.body.fileName,phaseName,automaticNames});
 const projected={...input[0],body:{...input[0].body,statements:input[0].body.statements.filter(s=>generatedInitializers.has(callName(s)))}};
 const view=statements.map(n=>n===input[0]?projected:n),initialization=recognize(view);
 assert(initialization?.functions?.has(phaseName),'SOURCE_WEAVE_PROJECTED_PHASE_NOT_CANONICAL');
 for(const role of ['InitLib','InitLibraries'])assert(initialization.functions.has(startupFunctionName(libraryId,role)),'SOURCE_WEAVE_ROOT_OR_LIBRARY_PHASE_NOT_CANONICAL');
 assert(!initialization.customInitializerBody,'SOURCE_WEAVE_OPAQUE_INITIALIZER_FORBIDDEN');
 assert(!(initialization.droppedDependencyCalls?.length),'SOURCE_WEAVE_DROPPED_DEPENDENCY_FORBIDDEN');
 const proof={kind:'EXPERIMENTAL_BOUND_SOURCE_INITIALIZER_GUI_WEAVE',...life.proof,
  recognitionViewOnly:true,ordinaryConstructors:names.filter(n=>ordinary.has(n)).map(n=>ordinary.get(n)),
  canonicalSourcePhases:[...initialization.functions],adapters:[],nativeMacroShape:'Event+Action+SubFunctions/#SUBFUNCS(actions)',
  originalSourceChanged:false,guiEmissionAuthorized:false,wholePhaseAccepted:false,wholeMapAccepted:false};
 const capability=Object.freeze({kind:proof.kind});plans.set(capability,{program,index,life:life.capability,proof});
 return {capability,initialization,proof};
}

export function emitSourceInitializerGuiWeave(capability,{program,libraryId,elements,funcNameToFuncDef,triggerByHandleName,allocateId}) {
 const state=plans.get(capability);assert(state&&state.program===program,'SOURCE_WEAVE_UNTRUSTED_PLAN');
 const lifetime=readSourceInitializerWeaveLifetimes(state.life,program);
 const byType={};for(const e of Object.values(elements))(byType[e.type]??={})[e.id]=e;
 const library={id:libraryId,implicit:true,elements,elementsByType:byType},libraries=new Map([[libraryId,library]]),targets=new Map();
 for(const record of state.proof.ordinaryConstructors){
  const group=state.index.get(record.constructor);assert(group?.body,'SOURCE_WEAVE_TARGET_SOURCE_LOST');
  const def=funcNameToFuncDef.get(record.constructor);
  assert(def?.library===libraryId&&elements[def.id]===def,'SOURCE_WEAVE_TARGET_GUI_BINDING_LOST');
  targets.set(group.body.node,{library:libraryId,type:'FunctionDef',id:def.id});
 }
 for(const changed of lifetime.changedConstructors){
  const node=state.index.get(changed.name)?.body?.node,frame=declaredTriggerConstructorFrame(node);assert(frame,'SOURCE_WEAVE_PREDECESSOR_FRAME_LOST');
  const trigger=triggerByHandleName.get(frame.handle);assert(trigger?.type==='Trigger'&&!trigger.disabled,'SOURCE_WEAVE_EXISTING_PREDECESSOR_TRIGGER_REQUIRED');
  const lowered=lowerSourceInitializerActionList({program,fileName:lifetime.fileName,phaseName:lifetime.phaseName,
   automaticNames:lifetime.automaticNames,automaticName:changed.name,library:libraryId,libraries,targetFunctions:targets,allocateId});
  assert(lowered&&lowered.proof.prefixCallsStillRequired===0,'SOURCE_WEAVE_UNREPRESENTED_PREFIX');
  const definition=lowered.elements[0],role=lowered.elements[1];definition.name=definition.identifier;role.name=role.identifier;
  for(const e of lowered.elements){assert(!elements[e.id],'SOURCE_WEAVE_ID_COLLISION');elements[e.id]=e;(byType[e.type]??={})[e.id]=e;}
  trigger.events??=[];const before=[...trigger.events];trigger.events.push(lowered.event);
  const record={...lowered.proof,definitionId:definition.id,callId:lowered.event.id,subFunctionTypeId:role.id,triggerId:trigger.id,
   sourceCaller:changed.directCalls[0],preexistingEvents:before.map(r=>({...r}))};
  state.proof.adapters.push(record);
  macros.set(definition,{capability,libraryId,trigger,expectedEvents:hash(trigger.events),
   nodes:lowered.elements.map(e=>({node:e,digest:hash(e)})),targets:lowered.proof.targets.map(t=>({ref:t.reference,definition:elements[t.reference.id],digest:hash(elements[t.reference.id])}))});
 }
 return state.proof;
}

// Only this generation's bound, unchanged typed macro is exempt from the raw
// ScriptCode diagnostic. A spelling or serialized receipt cannot mint authority.
export function isBoundSourceInitializerMacro(definition,elements,libraryId) {
 const record=macros.get(definition);if(!record)return false;
 assert(record.libraryId===libraryId,'SOURCE_WEAVE_MACRO_OWNER_CHANGED');
 const state=plans.get(record.capability);assert(state,'SOURCE_WEAVE_MACRO_PLAN_LOST');
 readSourceInitializerWeaveLifetimes(state.life,state.program);
 assert.equal(hash(record.trigger.events),record.expectedEvents,'SOURCE_WEAVE_EVENT_ORDER_CHANGED');
 for(const {node,digest}of record.nodes)assert(elements[node.id]===node&&hash(node)===digest,'SOURCE_WEAVE_TYPED_MACRO_CHANGED');
 for(const {ref,definition:target,digest}of record.targets)assert(elements[ref.id]===target&&hash(target)===digest,'SOURCE_WEAVE_SOURCE_TARGET_CHANGED');
 return true;
}

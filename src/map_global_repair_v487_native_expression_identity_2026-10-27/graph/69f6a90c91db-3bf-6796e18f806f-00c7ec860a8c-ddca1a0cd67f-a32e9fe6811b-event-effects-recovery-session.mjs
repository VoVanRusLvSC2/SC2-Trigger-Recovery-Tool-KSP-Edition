import {preserveSourceNativeGuiBinding} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v486_exact_native_role_identity_2026-10-27/graph/62903c647cfa-5f55a5cb7fde-source-native-gui-binding.mjs';
import {RecoverySession as Previous,recoverySessionFor} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/178e17f754ed-12dbb9eb9e45-f8d99f464abb-a726cc2f1cf9-3faefdf691fc-74f8f2cc55ad-recovery-session.mjs';
import {createSourceEventEffects} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v452_source_axes_integrated_2026-10-26/graph/8d591fac4b91-b892a01e87f3-source-event-effects.mjs';
import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
export {recoverySessionFor};

/** Preserve the existing element-store registry and all lowering decisions.
 * A runtime Event queried as an Action is a capability obligation, not evidence
 * that the runtime API is missing or permission to synthesize a Native. */
export class RecoverySession extends Previous{
 eventObligations=new Map();effects;
 resolveCall(call,ctx,guiUse){
  const result=preserveSourceNativeGuiBinding(this,call,ctx,guiUse,super.resolveCall(call,ctx,guiUse));
  if(guiUse!=='action'||result.status==='RESOLVED'||call?.expression?.kind!==K.Identifier)return result;
  const declaration=this.program.declarationAt(call.expression);
  if(!this.sourceNativeApis.declaration(call,ctx.nativeLibrary?.id))return result;
  let source=declaration;while(source.parent)source=source.parent;
  if(this.program.verifiedInputIdentity(source.fileName)?.owned!==false)return result;
  const event=super.resolveCall(call,ctx,'event');
  if(event.status!=='RESOLVED'||!event.definition.flags?.includes('Native')||!event.definition.flags.includes('Event'))return result;
  this.effects??=createSourceEventEffects(this.program);
  let effect;try{effect=this.effects.effectAt(call);}catch(error){effect={kind:'SOURCE_EVENT_EFFECT_UNPROVEN',reason:error.message,guiBindingAuthorized:false};}
  const at=this.program.location(call),key=JSON.stringify([at?.sourceFile,at?.start,at?.end]);
  this.eventObligations.set(key,{call,record:{api:call.expression.name,definition:{library:event.definition.library,type:'FunctionDef',id:event.definition.id},classification:'UNPROVEN_EXPLICIT_TARGET_GUI',effect,guiBindingAuthorized:false}});
  return {...result,sourceEventObligation:{classification:'UNPROVEN_EXPLICIT_TARGET_GUI',source:at,existingEventDefinition:{library:event.definition.library,type:'FunctionDef',id:event.definition.id},nativeApiMissing:false,sourceOrGuiChanged:false}};
 }
 report(){
  const base=super.report();if(!this.eventObligations.size)return base;
  const all=[...this.eventObligations.values()],primary=all.filter(x=>x.record.effect.owner&&!x.record.effect.owner.constructorCandidate),constructors=all.filter(x=>x.record.effect.owner?.constructorCandidate),unverified=all.filter(x=>!x.record.effect.owner);
  let closure;try{closure=this.effects.refusalClosure(primary.map(x=>x.call));}catch(error){closure={status:'UNPROVEN',reason:error.message,guiBindingAuthorized:false};}
  return {...base,sourceEventObligations:{kind:'SOURCE_BOUND_EVENT_CAPABILITY_OBLIGATIONS',primary:primary.map(x=>x.record),constructors:constructors.map(x=>({api:x.record.api,source:x.record.effect.source,owner:x.record.effect.owner.name,classificationOnly:true})),unverified:unverified.map(x=>x.record),dependencyClosure:closure,
   nativeApiMissing:false,newNative:0,newCustomScript:0,newRuntimeFunctions:0,guiBindingAuthorized:false,wholeMapAccepted:false}};
 }
 dispose(){this.eventObligations.clear();this.effects=undefined;super.dispose();}
}

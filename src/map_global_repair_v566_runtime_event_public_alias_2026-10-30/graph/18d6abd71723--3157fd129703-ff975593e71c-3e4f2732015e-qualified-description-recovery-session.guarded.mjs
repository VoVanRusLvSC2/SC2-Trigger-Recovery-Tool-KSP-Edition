import {inspectContextualNativeValueCandidates} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/bindings/contextual-native-source-identity.mjs';
import {declaredCarrier} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/galaxy-program-context.js';
import {RecoverySession as Previous,recoverySessionFor} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/69f6a90c91db-3bf-6796e18f806f-00c7ec860a8c-ddca1a0cd67f-a32e9fe6811b-event-effects-recovery-session.mjs';
import {createMissingNativeGuiDescriptions} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v566_runtime_event_public_alias_2026-10-30/graph/82cf54637990-fc0b89ab-caa5f5a4c52f-b38c56e4d642-1918e5c4a98b-missing-native-gui-description.guarded.mjs';
export {recoverySessionFor};

export class RecoverySession extends Previous{
 missingDescriptions;
 resolveCall(call,ctx,use){
  const result=super.resolveCall(call,ctx,use);
  if(result.status==='AMBIGUOUS')return result;
  if(result.status==='RESOLVED'&&!inspectContextualNativeValueCandidates(this.candidates,call.expression?.name,{returnType:declaredCarrier(this.program.declarationAt(call.expression)?.type),parameters:call.arguments?.map(()=>undefined)}))return result;
  this.missingDescriptions??=createMissingNativeGuiDescriptions(this);
  const definition=this.missingDescriptions.describe(call,ctx,use,result);
  if(!definition)return result;
  const at=this.program.location(call);
  this.eventObligations.delete(JSON.stringify([at?.sourceFile,at?.start,at?.end]));
  return {status:'RESOLVED',definition,candidateKeys:[`${definition.library}:FunctionDef:${definition.id}`],
   missingNativeGuiDescription:true,rejected:result.rejected??[]};
 }
 report(){return {...super.report(),missingNativeGuiDescriptions:this.missingDescriptions?.report()};}
 dispose(){this.missingDescriptions=undefined;super.dispose();}
}

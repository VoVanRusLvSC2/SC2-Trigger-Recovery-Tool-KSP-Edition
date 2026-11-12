import {inspectContextualNativeValueCandidates} from "../../bindings/contextual-native-source-identity.mjs";
import {declaredCarrier} from "../../sdk/array-values/modules/triggers/services/galaxy-conversion/galaxy-program-context.js";
import {RecoverySession as Previous,recoverySessionFor} from "../native-expression-identity/event-effects-recovery-session.mjs";
import {createMissingNativeGuiDescriptions} from "./missing-native-gui-description.guarded.mjs";
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

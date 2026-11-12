import {RecoverySession as Previous,recoverySessionFor} from './event-effects-recovery-session.mjs';
import {createMissingNativeGuiDescriptions} from './missing-native-gui-description.source-identity.mjs';
export {recoverySessionFor};

export class RecoverySession extends Previous{
 missingDescriptions;
 resolveCall(call,ctx,use){
  const result=super.resolveCall(call,ctx,use);
  if(result.status==='RESOLVED'||result.status==='AMBIGUOUS')return result;
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

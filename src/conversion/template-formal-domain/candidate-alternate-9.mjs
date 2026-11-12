import * as parent from "./candidate-alternate-8.mjs";
import {auditGuiValueReachability} from "../../verification/gui-value-reachability.mjs";
export * from "./candidate-alternate-8.mjs";
export async function convertGalaxyToTriggers(input,...args){
 const result=await parent.convertGalaxyToTriggers(input,...args);
 if(!result.output?.triggerData)return result;
 const proof=auditGuiValueReachability({xml:result.output.triggerData,
  existingXml:input.existingTriggerData??'',implicitLibraryId:input.libraryId??'Map'});
 if(!proof.passed){const error=new Error('New GUI values have no owning path');
  error.code='GUI_VALUE_GRAPH_INCOMPLETE';error.context={conversionCode:error.code,...proof};throw error;}
 return {...result,guiValueReachability:proof};
}

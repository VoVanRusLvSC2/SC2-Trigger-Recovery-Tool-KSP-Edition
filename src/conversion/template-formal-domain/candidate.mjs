import * as previous from "./candidate-alternate-3.mjs";
import {auditGuiRoleUse} from "../preserved-disabled-calls/gui-role-use.context-edges.comments.mjs";
export {createTriggerConversionContext,triggerConversionBounds} from "./candidate-alternate-3.mjs";
function preflight(xml,input,existingXml=''){
 const proof=auditGuiRoleUse({xml,existingXml,implicitLibraryId:input?.libraryId??'Map',dependencyLibraries:input?.dependencyLibraries??[],sourceInput:input});
 if(!proof.passed){const error=Error('GUI_TYPE_ROLE_UNPROVEN');error.context=proof;throw error;}
 return proof;
}
export async function convertGalaxyToTriggers(input,signal){
 const result=await previous.convertGalaxyToTriggers(input,signal);
 const proof=preflight(result.output.triggerData,input,input.existingTriggerData??'');
 return {...result,guiRoleUse:proof};
}
export async function convertTriggersToGalaxy(xml,input,signal){
 // Forward conversion preserves authored return contracts; it must still
 // reject malformed calls instead of hiding them in emitted Galaxy.
 const proof=preflight(xml,input,xml),result=await previous.convertTriggersToGalaxy(xml,input,signal);
 return {...result,guiRoleUse:proof};
}

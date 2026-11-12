import * as previous from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v569_template_formal_domain_2026-10-30/graph/3a135dca95e1-986f6-fb7b862d9d87-290cd39fc386-1ab48ff79ea5fc-87a6444eefb007-7c44a819601cfd-candidate.mjs';
import {auditGuiRoleUse} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v522_preserved_disabled_calls_2026-10-28/graph/f7abdf6a6f18-874348e1372-75a7ab64223a-6962de0d672d-a9ad2365b323-gui-role-use.context-edges.comments.mjs';
export {createTriggerConversionContext,triggerConversionBounds} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v569_template_formal_domain_2026-10-30/graph/3a135dca95e1-986f6-fb7b862d9d87-290cd39fc386-1ab48ff79ea5fc-87a6444eefb007-7c44a819601cfd-candidate.mjs';
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

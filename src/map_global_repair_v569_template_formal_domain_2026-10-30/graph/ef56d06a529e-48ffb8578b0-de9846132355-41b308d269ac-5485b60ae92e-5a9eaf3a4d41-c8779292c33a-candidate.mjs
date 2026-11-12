import * as parent from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v569_template_formal_domain_2026-10-30/graph/9a07308de9c3-473897070d1-a181fcd5db74-7d1c413720da-fb5f6fdf1c0a-39946040184f-7dcdbf82bc69-candidate.mjs';
import {auditGuiValueReachability} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/gui-value-reachability.mjs';
export * from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v569_template_formal_domain_2026-10-30/graph/9a07308de9c3-473897070d1-a181fcd5db74-7d1c413720da-fb5f6fdf1c0a-39946040184f-7dcdbf82bc69-candidate.mjs';
export async function convertGalaxyToTriggers(input,...args){
 const result=await parent.convertGalaxyToTriggers(input,...args);
 if(!result.output?.triggerData)return result;
 const proof=auditGuiValueReachability({xml:result.output.triggerData,
  existingXml:input.existingTriggerData??'',implicitLibraryId:input.libraryId??'Map'});
 if(!proof.passed){const error=new Error('New GUI values have no owning path');
  error.code='GUI_VALUE_GRAPH_INCOMPLETE';error.context={conversionCode:error.code,...proof};throw error;}
 return {...result,guiValueReachability:proof};
}

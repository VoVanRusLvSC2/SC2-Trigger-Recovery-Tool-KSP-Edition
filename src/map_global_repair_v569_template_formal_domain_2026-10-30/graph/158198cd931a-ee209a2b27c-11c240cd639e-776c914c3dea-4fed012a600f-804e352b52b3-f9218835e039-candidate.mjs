import * as parent from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v569_template_formal_domain_2026-10-30/graph/ef56d06a529e-48ffb8578b0-de9846132355-41b308d269ac-5485b60ae92e-5a9eaf3a4d41-c8779292c33a-candidate.mjs';
import {completeNewCategoryLocalization} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/09e7ade59d66-2a81038ca9ff-01f8dfbe08a8-9ffc7017eb19-d4d12cddc121-new-category-localization.mjs';
export * from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v569_template_formal_domain_2026-10-30/graph/ef56d06a529e-48ffb8578b0-de9846132355-41b308d269ac-5485b60ae92e-5a9eaf3a4d41-c8779292c33a-candidate.mjs';
export async function convertGalaxyToTriggers(input,...args){
 const result=await parent.convertGalaxyToTriggers(input,...args);
 if(!result.output?.triggerData)return result;
 const labels=completeNewCategoryLocalization({xml:result.output.triggerData,
  triggerStrings:result.output.triggerStrings??'',existingXml:input.existingTriggerData??'',
  libraryId:input.libraryId??'Map'});
 return {...result,output:{...result.output,triggerStrings:labels.text},categoryLocalization:labels.proof};
}

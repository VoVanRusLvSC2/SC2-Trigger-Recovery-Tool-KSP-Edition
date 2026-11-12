import * as parent from "./candidate-alternate-9.mjs";
import {completeNewCategoryLocalization} from "../implicit-gui-localization/new-category-localization.mjs";
export * from "./candidate-alternate-9.mjs";
export async function convertGalaxyToTriggers(input,...args){
 const result=await parent.convertGalaxyToTriggers(input,...args);
 if(!result.output?.triggerData)return result;
 const labels=completeNewCategoryLocalization({xml:result.output.triggerData,
  triggerStrings:result.output.triggerStrings??'',existingXml:input.existingTriggerData??'',
  libraryId:input.libraryId??'Map'});
 return {...result,output:{...result.output,triggerStrings:labels.text},categoryLocalization:labels.proof};
}

import * as previous from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v569_template_formal_domain_2026-10-30/graph/85608f1a6731-2-2b9495c881e4-854977275888-bb7d25d8b5e47f-5dc6b058431f0a-65276323533925-candidate-r81.mjs';
import {repairGeneratedSingletonArrays} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/0bedde73ccf8-singleton-array-bounds.indexed-owners.mjs';
export {convertTriggersToGalaxy,createTriggerConversionContext,triggerConversionBounds} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v569_template_formal_domain_2026-10-30/graph/85608f1a6731-2-2b9495c881e4-854977275888-bb7d25d8b5e47f-5dc6b058431f0a-65276323533925-candidate-r81.mjs';

// Experimental successor; previous snapshots and qualified CURRENT are intact.
export async function convertGalaxyToTriggers(input,signal) {
 const result=await previous.convertGalaxyToTriggers(input,signal);
 const sources=[{fileName:'MapScript.galaxy',text:input.script??''},{fileName:'MapScript_h.galaxy',text:input.header??''},...(input.additionalScripts??[]),...(input.galaxyDeclarations??[])];
 const next=repairGeneratedSingletonArrays({xml:result.output.triggerData,existingXml:input.existingTriggerData??'',implicitLibraryId:input.libraryId??'Map',sources});
 const strings=next.proof.newConstants.map(c=>`Variable/Name/${c.libraryScoped?'lib_'+c.library+'_':''}${c.id}=Array upper bound (0)`).join('\n');
 return {...result,output:{...result.output,triggerData:next.xml,triggerStrings:(result.output.triggerStrings??'')+(strings?'\n'+strings+'\n':'')},nativeArrayBounds:next.proof};
}

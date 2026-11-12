import * as previous from './candidate-r81.mjs';
import {repairGeneratedSingletonArrays} from '../gui/singleton-array-bounds.mjs';
export {convertTriggersToGalaxy,createTriggerConversionContext,triggerConversionBounds} from './candidate-r81.mjs';

// Experimental successor; previous snapshots and qualified CURRENT are intact.
export async function convertGalaxyToTriggers(input,signal) {
 const result=await previous.convertGalaxyToTriggers(input,signal);
 const sources=[{fileName:'MapScript.galaxy',text:input.script??''},{fileName:'MapScript_h.galaxy',text:input.header??''},...(input.additionalScripts??[]),...(input.galaxyDeclarations??[])];
 const next=repairGeneratedSingletonArrays({xml:result.output.triggerData,existingXml:input.existingTriggerData??'',implicitLibraryId:input.libraryId??'Map',sources});
 const strings=next.proof.newConstants.map(c=>`Variable/Name/${c.libraryScoped?'lib_'+c.library+'_':''}${c.id}=Array upper bound (0)`).join('\n');
 return {...result,output:{...result.output,triggerData:next.xml,triggerStrings:(result.output.triggerStrings??'')+(strings?'\n'+strings+'\n':'')},nativeArrayBounds:next.proof};
}

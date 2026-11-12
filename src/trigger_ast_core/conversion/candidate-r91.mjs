import * as previous from './candidate-r89.mjs';
import {preserveGeneratedFixedLiterals} from '../gui/exact-fixed-literals.mjs';
export {convertTriggersToGalaxy,createTriggerConversionContext,triggerConversionBounds} from './candidate-r89.mjs';
export async function convertGalaxyToTriggers(input,signal) {
 const result=await previous.convertGalaxyToTriggers(input,signal);
 const next=preserveGeneratedFixedLiterals({xml:result.output.triggerData,existingXml:input.existingTriggerData??'',implicitLibraryId:input.libraryId??'Map'});
 const scope=c=>c.libraryScoped?'lib_'+c.library+'_':'';
 const strings=next.proof.presets.flatMap(p=>[`Preset/Name/${scope(p)}${p.id}=Exact fixed literals`,...p.values.map(v=>`PresetValue/Name/${scope(p)}${v.id}=${v.token}`)]).join('\n');
 return {...result,output:{...result.output,triggerData:next.xml,triggerStrings:(result.output.triggerStrings??'')+(strings?'\n'+strings+'\n':'')},exactFixedLiterals:next.proof};
}

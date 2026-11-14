/** Match repeated IDs only across identical definitions in separate input mods.
 * Source branches keep their order/multiplicity; no deduplication of execution.
 */
// @ts-nocheck
import {readAIData} from '../../../../map/shared/format/formats/ai-data.js';
export function matchingRepeatedAiComposition(ids,documents){
 if(!Array.isArray(documents)||!documents.length||documents.length>1024)return false;
 const composition=[],signatures=new Map();let total=0;
 for(const text of documents){
  if(typeof text!=='string'||text.length>64*1024**2)return false;
  total+=text.length;if(total>128*1024**2)return false;
  let parsed;try{parsed=readAIData(text);}catch{return false;}
  const ownIds=parsed.definitions.map(d=>d.id.toUpperCase());
  if(new Set(ownIds).size!==ownIds.length)return false;
  for(const d of parsed.definitions){
   const id=d.id.toUpperCase(),signature=JSON.stringify({...d,id}),old=signatures.get(id);
   if(old&&old!==signature)return false;
   signatures.set(id,signature);composition.push(id);
  }
 }
 return composition.toSorted().join(',')===ids.map(id=>id.toUpperCase()).toSorted().join(',');
}

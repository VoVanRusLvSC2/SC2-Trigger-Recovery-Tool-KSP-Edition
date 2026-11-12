// Normalize the UTF-8 signature at the table boundary, never a runtime value.
// Preserve the historical source adapter and all its exact-source/default gates.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifiedAttributeSource as originalSource} from "./verified-attribute-source.mjs";
const sha=t=>createHash('sha256').update(t).digest('hex');

export function normalizeAttributeLocalizationInputs(localizedStrings=[]){
 assert(Array.isArray(localizedStrings),'LOCALIZATION_INPUTS_NOT_ARRAY');
 const records=[];
 const normalized=localizedStrings.map(l=>{
  assert(l&&typeof l==='object','LOCALIZATION_INPUT_NOT_OBJECT');
  if(typeof l.gameStrings!=='string'||!l.gameStrings.startsWith('\uFEFF'))return{...l};
  const gameStrings=l.gameStrings.slice(1);
  records.push({locale:l.locale,field:'gameStrings',operation:'REMOVE_LEADING_UTF8_SIGNATURE_IN_DECODED_VIEW',originalSha256:sha(l.gameStrings),decodedViewSha256:sha(gameStrings),sourceBytesChanged:false,runtimeValuesRewritten:false});
  return{...l,gameStrings};
 });
 return{normalized,records};
}

export async function verifiedAttributeSource(options){
 const {normalized,records}=normalizeAttributeLocalizationInputs(options.localizedStrings);
 const result=await originalSource({...options,localizedStrings:normalized});
 if(!result.used)return result;
 return{...result,proof:{...result.proof,localizationTransport:{rule:'A_LEADING_UTF8_BOM_IS_ENCODING_METADATA_NOT_PART_OF_THE_FIRST_KEY',records,inputObjectsUnchanged:true,sourceBytesChanged:false}}};
}

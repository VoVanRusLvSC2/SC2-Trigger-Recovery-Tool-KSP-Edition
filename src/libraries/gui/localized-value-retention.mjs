// Preservation of original values only. New GUI metadata keys, locale fallback
// and actual Editor display are separate checks, never implied by this result.
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function parseLocalizedValueTable(bytes){
 new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 const values=new Map(),opaque=[];
 for(const raw of bytes.toString('utf8').replace(/^\uFEFF/u,'').split(/\r?\n/u)){
  const line=raw.trimStart();if(!line.trim()||line.startsWith('#'))continue;
  const at=line.indexOf('=');if(at<=0){opaque.push(raw);continue;}
  const key=line.slice(0,at),value=line.slice(at+1);if(!values.has(key))values.set(key,[]);values.get(key).push(value);
 }
 // Identical duplicates have no first/last-wins ambiguity. Conflicting values
 // retain their full order; never guess which duplicate an engine would use.
 for(const[key,list]of values)if(new Set(list).size===1)values.set(key,[list[0]]);
 return{values,opaque};
}
export function compareLocalizedValueRetention(original,candidate){
 const byteExact=!!candidate&&original.equals(candidate);
 const base={originalSha256:sha(original),candidateSha256:candidate?sha(candidate):null,byteExact,wholeLocalizationEquivalenceProved:false};
 if(byteExact)return{...base,originalValuesRetained:true,missing:[],changed:[],additionalKeys:[],opaqueSourceLinesUnchanged:true};
 if(!candidate)return{...base,originalValuesRetained:false,reason:'ORIGINAL_LOCALIZED_TABLE_MISSING'};
 let a,b;try{a=parseLocalizedValueTable(original);b=parseLocalizedValueTable(candidate);}catch(error){return{...base,originalValuesRetained:false,reason:'LOCALIZED_ENCODING_UNPROVEN',error:String(error)};}
 const missing=[],changed=[];
 for(const[key,values]of a.values){if(!b.values.has(key))missing.push({key,original:values});else if(JSON.stringify(values)!==JSON.stringify(b.values.get(key)))changed.push({key,original:values,candidate:b.values.get(key)});}
 const opaqueSourceLinesUnchanged=JSON.stringify(a.opaque)===JSON.stringify(b.opaque);
 return{...base,originalValuesRetained:!missing.length&&!changed.length&&opaqueSourceLinesUnchanged,originalKeys:a.values.size,candidateKeys:b.values.size,missing,changed,additionalKeys:[...b.values.keys()].filter(k=>!a.values.has(k)),opaqueSourceLinesUnchanged,reason:opaqueSourceLinesUnchanged?undefined:'OPAQUE_LOCALIZED_LINES_DIFFER'};
}

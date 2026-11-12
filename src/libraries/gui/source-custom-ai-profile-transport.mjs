// The CustomAI document alone cannot distinguish the two observed empty-wave
// compiler forms. Carry its actual source evidence with the conversion result,
// so a later call/JSON transfer needs neither global state nor the old archive.
// These are conversion inputs, not a new AIData flag or a GUI script element.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inspectSourceCustomAiProfiles} from "./source-custom-ai-profile.mjs";
import {readAIData} from "../../sdk/array-values/modules/map/shared/format/formats/ai-data.js";
const sha=s=>createHash('sha256').update(s).digest('hex');
export function resolveSourceCustomAiInputs(input){
 const carry=input?.customAi?.sourceAiGeneration;
 if(carry===undefined)return input;
 assert(carry&&carry.version===1&&Array.isArray(carry.files)&&Array.isArray(carry.sendIds)&&carry.sendIds.length,'INVALID_SOURCE_AI_GENERATION_EVIDENCE');
 const files=carry.files.map(f=>{
  assert(typeof f?.fileName==='string'&&/^ai[0-9A-F]{8}\.galaxy$/u.test(f.fileName)&&typeof f.text==='string','INVALID_SOURCE_AI_GENERATION_FILE');
  assert.equal(sha(f.text),f.sha256,'SOURCE_AI_GENERATION_FILE_CHANGED');return{fileName:f.fileName,text:f.text};
 });
 const proof=inspectSourceCustomAiProfiles(files);
 assert.deepEqual([...proof.sendIds].sort(),[...carry.sendIds].sort(),'SOURCE_AI_GENERATION_PROFILE_NOT_PROVED');
 assert.equal(proof.ambiguousInputIds.length,0,'AMBIGUOUS_SOURCE_AI_GENERATION_EVIDENCE');
 assert(proof.records.every(r=>r.state==='EMPTY_TRAINED_WAVE_SEND'),'SOURCE_AI_GENERATION_UNMATCHED_FILE');
 const supplied=input.customAiScripts??[],combined=[...supplied];
 for(const f of files){
  const existing=supplied.filter(x=>x.fileName.split(/[\\/]/u).at(-1).toLowerCase()===f.fileName.toLowerCase());
  for(const x of existing)assert.equal(x.text.replaceAll('\r\n','\n'),f.text.replaceAll('\r\n','\n'),'SOURCE_AI_GENERATION_INPUT_CONFLICT');
  if(!existing.length)combined.push(f);
 }
 return{...input,customAiScripts:combined};
}
export function carrySourceCustomAiInputs(result,files){
 if(!result?.output?.customAi)return result;
 const proof=inspectSourceCustomAiProfiles(files),represented=new Set(readAIData(result.output.customAi.document).definitions.map(d=>d.id)),ids=new Set(proof.sendIds.filter(id=>represented.has(id)));
 if(!ids.size)return result;
 assert.equal(proof.ambiguousInputIds.length,0,'AMBIGUOUS_SOURCE_AI_GENERATION_EVIDENCE');
 const selected=[],seen=new Set();
 for(const f of files){
  const fileName=f.fileName.split(/[\\/]/u).at(-1),id=/^ai([0-9A-F]{8})\.galaxy$/u.exec(fileName)?.[1];
  if(!ids.has(id)||seen.has(id))continue;
  seen.add(id);selected.push({fileName,text:f.text,sha256:sha(f.text)});
 }
 assert.equal(selected.length,ids.size,'SOURCE_AI_GENERATION_INPUT_MISSING');
 const sourceAiGeneration={version:1,sendIds:[...ids],files:selected};
 const customAi={...result.output.customAi,sourceAiGeneration};
 // Re-verify the same transport that a separate conversion call will read.
 resolveSourceCustomAiInputs({customAi});
 return{...result,output:{...result.output,customAi}};
}

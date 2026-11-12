// Two observed native AI compiler spellings disagree about an empty trained
// wave: send the prepared army, or run only its configured triggers/timing.
// Select a backend only when it reproduces an entire actual input AI file.
// There are no map-name rules, inferred unit types, XML extension flags,
// runtime wrappers, aliases or fallback implementations here.
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {generateCustomAiScript as current} from "../../ast/custom-ai-script.mjs";
import {generateCustomAiScript as trainedSend} from "./custom-ai-script.empty-trained-send.mjs";
import {readDefinition} from "./custom-ai-recovery.reader.mjs";
const state=new AsyncLocalStorage(),sha=s=>createHash('sha256').update(s).digest('hex'),lf=s=>s.replaceAll('\r\n','\n');
export function inspectSourceCustomAiProfiles(files=[]){
 const byId=new Map(),records=[];
 for(const file of files){
  const base=file.fileName.split(/[\\/]/u).at(-1),id=/^ai([0-9A-F]{8})\.galaxy$/u.exec(base)?.[1];
  const record={fileName:file.fileName,sourceSha256:sha(file.text),id,state:'UNSUPPORTED_SOURCE_FILE'};records.push(record);
  if(!id)continue;
  const item={record,profile:undefined,normalizedSource:lf(file.text)};if(!byId.has(id))byId.set(id,[]);byId.get(id).push(item);
  const triggerFunctions=new Map(),triggerId=name=>{for(const[id,known]of triggerFunctions)if(known===name)return id;const id='T'+triggerFunctions.size;triggerFunctions.set(id,name);return id;};
  let read;try{read=readDefinition(lf(file.text),triggerId);}catch{continue;}
  if(!read||read.definition.id!==id)continue;
  const names={aiName:()=>read.aiName,triggerFunction:id=>triggerFunctions.get(id)??id};
  const a=current(read.definition,names),b=trainedSend(read.definition,names),matchesCurrent=lf(a)===lf(file.text),matchesTrainedSend=lf(b)===lf(file.text);
  Object.assign(record,{matchesCurrent,matchesTrainedSend,currentSha256:sha(a),trainedSendSha256:sha(b),wholeFileEquality:true});
  if(!matchesCurrent&&!matchesTrainedSend){record.state='NEITHER_EXACT_GENERATOR_MATCHES';continue;}
  item.profile=matchesCurrent&&matchesTrainedSend?'IDENTICAL_BACKENDS':matchesTrainedSend?'EMPTY_TRAINED_WAVE_SEND':'EMPTY_TRAINED_WAVE_TRIGGER_ONLY';record.state=item.profile;
 }
 const sendIds=[],conflicts=[],ambiguousInputIds=[];
 for(const[id,items]of byId){
  const kinds=new Set(items.map(x=>x.profile).filter(p=>p&&p!=='IDENTICAL_BACKENDS'));
  if(new Set(items.map(x=>x.normalizedSource)).size>1)ambiguousInputIds.push(id);
  if(items.some(x=>!x.profile)||kinds.size>1){conflicts.push(id);for(const x of items)x.record.selection='HELD_UNPROVED_OR_CONFLICTING_INPUT';continue;}
  if(kinds.has('EMPTY_TRAINED_WAVE_SEND'))sendIds.push(id);
  for(const x of items)x.record.selection=kinds.has('EMPTY_TRAINED_WAVE_SEND')?'TRAINED_SEND_BACKEND':'CURRENT_BACKEND';
 }
 return{sendIds,conflicts,ambiguousInputIds,records,scope:'Exact whole supplied AI file only; complete dispatch recovery, GUI, packed archive and Editor checks remain mandatory',persistentCache:false};
}
export function withSourceCustomAiProfiles(files,operation){
 const proof=inspectSourceCustomAiProfiles(files);
 assert.equal(proof.ambiguousInputIds.length,0,'AMBIGUOUS_SOURCE_CUSTOM_AI_FILES');
 return state.run({sendIds:new Set(proof.sendIds),proof},operation);
}
export function sourceCustomAiProfile(id){return state.getStore()?.sendIds.has(id)?'EMPTY_TRAINED_WAVE_SEND':'CURRENT';}
export function activeSourceCustomAiProof(){return state.getStore()?.proof;}

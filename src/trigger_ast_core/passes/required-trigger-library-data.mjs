import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{xmlTree}from'../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),pathKey=s=>s.replaceAll('\\','/').replace(/\.galaxy$/iu,'').toLowerCase();
export function appendRequiredTriggerLibraries(xml,plan){
 assert(plan?.kind==='ORIGINAL_COMPILER_LIBRARY_AUTOLOAD_DEMAND'&&Array.isArray(plan.demands),'SOURCE_LIBRARY_DEMAND_REQUIRED');
 assert(typeof xml==='string'&&xml.length<=8*1024**2,'GAME_DATA_INPUT_BOUND');const root=xmlTree(xml);assert(root.tag==='Catalog','GAME_DATA_CATALOG_REQUIRED');
 const records=root.children.filter(n=>n.tag==='CGame'&&n.attributes.id==='Dflt');assert(records.length<=1,'GAME_DATA_DFLT_NOT_UNIQUE');const record=records[0],seen=new Set(),added=[];
 assert(!root.selfClosing&&!record?.selfClosing,'GAME_DATA_CONTAINER_EXPANSION_REQUIRES_POLICY');
 for(const d of plan.demands){assert(/^[A-Za-z0-9_]{1,64}$/u.test(d.id)&&/^[A-Za-z0-9_./\\ -]+$/u.test(d.includePath)&&!d.includePath.split(/[\\/]/u).includes('..'),'INVALID_LIBRARY_DATA_IDENTITY');assert(!seen.has(d.id),'DUPLICATE_LIBRARY_DEMAND');seen.add(d.id);
  const existing=(record?.children??[]).filter(n=>n.tag==='TriggerLibs'&&(n.attributes.Id===d.id||n.attributes.index===d.id));assert(existing.length<=1,'DUPLICATE_GAME_LIBRARY_ID');
  if(existing.length){const n=existing[0];assert(!n.attributes.removed&&n.attributes.Id===d.id&&n.attributes.IncludePath&&pathKey(n.attributes.IncludePath)===pathKey(d.includePath),'EXPLICIT_GAME_LIBRARY_CONFLICT');continue;}
  added.push({id:d.id,includePath:d.includePath,initializer:d.initializer});
 }
 if(!added.length)return{xml,proof:{kind:'REQUIRED_TRIGGER_LIBRARY_DATA',beforeSha256:sha(xml),afterSha256:sha(xml),added:[],otherBytesPreserved:true,accepted:false}};
 const nodes=added.map(d=>`        <TriggerLibs Id="${d.id}" IncludePath="${d.includePath}"/>`).join('\n');
 const at=record?record.closeStart:root.closeStart,fragment=record?'\n'+nodes+'\n    ':'\n    <CGame id="Dflt">\n'+nodes+'\n    </CGame>\n';
 const after=xml.slice(0,at)+fragment+xml.slice(at);assert.equal(after.slice(0,at)+after.slice(at+fragment.length),xml,'NON_LIBRARY_BYTES_CHANGED');
 return{xml:after,proof:{kind:'REQUIRED_TRIGGER_LIBRARY_DATA',beforeSha256:sha(xml),afterSha256:sha(after),added,insertion:{start:at,bytes:Buffer.byteLength(fragment)},otherBytesPreserved:true,newRuntimeFunctions:0,newNative:0,accepted:false}};
}

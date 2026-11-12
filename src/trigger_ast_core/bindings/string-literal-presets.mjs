// Standard string Preset/Value data, using the installed editor's quoted
// literal format. No call, operator or statement is accepted as a preset value.
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
const context=new AsyncLocalStorage(),facts=new WeakMap(),sha=b=>createHash('sha256').update(b).digest('hex');
const walk=(n,f)=>{if(n){f(n);forEachChild(n,c=>walk(c,f));}};
export function createStringLiteralBindings({ownedSources=[]}){
 const literals=new Map(),inputs=[];
 for(const input of ownedSources){
  const text=typeof input==='string'?input:input.text,ast=new Parser().parseFile('owned-string-literals',text);assert.equal(ast.parseDiagnostics.length,0);
  const source={name:input.fileName??input.name,sha256:sha(text)};inputs.push(source);
  walk(ast,n=>{if(n.kind!==K.StringLiteral)return;const value=readStringLiteralValue(n.text);if(!value)return;const key=sha(value.bytes),list=literals.get(key)??[];list.push({bytes:value.bytes,source});literals.set(key,list);});
 }
 const proof={kind:'SOURCE_BOUND_PRIMITIVE_STRING_VALUES',inputs,records:[],refused:[],persistentCache:false,originalSourcesChanged:false};
 const capability=Object.freeze({kind:proof.kind});facts.set(capability,{literals,proof,states:new WeakMap()});return{capability,proof};
}
export function withStringLiteralBindings(capability,callback){const f=facts.get(capability);assert(f,'UNTRUSTED_STRING_LITERAL_CAPABILITY');return context.run(f,callback);}
export function validateStringLiteralSources(capability,records){
 const f=facts.get(capability);assert(f,'UNTRUSTED_STRING_LITERAL_CAPABILITY');
 return records.every(r=>{const literal=readStringLiteralValue(r.originalLiteral);return literal&&sha(literal.bytes)===r.byteSha256&&(f.literals.get(r.byteSha256)??[]).some(s=>s.bytes.equals(literal.bytes));});
}
export function reifyStringLiteralParameters(elements,libId,rootRefs,allocateId){
 const active=context.getStore();if(!active)return [];
 const records=[],original=Object.values(elements),conflicts=['value','variable','paramRef','preset','valueElement','functionCall','expressionText','structMember'];
 let state=active.states.get(elements);if(!state){state=new Map();active.states.set(elements,state);}
 for(const p of original){
  if(p.type!=='Param'||p.disabled||typeof p.scriptCode!=='string'||p.valueType&&p.valueType.type!=='string'||conflicts.some(k=>p[k]!==undefined)||p.expressionType!==undefined||p.expressionParams?.length||p.valueParams?.length||p.arrayIndexes?.length)continue;
  const literal=readStringLiteralValue(p.scriptCode);if(!literal)continue;
  const byteSha256=sha(literal.bytes),sources=(active.literals.get(byteSha256)??[]).filter(s=>s.bytes.equals(literal.bytes)).map(s=>s.source);
  if(!sources.length){active.proof.refused.push({library:libId,param:p.id,reason:'STRING_LITERAL_NOT_SOURCE_BOUND'});continue;}
  const record={library:libId,param:p.id,originalLiteral:literal.token,byteSha256,bytes:literal.bytes.length,sources};
  if(!literal.needsPreset){delete p.scriptCode;p.valueType=p.valueType??{type:'string'};p.value=literal.value;record.representation='string-value';}
  else{
   if(typeof allocateId!=='function'||!Array.isArray(rootRefs)){active.proof.refused.push({library:libId,param:p.id,reason:'STRING_PRESET_REQUIRES_OWNER_ALLOCATOR_AND_ROOTS'});continue;}
   let binding=state.get(literal.xmlToken);
   if(!binding){
    const key=sha(literal.xmlToken),presetId=allocateId(libId+'|string-literal-preset|'+key),valueId=allocateId(libId+'|string-literal-value|'+key);
    assert(presetId!==valueId&&!elements[presetId]&&!elements[valueId],'STRING_PRESET_ALLOCATOR_COLLISION');
    const valueRef={type:'PresetValue',library:libId,id:valueId};
    elements[valueId]={type:'PresetValue',library:libId,id:valueId,name:literal.xmlToken.slice(0,64)+(literal.xmlToken.length>64?'...':''),identifier:'Literal',value:literal.xmlToken};
    elements[presetId]={type:'Preset',library:libId,id:presetId,name:'String value ('+literal.bytes.length+' bytes)',identifier:'StringValue'+key.slice(0,8),baseType:'string',values:[valueRef],generateConstants:false,generateIdentifier:false,integer:false,unknownXml:[{tag:'PresetCustom',position:0}]};
    rootRefs.push({type:'Preset',library:libId,id:presetId});binding={presetId,valueId};state.set(literal.xmlToken,binding);
   }
   delete p.scriptCode;p.valueType=p.valueType??{type:'string'};p.preset={type:'PresetValue',library:libId,id:binding.valueId};
   Object.assign(record,{representation:'string-literal-preset',preset:binding.presetId,value:binding.valueId,encodedLiteral:literal.xmlToken});
  }
  records.push(record);active.proof.records.push(record);
 }
 return records;
}
export function validateStringLiteralBindings(libraries,records){
 const issues=[],find=(library,type,id)=>Object.values(libraries.get(library)?.elements??{}).find(e=>e.type===type&&e.id===id);
 for(const r of records){
  const p=find(r.library,'Param',r.param),source=readStringLiteralValue(r.originalLiteral);
  const conflicts=['scriptCode','variable','paramRef','valueElement','functionCall','expressionText','structMember','expressionType'];
  if(!p||conflicts.some(k=>p[k]!==undefined)||p.disabled||p.valueType?.type!=='string'||p.expressionParams?.length||p.valueParams?.length||p.arrayIndexes?.length||!source||sha(source.bytes)!==r.byteSha256||source.bytes.length!==r.bytes){issues.push({param:r.param,code:'STRING_LITERAL_SOURCE_OR_PARAM_MISMATCH'});continue;}
  if(r.representation==='string-value'){
   if(p.preset||p.valueType?.type!=='string'||typeof p.value!=='string'||!Buffer.from(p.value,'utf8').equals(source.bytes))issues.push({param:r.param,code:'STRING_LITERAL_VALUE_CHANGED'});
  }else if(r.representation==='string-literal-preset'){
   const preset=find(r.library,'Preset',r.preset),value=find(r.library,'PresetValue',r.value),decoded=value&&readStringLiteralValue(value.value);
   if(p.value!==undefined||p.preset?.type!=='PresetValue'||p.preset.id!==r.value||(p.preset.library??r.library)!==r.library||!preset||preset.baseType!=='string'||preset.integer||preset.generateConstants||preset.generateIdentifier||preset.values?.length!==1||preset.values[0].type!=='PresetValue'||preset.values[0].id!==r.value||(preset.values[0].library??r.library)!==r.library||!preset.unknownXml?.some(x=>x.tag==='PresetCustom')||!decoded||!decoded.bytes.equals(source.bytes)||value.value!==r.encodedLiteral)issues.push({param:r.param,code:'STRING_LITERAL_PRESET_CHANGED'});
  }else issues.push({param:r.param,code:'UNKNOWN_STRING_LITERAL_REPRESENTATION'});
 }
 return{valid:issues.length===0,issues};
}

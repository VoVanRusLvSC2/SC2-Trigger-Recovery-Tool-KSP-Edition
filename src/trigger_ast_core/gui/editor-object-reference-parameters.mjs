// Recover a document selector captured earlier as a scalar call template.
// The closed constructor contract comes from the same codec as Galaxy output.
import {editorObjectConstructor,editorObjectReferenceTypes} from '../model/editor-object-reference-codecs.mjs';
const relational=new Set(['any','anyvariable','anycompare','sameas','sameasparent','return']);
const forbidden=['variable','paramRef','preset','valueElement','array','structMember','expressionCode','expressionText','expressionParams','scriptCode'];
const numeric=p=>p?.type==='Param'&&p.valueType?.type==='int'&&!p.functionCall&&forbidden.every(k=>p[k]===undefined)&&/^\d+$/u.test(p.value??'')&&Number.isSafeInteger(Number(p.value))&&Number(p.value)<=2147483647&&(p.valueId===undefined||p.valueId===p.value);
export function reifyEditorObjectReferenceParams(elements,libraryId,libraries){
 const records=[],definitions=new Set(),calls=new Set(),argumentsToPrune=new Set();
 const lookup=r=>r&&(r.library??libraryId)===libraryId?elements[r.id]:r&&libraries.get(r.library)?.elements[r.id];
 const local=r=>r&&(r.library??libraryId)===libraryId;
 for(const p of Object.values(elements)){
  if(p.type!=='Param'||!local(p.functionCall)||p.value!==undefined||p.valueId!==undefined||forbidden.some(k=>p[k]!==undefined))continue;
  const call=lookup(p.functionCall),def=call?.type==='FunctionCall'&&lookup(call.functionDef);
  if(!def||!local(call.functionDef)||def.disabled||def.isDisabled||call.disabled||call.isDisabled||call.subFunctions?.length||call.parameters?.length!==1||def.parameters?.length!==1||def.functionCalls?.length)continue;
  const formal=lookup(def.parameters[0]),arg=lookup(call.parameters[0]);if(!numeric(arg)||formal?.type!=='ParamDef'||formal.paramType?.type!=='int'||arg.parameterDef?.id!==def.parameters[0].id||(arg.parameterDef?.library??libraryId)!==(def.parameters[0].library??libraryId))continue;
  let type;
  if(typeof def.scriptCode==='string'&&def.flags?.includes('Operator')){
   // A converter template is one call with one formal; comments, statement
   // tails, extra evaluation and arbitrary native wrappers are not selectors.
   type=editorObjectReferenceTypes.find(t=>def.scriptCode.trim()===editorObjectConstructor(t)+'(#PARAM('+formal.name+'))');
  }else if(def.nativeDeclarationOnly===true&&def.unresolvedGuiBinding===true){
   type=editorObjectReferenceTypes.find(t=>def.name===editorObjectConstructor(t)&&def.returnType?.type===t);
  }
  if(!type)continue;
  const outer=p.parameterDef&&lookup(p.parameterDef),expected=outer?.paramType?.type;
  if(expected&&expected!==type&&!relational.has(expected))continue;
  const old=p.functionCall;delete p.functionCall;p.valueType={type};p.valueId=String(Number(arg.value));
  records.push({parameter:p.id,call:old.id,definition:def.id,type,valueId:p.valueId});definitions.add(def.id);calls.add(call.id);argumentsToPrune.add(arg.id);
 }
 function references(id,ignoreCategories=false){let count=0;
  function visit(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(visit);return;}if(n.id===id&&n.type&&local(n))count++;for(const[k,v]of Object.entries(n))if(k!=='id')visit(v);}
  for(const e of Object.values(elements)){if(ignoreCategories&&e.type==='Category')continue;for(const[k,v]of Object.entries(e))if(!['id','library','type'].includes(k))visit(v);}return count;
 }
 for(const id of calls)if(!references(id))delete elements[id];
 for(const id of argumentsToPrune)if(!references(id))delete elements[id];
 for(const id of definitions)if(!references(id,true)){
  const params=elements[id]?.parameters??[];delete elements[id];
  for(const e of Object.values(elements))if(e.type==='Category'&&e.items)e.items=e.items.filter(r=>!local(r)||r.id!==id);
  for(const r of params)if(local(r)&&!references(r.id))delete elements[r.id];
 }
 return {kind:'EXACT_EDITOR_OBJECT_SELECTION_FROM_SCALAR_TEMPLATE',records,newNative:0,newScriptCode:0};
}

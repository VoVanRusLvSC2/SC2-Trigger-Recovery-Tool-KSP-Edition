import {entryLocalArrayWrites} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/7ac8088a94c6-entry-local-array-initializers.mjs';
import {requireIssuedStructureIdentity} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/c6b11b549d67-authored-structure-identifiers.issued.mjs';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {createGalaxyDocument} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e735afc2fd5b-galaxy-document.collections.mjs';

const profiles=new WeakMap(), current=new AsyncLocalStorage();
// Carries provenance through object spreads in one conversion. JSON deliberately
// omits the symbol; a later run rebuilds evidence from its actual GUI and Galaxy.
export const authoredInitializerOrigins=Symbol('authored GUI initializer origins');
const sha=text=>createHash('sha256').update(text).digest('hex');
const key=(library,type,id)=>JSON.stringify([library,type,id]);
export const threadedBodyName=name=>`auto_${name}_TriggerFunc`;
function elements(xml,xmlTree,implicitLibrary){
 const result=new Map();if(!xml?.trim())return result;
 function visit(n,library){
  if(n.tag==='Library')library=n.attributes.Id;
  if(n.tag==='Element'){
   const k=key(library,n.attributes.Type,n.attributes.Id);assert(!result.has(k),'DUPLICATE_INITIALIZER_ID');
   result.set(k,{node:n,library,sha256:sha(xml.slice(n.start,n.end))});return;
  }
  for(const child of n.children??[])visit(child,library);
 }
 visit(xmlTree(xml),implicitLibrary);return result;
}
function targetKey(node){
 if(node?.kind===K.ParenthesizedExpression)return targetKey(node.expression);
 if(node?.kind===K.Identifier)return node.name;
 if(node?.kind===K.PropertyAccessExpression){const base=targetKey(node.expression);return base&&base+'.'+node.name.name;}
 if(node?.kind===K.ElementAccessExpression){const base=targetKey(node.expression);return base&&base+'[]';}
}
function defaultValue(node){
 if(node?.kind===K.ParenthesizedExpression)return defaultValue(node.expression);
 if(node?.kind===K.FalseKeyword||node?.kind===K.NullKeyword)return true;
 if(node?.kind===K.Identifier)return node.name==='false'||node.name==='null';
 return node?.kind===K.NumericLiteral&&Number(node.text)===0;
}
export function createAuthoredInitializerOrigins({xml,sources,xmlTree,libraryId='Map'}){
 const original=elements(xml,xmlTree,libraryId),variables=new Map(),presets=new Map(),functions=new Map(),sourcePins=[],sourceIdentifiers=new Set(),sourceReferences=new Set(),customPresets=new Set();
 for(const [k,e]of original)if(['Variable','Preset'].includes(e.node.attributes.Type)){
  const dependencies=new Map(),pending=[e],seen=new Set();let bounded=true;
  while(pending.length){
   const item=pending.pop(),id=key(item.library,item.node.attributes.Type,item.node.attributes.Id);
   if(seen.has(id))continue;seen.add(id);if(seen.size>4096){bounded=false;break;}
   dependencies.set(id,item.sha256);
   function references(n){for(const child of n.children??[]){const a=child.attributes??{};
    if(a.Type&&a.Id){const found=original.get(key(a.Library??item.library,a.Type,a.Id));if(found)pending.push(found);}
    references(child);
   }}
   references(item.node);
  }
  if(bounded)(e.node.attributes.Type==='Variable'?variables:presets).set(k,dependencies);
 }
 for(const [id,e]of original)if(e.node.attributes.Type==='Preset'&&e.node.children.some(c=>c.tag==='PresetCustom')&&!e.node.children.some(c=>c.tag==='PresetInteger'))customPresets.add(id);
 for(const file of sources){
  sourcePins.push({fileName:file.fileName,sha256:sha(file.text)});
  const document=createGalaxyDocument({fileName:file.fileName,text:file.text});
  try{
   const declarations=new Set(document.ast.statements.filter(n=>n.kind===K.VariableDeclaration));
   const identifiers=(n,parent)=>{if(n.kind===K.Identifier){sourceIdentifiers.add(n.name);if(!(parent?.name===n&&declarations.has(parent)))sourceReferences.add(n.name);}forEachChild(n,c=>identifiers(c,n));};identifiers(document.ast);
   for(const fn of document.ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
   const name=fn.name.name;
   if(functions.has(name)){functions.set(name,undefined);continue;}
   const writes=new Set(),entryWrites=new Set();
   function visit(n,output){
    if(n.kind===K.BinaryExpression&&n.operatorToken.kind===K.EqualsToken&&defaultValue(n.right)){
     const target=targetKey(n.left);if(target)output.add(target);
    }else if(n.kind===K.VariableDeclaration&&defaultValue(n.initializer))output.add(n.name.name);
    forEachChild(n,child=>{visit(child,output);});
   }
   visit(fn.body,writes);
   // Scalar local metadata initializes at function entry. A later action which
   // sets that local to zero is a different store and must not create an extra
   // metadata write before trigger guards. Arrays/structures stay conservative.
   for(const statement of fn.body.statements){
    const expression=statement.kind===K.ExpressionStatement?statement.expression:undefined;
    if(statement.kind!==K.VariableDeclaration&&!(expression?.kind===K.BinaryExpression&&expression.operatorToken.kind===K.EqualsToken))break;
    visit(statement,entryWrites);
   }
   const entryArrays=entryLocalArrayWrites(fn,{collectDefaultWrites:visit,allWrites:writes});
   functions.set(name,{writes,entryWrites,entryArrays,sha256:sha(file.text.slice(fn.pos,fn.end))});
  }}finally{document.dispose();}
 }
 const token=Object.freeze({kind:'AUTHORED_GUI_INITIALIZER_ORIGINS',xmlSha256:sha(xml),variables:variables.size,
  sources:Object.freeze(sourcePins.map(p=>Object.freeze(p))),persistentCache:false});
 profiles.set(token,{variables,presets,customPresets,functions,libraryId,sourceIdentifiers,sourceReferences,primaryObserved:!!sources[0]?.text.trim(),rawCode:rawCodeFingerprint(original)});return token;
}

export function withAuthoredInitializerOrigins(token,xml,xmlTree,operation,records){
 if(token===undefined)return current.run(undefined,operation);
 const profile=profiles.get(token);assert(profile,'UNTRUSTED_INITIALIZER_ORIGINS');
 const output=elements(xml,xmlTree,profile.libraryId),activeVariables=new Set();
 for(const [k,dependencies]of profile.variables)
  if([...dependencies].every(([id,digest])=>output.get(id)?.sha256===digest))activeVariables.add(k);
 const activePresets=new Set(),referencedValues=new Set();
 if(profile.primaryObserved&&rawCodeFingerprint(output)===profile.rawCode){
  for(const [k,dependencies]of profile.presets)if([...dependencies].every(([id,digest])=>output.get(id)?.sha256===digest))activePresets.add(k);
 }
 for(const e of output.values())if(e.node.attributes.Type!=='Preset'){
  const visit=n=>{for(const c of n.children??[]){if(c.attributes.Type==='PresetValue')referencedValues.add(key(c.attributes.Library??e.library,'PresetValue',c.attributes.Id));visit(c);}};visit(e.node);
 }
 const parent=current.getStore();
 const scope={profile,activeVariables,activePresets,referencedValues,xml,records:records??(parent?.active&&parent.profile===profile?parent.records:[]),active:true};
 return current.run(scope,async()=>{try{return await operation();}finally{scope.active=false;}});
}

// Existing Editor metadata uses the Editor's default omission rule. A new or
// changed GUI variable, an unknown source function, or an actual source write
// of that default keeps the previous explicit-write behavior. No runtime action
// is removed: this predicate controls metadata initialization only.
export function shouldEmitInitializerByOrigin(variable,value,context,editorPredicate,explicitPredicate){
 const fallback=()=>explicitPredicate(variable,value),scope=current.getStore();
 if(!scope?.active||!value||!variable?.initialValue)return fallback();
 const {owner=variable,libraryId,sourceFunction,target,storage,dimensions=0}=context;
 const memberKey=key(variable.library??libraryId,'Variable',variable.id);
 const ownerKey=key(owner.library??libraryId,'Variable',owner.id);
 if(!scope.activeVariables.has(memberKey)||!scope.activeVariables.has(ownerKey)||editorPredicate(value))return fallback();
 const fn=scope.profile.functions.get(sourceFunction),base=targetKey(target);
 if(!fn||!base)return fallback();
 const address=base+'[]'.repeat(Number.isInteger(dimensions)&&dimensions>0?dimensions:0);
 const written=storage==='local'?(dimensions===0?fn.entryWrites:fn.entryArrays.writes):fn.writes;
 if(written.has(address))return fallback();
 scope.records.push({libraryId,variableId:variable.id,ownerId:owner.id,storage,sourceFunction,target:address,
  sourceFunctionSha256:fn.sha256,...(storage==='local'&&dimensions>0?{entryQualification:fn.entryArrays.qualification}:{}),origin:'UNCHANGED_AUTHORED_GUI',decision:'OMIT_EDITOR_DEFAULT_METADATA',runtimeActionsChanged:false});
 return false;
}

function rawCodeFingerprint(index){
 const entries=[];
 for(const [id,e] of index){
  let raw=false;const visit=n=>{if(n.tag==='ScriptCode')raw=true;for(const c of n.children??[])visit(c);};visit(e.node);
  if(raw)entries.push([id,e.sha256]);
 }
 return JSON.stringify(entries.sort((a,b)=>a[0].localeCompare(b[0])));
}

// An unused authored preset must not introduce a new global initializer. This
// permission is narrower than PresetCustom: an unchanged source graph, no source
// symbol, no current GUI reference and no possible textual expression use are
// all required for ordinary presets. Source-bound Custom Presets retain their
// live value expression when the original never used a generated symbol.
// New/changed/exported constants keep prior emission.
export function shouldEmitPresetConstantByOrigin(preset,value,{libraryId,name}){
 const scope=current.getStore();if(!scope?.active||!name||preset.generateIdentifier)return true;
 const owner=key(preset.library??libraryId,'Preset',preset.id);
 const entry=key(value.library??preset.library??libraryId,'PresetValue',value.id);
 if(!scope.activePresets.has(owner)||scope.profile.sourceIdentifiers.has(name)||scope.xml.includes(name))return true;
 const custom=scope.profile.customPresets.has(owner);
 if(!custom&&scope.referencedValues.has(entry))return true;
 scope.records.push({libraryId,presetId:preset.id,valueId:value.id,constantName:name,
  origin:'UNCHANGED_AUTHORED_GUI',decision:custom?'INLINE_AUTHORED_CUSTOM_PRESET_WITHOUT_SOURCE_SYMBOL':'OMIT_UNREFERENCED_ABSENT_SOURCE_PRESET_CONSTANT',runtimeActionsChanged:false});
 return false;
}

// Declaration presence and use form are distinct: an authored generated constant
// may exist while a Custom Preset still reads its live expression at a GUI use.
export function shouldInlineCustomPresetByOrigin(preset,value,{libraryId,name}){
 const scope=current.getStore();if(!scope?.active||!name||preset.generateIdentifier)return false;
 const owner=key(preset.library??libraryId,'Preset',preset.id);
 if(!scope.activePresets.has(owner)||!scope.profile.customPresets.has(owner)||scope.profile.sourceReferences.has(name)||scope.xml.includes(name))return false;
 scope.records.push({libraryId,presetId:preset.id,valueId:value.id,constantName:name,
  origin:'UNCHANGED_AUTHORED_GUI',decision:'PRESERVE_AUTHORED_LIVE_CUSTOM_PRESET_USE',runtimeActionsChanged:false});
 return true;
}

// A type's script spelling does not change its existing GUI field/initializer
// graph. Transport only hashes of structures changed by an issued lossless
// declaration transaction; retain all original variable and source identities.
export function transportAuthoredInitializerOrigins(token,{beforeXml,afterXml,xmlTree,proof}){
 if(token===undefined)return;
 const profile=profiles.get(token);assert(profile,'UNTRUSTED_INITIALIZER_ORIGINS');
 assert.equal(sha(beforeXml),token.xmlSha256,'INITIALIZER_ORIGIN_BEFORE_XML_CHANGED');
 const records=requireIssuedStructureIdentity(proof,beforeXml,afterXml);
 const before=elements(beforeXml,xmlTree,profile.libraryId),after=elements(afterXml,xmlTree,profile.libraryId);
 assert.equal(before.size,after.size,'INITIALIZER_ORIGIN_ELEMENT_COUNT_CHANGED');
 const changed=new Map(records.map(r=>[key(r.library,'Structure',r.id),r]));
 assert.equal(changed.size,records.length,'INITIALIZER_ORIGIN_DUPLICATE_STRUCTURE');
 for(const [id,entry]of before){
  assert(after.has(id),'INITIALIZER_ORIGIN_ELEMENT_REMOVED');
  if(!changed.has(id))assert.equal(after.get(id).sha256,entry.sha256,'INITIALIZER_ORIGIN_UNRELATED_ELEMENT_CHANGED');
 }
 assert.equal(rawCodeFingerprint(before),rawCodeFingerprint(after),'INITIALIZER_ORIGIN_RAW_CODE_CHANGED');
 const carry=index=>new Map([...index].map(([id,dependencies])=>[id,new Map([...dependencies].map(([dependency,digest])=>{
  if(!changed.has(dependency))return [dependency,digest];
  assert.equal(digest,before.get(dependency)?.sha256,'INITIALIZER_ORIGIN_DEPENDENCY_NOT_ORIGINAL');
  return [dependency,after.get(dependency).sha256];
 }))]));
 const next=Object.freeze({...token,xmlSha256:sha(afterXml),typeIdentityTransport:Object.freeze({
  beforeXmlSha256:sha(beforeXml),afterXmlSha256:sha(afterXml),structures:records.length,
  originalVariableIdsRetained:true,newVariablesClassifiedAsAuthored:0,sourceFunctionsUnchanged:true})});
 profiles.set(next,{...profile,variables:carry(profile.variables),presets:carry(profile.presets)});
 return next;
}

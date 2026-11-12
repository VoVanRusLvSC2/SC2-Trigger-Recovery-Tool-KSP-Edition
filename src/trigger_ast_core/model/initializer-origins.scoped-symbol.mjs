import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {createGalaxyDocument} from './galaxy-document.collections.mjs';

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
 const original=elements(xml,xmlTree,libraryId),variables=new Map(),functions=new Map(),sourcePins=[];
 for(const [k,e]of original)if(e.node.attributes.Type==='Variable'){
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
  if(bounded)variables.set(k,dependencies);
 }
 for(const file of sources){
  sourcePins.push({fileName:file.fileName,sha256:sha(file.text)});
  const document=createGalaxyDocument({fileName:file.fileName,text:file.text});
  try{for(const fn of document.ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
   const name=fn.name.name;
   if(functions.has(name)){functions.set(name,undefined);continue;}
   const writes=new Set();
   function visit(n){
    if(n.kind===K.BinaryExpression&&n.operatorToken.kind===K.EqualsToken&&defaultValue(n.right)){
     const target=targetKey(n.left);if(target)writes.add(target);
    }else if(n.kind===K.VariableDeclaration&&defaultValue(n.initializer))writes.add(n.name.name);
    forEachChild(n,visit);
   }
   visit(fn.body);functions.set(name,{writes,sha256:sha(file.text.slice(fn.pos,fn.end))});
  }}finally{document.dispose();}
 }
 const token=Object.freeze({kind:'AUTHORED_GUI_INITIALIZER_ORIGINS',xmlSha256:sha(xml),variables:variables.size,
  sources:Object.freeze(sourcePins.map(p=>Object.freeze(p))),persistentCache:false});
 profiles.set(token,{variables,functions,libraryId});return token;
}

export function withAuthoredInitializerOrigins(token,xml,xmlTree,operation,records){
 if(token===undefined)return current.run(undefined,operation);
 const profile=profiles.get(token);assert(profile,'UNTRUSTED_INITIALIZER_ORIGINS');
 const output=elements(xml,xmlTree,profile.libraryId),activeVariables=new Set();
 for(const [k,dependencies]of profile.variables)
  if([...dependencies].every(([id,digest])=>output.get(id)?.sha256===digest))activeVariables.add(k);
 const parent=current.getStore();
 const scope={profile,activeVariables,records:records??(parent?.active&&parent.profile===profile?parent.records:[]),active:true};
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
 if(fn.writes.has(address))return fallback();
 scope.records.push({libraryId,variableId:variable.id,ownerId:owner.id,storage,sourceFunction,target:address,
  sourceFunctionSha256:fn.sha256,origin:'UNCHANGED_AUTHORED_GUI',decision:'OMIT_EDITOR_DEFAULT_METADATA',runtimeActionsChanged:false});
 return false;
}

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readOwnedGuiLibraries} from '../verification/read-owned-gui-libraries.mjs';
import {createGuiCapabilityCatalog} from './gui-capability-catalog.mjs';
import {FunctionCandidateIndex} from '../../map_global_repair_v265_attribute_scalar_codec_2026-10-21/graph/96138b7e78fe2409-function-candidates.mjs';
import {formalGalaxyCarrier} from '../types/formal-galaxy-carrier.mjs';
import {toGalaxyFunctionName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import {Parser,Printer,SyntaxKind as K,isKeywordTypeKind,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const minted=new WeakMap(),sha=x=>createHash('sha256').update(x).digest('hex'),printer=new Printer();
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
const signature=n=>({returnType:printer.printNode(n.type),parameters:n.parameters.map(p=>printer.printNode(p.type)),references:n.parameters.map(p=>!!p.isReference)});
const ordinaryNative=d=>d.flags?.includes('Native')&&!d.disabled&&d.scriptCode==null&&d.expressionCode==null&&!d.actions?.length&&!d.localVariables?.length&&!d.isSubFunction&&!d.flags.some(f=>['Event','SubFunctions','Template','Inline','Operator','CreateThread'].includes(f))&&!d.name?.endsWith('Deprecated');
const supportedType=t=>!t||Object.keys(t).every(k=>['type','gameType','typeElement'].includes(k))&&!/^(?:any|sameas|anycompare|anyvariable|return|struct|array|function|funcref|arrayref|structref)$/i.test(t.type??'');
const fullSignature=n=>({...signature(n),modifiers:(n.modifiers??[]).map(m=>m.kind).sort((a,b)=>a-b)});
const finite=type=>{if(typeof type!=='string')return false;const a=new Parser().parseFile('@catalog-type',type+' catalogValue;');const n=a.statements[0];return !a.parseDiagnostics.length&&a.statements.length===1&&n?.kind===K.VariableDeclaration&&isKeywordTypeKind(n.type.kind)&&![K.Identifier,K.TypeReference,K.ArrayType].includes(n.type.kind);};
/** Explicitly pinned, dependency-only metadata. No emitter capability and no
 * claim that metadata-only interfaces are declarations in authored Galaxy. */
export function createNativeGuiSourceInterfaces({dependencyLibraries,verifiedCASCCatalogAuthority,sourceDocuments}){
 assert(verifiedCASCCatalogAuthority?.kind==='VERIFIED_CASC_CATALOG_AUTHORITY'&&verifiedCASCCatalogAuthority.buildIdentity?.buildKey&&verifiedCASCCatalogAuthority.provenance?.kind==='LOADED_DEPENDENCY_CASC_CONTENT_PINS','NATIVE_GUI_CATALOG_AUTHORITY_REQUIRED');
 const catalogPins=verifiedCASCCatalogAuthority.files;assert(Array.isArray(dependencyLibraries)&&Array.isArray(catalogPins)&&catalogPins.length,'NATIVE_GUI_CATALOG_AUTHORITY_REQUIRED');
 const docs=sourceDocuments.map(d=>({fileName:d.fileName,text:d.text,sha256:sha(d.text)})),declarations=new Map(),requested=new Set();
 for(const d of docs){const ast=new Parser().parseFile(d.fileName,d.text);assert.equal(ast.parseDiagnostics.length,0,'SOURCE_SYNTAX_REQUIRED');for(const n of ast.statements)if(n.name?.name){const rows=declarations.get(n.name.name)??[];rows.push(n);declarations.set(n.name.name,rows);}const walk=n=>{if(n.kind===K.CallExpression&&n.expression.kind===K.Identifier)requested.add(n.expression.name);forEachChild(n,walk);};walk(ast);}
 const libraries=new Map(),origins=new Map(),loadedDigests=new Map();
 // Every loaded dependency participates in alias refusal; only separately
 // authenticated owners may contribute ABI facts or carrier witnesses.
 for(const dep of dependencyLibraries){const digest=sha(dep.triggerData);for(const [owner,library]of readOwnedGuiLibraries(dep.triggerData)){assert(!loadedDigests.has(owner)||loadedDigests.get(owner)===digest,'NATIVE_GUI_LOADED_OWNER_AMBIGUOUS');if(!libraries.has(owner)){libraries.set(owner,library);loadedDigests.set(owner,digest);}}}
 for(const pin of catalogPins){assert(pin.libraryId&&pin.libraryId!=='Map'&&verifiedCASCCatalogAuthority.buildIdentity.buildKey&&pin.path&&/^[a-f0-9]{64}$/.test(pin.sha256),'NATIVE_GUI_CASC_PIN_REQUIRED');const matches=dependencyLibraries.filter(d=>d.sourcePath===pin.path);assert.equal(matches.length,1,'NATIVE_GUI_DEPENDENCY_PATH_NOT_UNIQUE');const xml=matches[0].triggerData;assert.equal(sha(xml),pin.sha256,'NATIVE_GUI_CATALOG_PIN_MISMATCH');assert(libraries.has(pin.libraryId)&&loadedDigests.get(pin.libraryId)===pin.sha256,'NATIVE_GUI_PIN_LIBRARY_MISSING');assert(!origins.has(pin.libraryId),'NATIVE_GUI_DUPLICATE_OWNER');origins.set(pin.libraryId,{path:pin.path,sha256:pin.sha256,buildIdentity:structuredClone(verifiedCASCCatalogAuthority.buildIdentity),provenance:structuredClone(verifiedCASCCatalogAuthority.provenance)});}
 const catalog=createGuiCapabilityCatalog(libraries);assert.equal(catalog.issues.length,0,'NATIVE_GUI_CATALOG_AMBIGUOUS');const indexed=[...libraries].map(([id,l])=>{const elementsByType={};for(const e of new Set(Object.values(l.elements)))(elementsByType[e.type]??={})[e.id]=e;return {...l,elementsByType};});const index=new FunctionCandidateIndex(indexed),names=new Map();
 // One invocation-local naming index per owner context; dependency XML and all name collisions still participate.
 for(const [owner,lib]of libraries){const naming={library:lib,libId:owner,nativeLibrary:libraries.get('Ntve'),allLibraries:libraries,functionNameGroups:new WeakMap()};for(const def of new Set(Object.values(lib.elements))){if(def.type!=='FunctionDef')continue;const name=toGalaxyFunctionName(def,naming);const rows=names.get(name)??[];rows.push({owner,lib,def});names.set(name,rows);}}
 // Editor-only carriers require unanimous positional evidence from ALL real
 // declarations of a genuine native, never a first matching prototype.
 const votes=new Map(),typeKey=(t,owner)=>JSON.stringify(t?.typeElement?{...t,typeElement:{library:t.typeElement.library??owner,type:t.typeElement.type,id:t.typeElement.id}}:t??{type:'void'});
 const typeShape=(t,owner)=>supportedType(t)&&(!/^(?:any|sameas)/i.test(t?.type??'')||finite(index.carrier(t,libraries.get(owner))))&&(!t?.typeElement||t.type==='preset'&&t.typeElement.type==='Preset'&&origins.has(t.typeElement.library??owner)&&!!catalog.resolve(t.typeElement,owner,'Preset'));
 const baseCarrier=(t,lib)=>typeShape(t,lib.id)?index.carrier(t,lib):undefined;
 // A ParamDef owns its local type/preset references, even when a FunctionDef
 // imports that ParamDef from another library. Both donor and target use this.
 const formalShape=(def,owner)=>{
  const seen=new Set(),result=[];
  for(const ref of def.parameters??[]){const formalOwner=ref.library??owner,p=catalog.resolve(ref,owner,'ParamDef'),lib=libraries.get(formalOwner),key=JSON.stringify([formalOwner,'ParamDef',ref.id]);
   if(ref.type!=='ParamDef'||!origins.has(formalOwner)||!p||!lib||seen.has(key)||!typeShape(p.paramType,formalOwner)||p.isMultiple||p.isReference&&p.paramType?.type!=='unit')return;
   seen.add(key);result.push({p,lib,owner:formalOwner,definition:{library:formalOwner,type:'ParamDef',id:p.id},base:p.isReference?formalGalaxyCarrier(index,p,lib,def):baseCarrier(p.paramType,lib)});
  }
  return result;
 };
 const vote=(t,value,owner)=>{if(!finite(value))return;const key=typeKey(t,owner),values=votes.get(key)??new Set();values.add(value);votes.set(key,values);};
 for(const [name,rows]of names){if(rows.length!==1)continue;const {owner,lib,def}=rows[0],source=declarations.get(name)??[];
  if(!source.length||!origins.has(owner)||!ordinaryNative(def)||!typeShape(def.returnType,owner))continue;
  if(source.some(n=>n.kind!==K.FunctionDeclaration||n.body||(!n.modifiers?.length||n.modifiers.some(m=>m.kind!==K.NativeKeyword))||n.parameters.some(p=>p.isReference)))continue;
  const sig=signature(source[0]),shape=formalShape(def,owner);
  if(!shape||source.some(n=>JSON.stringify(fullSignature(n))!==JSON.stringify(fullSignature(source[0])))||sig.parameters.length!==shape.length)continue;
  const resultBase=def.returnType?baseCarrier(def.returnType,lib):'void';
  // Check the entire donor BEFORE recording any unknown editor-carrier vote.
  if(finite(resultBase)&&resultBase!==sig.returnType||shape.some((f,i)=>finite(f.base)&&f.base!==sig.parameters[i])||!finite(sig.returnType)||sig.parameters.some(t=>!finite(t)||t==='void'))continue;
  vote(def.returnType,sig.returnType,owner);shape.forEach((f,i)=>{if(!f.p.isReference)vote(f.p.paramType,sig.parameters[i],f.owner);});
 }
 const carrierFor=(t,lib)=>{const base=baseCarrier(t,lib),observed=votes.get(typeKey(t,lib.id));if(!typeShape(t,lib.id)||observed?.size>1)return undefined;if(finite(base))return observed?.size===1&&!observed.has(base)?undefined:base;return observed?.size===1?[...observed][0]:undefined;};
 const records=[],refused=[];
 for(const name of requested){const candidates=names.get(name);if(!candidates)continue;const fail=reason=>refused.push({name,reason});if(candidates.length!==1){fail('AMBIGUOUS_NATIVE_RUNTIME_NAME');continue;}const {owner,lib,def}=candidates[0];if(!origins.has(owner)||!ordinaryNative(def)){fail('NOT_ORDINARY_DIRECT_NATIVE');continue;}
 const shape=formalShape(def,owner),formals=[];let bad=!shape;
 for(const f of shape??[]){const carrier=f.p.isReference?f.base:carrierFor(f.p.paramType,f.lib);if(!finite(carrier)||carrier==='void'){bad=true;break;}formals.push({definition:f.definition,guiType:structuredClone(f.p.paramType),isReference:!!f.p.isReference,carrier});}
 const returnType=def.returnType?carrierFor(def.returnType,lib):'void';if(bad||!typeShape(def.returnType,owner)||!finite(returnType)){fail(declarations.has(name)?'REAL_DECLARATION_CONFLICT':'UNSUPPORTED_OR_UNRESOLVED_NATIVE_ABI');continue;}
 const abi={returnType,parameters:formals.map(f=>f.carrier),references:formals.map(()=>false)},existing=declarations.get(name)??[];
 if(existing.length){if(new Set(existing.filter(n=>n.kind===K.FunctionDeclaration).map(n=>JSON.stringify(fullSignature(n)))).size>1||existing.some(n=>n.kind!==K.FunctionDeclaration||n.body||(!n.modifiers?.length||n.modifiers.some(m=>m.kind!==K.NativeKeyword))||JSON.stringify(signature(n))!==JSON.stringify(abi)))fail('REAL_DECLARATION_CONFLICT');continue;}
 records.push({kind:'CATALOG_DERIVED_NATIVE_INTERFACE',name,definition:{library:owner,type:'FunctionDef',id:def.id},catalog:origins.get(owner),returnGuiType:structuredClone(def.returnType??{type:'void'}),formals,signature:abi,owned:false,interfaceOnly:true,sourceDeclaration:false,engineAvailabilityProved:false});
 }
 const report=freeze({kind:'PINNED_NATIVE_GUI_SOURCE_INTERFACES',records,refused,reconstructedFromDependencyCatalog:true,newNative:0,newRuntimeFunctions:0,newCustomScript:0,sourceChanged:false,engineAvailabilityProved:false});minted.set(report,{documents:docs.map(({fileName,sha256})=>({fileName,sha256})),records});return report;
}
/** A minted fact set is valid only for the exact source/declaration closure. */
export function nativeGuiInterfacesFor(model,sourceDocuments){const value=minted.get(model);assert(value,'UNTRUSTED_NATIVE_GUI_INTERFACES');assert.deepEqual(sourceDocuments.map(d=>({fileName:d.fileName,sha256:sha(d.text)})),value.documents,'NATIVE_GUI_SOURCE_SNAPSHOT_CHANGED');return value.records;}


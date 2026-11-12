import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,Printer,SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {globalVarName,triggerHandleName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import {withImplicitLibrary} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const parse=(text,name)=>{const a=new Parser().parseFile(name,text);assert.equal(a.parseDiagnostics.length,0,'SOURCE_MIRROR_SYNTAX');return a;};
const qualified=new Set(['trigger','unit','point','int']);
const key=(library,type,id)=>JSON.stringify([library,type,id]);

/** Discovery only, never a GUI mutation or acceptance decision. Candidate
 * identities must still pass original-source ownership, GUI formal ABI,
 * include/global-initializer order, native export and whole-program proofs. */
export function inspectSourceGlobalMirrorCandidates({original,exported,guiLibraries,library='Map',existingTriggerData=false}){
 assert(typeof original==='string'&&typeof exported==='string');
 const result={kind:'SOURCE_BOUND_GUI_MIRROR_CANDIDATES',originalSha256:sha(original),exportedSha256:sha(exported),library,candidates:[],refused:[],guiPatchAuthorized:false,wholeMapAccepted:false};
 if(existingTriggerData)return {...result,reason:'PRESERVE_EXISTING_GUI_STRUCTURE'};
 const gui=guiLibraries.get(library);assert(gui,'SOURCE_MIRROR_GUI_LIBRARY_REQUIRED');
 const originalAst=parse(original,'source-mirror-original'),exportedAst=parse(exported,'source-mirror-export');
 const globals=originalAst.statements.filter(n=>n.kind===K.VariableDeclaration),nativeGlobals=exportedAst.statements.filter(n=>n.kind===K.VariableDeclaration);
 const sourceNames=new Set();for(const n of globals){assert(!sourceNames.has(n.name.name),'SOURCE_MIRROR_AMBIGUOUS_GLOBAL');sourceNames.add(n.name.name);}
 const all=[...new Set(Object.values(gui.elements))],rootVariables=new Set(),visited=new Set();
 function visitRoot(reference){
  const owner=reference.library??library;if(owner!==library||!reference.type||!reference.id)return;
  const id=key(owner,reference.type,reference.id);if(visited.has(id))return;visited.add(id);
  const matches=[...new Set([gui.elements[reference.type+':'+reference.id],gui.elements[reference.id]].filter(e=>e?.type===reference.type))];
  if(matches.length!==1)return;const e=matches[0];
  if(e.type==='Variable')rootVariables.add(id);else if(e.type==='Category')for(const child of e.items??[])visitRoot(child);
 }
 for(const item of gui.items??[])visitRoot(item);
 const vars=all.filter(e=>e.type==='Variable'&&rootVariables.has(key(e.library??library,e.type,e.id)));
 const byIdentifier=new Map(),byEmitted=new Map();
 for(const v of vars){
  const identity=v.identifier??v.name;if(typeof identity!=='string')continue;
  const emitted=withImplicitLibrary(library,()=>globalVarName(library,v));
  for(const [index,k]of [[byIdentifier,identity],[byEmitted,emitted]]){const rows=index.get(k)??[];rows.push(v);index.set(k,rows);}
 }
 const refs=new Map();for(const p of all.filter(e=>e.type==='Param'&&e.variable)){
  const r=p.variable,k=key(r.library??p.library??library,r.type,r.id),rows=refs.get(k)??[];rows.push(p);refs.set(k,rows);
 }
 const init=exportedAst.statements.find(n=>n.kind===K.FunctionDeclaration&&n.name?.name==='InitGlobals'&&n.body),assignments=new Map();
 for(const stmt of init?.body.statements??[]){const e=stmt.kind===K.ExpressionStatement?stmt.expression:undefined;
  if(e?.kind!==K.BinaryExpression||e.operatorToken.kind!==K.EqualsToken||e.left.kind!==K.Identifier)continue;
  const rows=assignments.get(e.left.name)??[];rows.push(e.right);assignments.set(e.left.name,rows);
 }
 const nativeByName=new Map();for(const n of nativeGlobals){const rows=nativeByName.get(n.name.name)??[];rows.push(n);nativeByName.set(n.name.name,rows);}
 for(const n of globals){
  const name=n.name.name,type=printer.printNode(n.type),candidates=type==='trigger'?(byIdentifier.get(name)??[]):(byEmitted.get(name)??[]);
  if(candidates.length!==1)continue;const v=candidates[0],id=key(v.library??library,'Variable',v.id),params=refs.get(id)??[];
  const reject=reason=>result.refused.push({name,gui:{library:v.library??library,type:v.type,id:v.id},reason});
  if(v.variableType?.type!==type||v.isArray||v.isConstant||n.modifiers?.length||!qualified.has(type)){reject('CARRIER_OR_STORAGE_NOT_QUALIFIED');continue;}
  const emitted=withImplicitLibrary(library,()=>globalVarName(library,v)),actual=nativeByName.get(emitted)??[];
  if(actual.length!==1||printer.printNode(actual[0].type)!==type){reject('ACTUAL_NATIVE_STORAGE_NOT_UNIQUE_OR_TYPED');continue;}
  let representation;
  if(type==='trigger'&&name!==emitted&&!n.initializer){
   const prefix=withImplicitLibrary(library,()=>triggerHandleName(library,{identifier:''}));
   if(!name.startsWith(prefix)){reject('TRIGGER_NAME_NOT_EXACTLY_REPRESENTABLE');continue;}
   const stem=name.slice(prefix.length),handle=withImplicitLibrary(library,()=>triggerHandleName(library,{identifier:stem}));
   if(!stem||handle!==name||all.some(e=>e.type==='Trigger'&&withImplicitLibrary(library,()=>triggerHandleName(e.library??library,e))===name)){reject('TRIGGER_IDENTITY_COLLISION_OR_INVALID_STEM');continue;}
   representation='DISABLED_TRIGGER_REFERENCE_ONLY';
  }else if(name===emitted&&n.initializer&&!actual[0].initializer){
   const stores=assignments.get(name)??[];if(stores.length!==1||printer.printNode(stores[0])!==printer.printNode(n.initializer)){reject('INITIALIZER_NOT_EXACTLY_MOVED_TO_INITGLOBALS');continue;}
   representation='DISABLED_TYPED_VARIABLE_REFERENCE_ONLY';
  }else continue;
  result.candidates.push({sourceName:name,sourceType:type,sourceDeclaration:original.slice(n.pos,n.end),sourceDeclarationSha256:sha(original.slice(n.pos,n.end)),gui:{library:v.library??library,type:'Variable',id:v.id,identifier:v.identifier??v.name},nativeEmittedName:emitted,representation,
   references:params.map(p=>({library:p.library??library,type:p.type,id:p.id,parameterDef:p.parameterDef??null})),
   requiredProofs:['ALL_GUI_REFERENCES_AND_PARAMDEF_ABIS','ORIGINAL_INCLUDE_AND_GLOBAL_INITIALIZER_ORDER','NO_DUPLICATE_OR_EXTRA_STARTUP_EFFECTS','ACTUAL_NATIVE_EXPORT','COMPLETE_PROGRAM_AND_ATTRIBUTES']});
 }
 return result;
}

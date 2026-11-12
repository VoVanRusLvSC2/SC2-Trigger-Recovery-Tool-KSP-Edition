import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readOwnedGuiLibraries} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/read-owned-gui-libraries.mjs';
import {partitionDeclarationViews,logicalSourcePath} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/source-ownership.mjs';
import {GalaxyProgramContext} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/galaxy-program-context.lexical-parameters.mjs';
import {boundStorageShape} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/bound-storage-shape.source-axes.mjs';
import {removeAlreadyLoadedOwnedIncludes} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/passes/owned-include-closure.mjs';
import {SyntaxKind as K,tokenToString} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),key=(r,lib)=>JSON.stringify([r.library??lib,r.type,r.id]);
const typeRef=t=>t?.type==='struct'&&t.typeElement?.type==='Structure'?t.typeElement:undefined;

/** Independent metadata/source ABI check. It reads serialized type/member IDs,
 * source bodies and explicit include resolution; no emitter receipt is used. */
export function verifyLocalSourceStructureAbi(input,xml){
 const libraries=readOwnedGuiLibraries(xml,input.libraryId??'Map'),locals=new Set(),types=new Map(),memberOwners=new Map(),parameterOwners=new Map();
 for(const [lib,data]of libraries)for(const e of Object.values(data.elements)){
  for(const r of e.localVariables??[]){locals.add(key(r,lib));const v=data.elementsByType.Variable?.[r.id],t=typeRef(v?.variableType);if(t)types.set(key(t,lib),{ref:t,lib});}
  if(e.type==='Structure')for(const r of e.variables??[])memberOwners.set(key(r,lib),e);
  if(e.type==='FunctionDef')for(const r of e.parameters??[])parameterOwners.set(key(r,lib),e);
 }
 const base={kind:'INDEPENDENT_LOCAL_SOURCE_STRUCTURE_ABI',passed:true,records:[],emitterReceiptsUsed:false,actualEditor:false,wholeMapAccepted:false};
 if(!types.size||!input.additionalScripts?.length)return base;
 const owned=input.additionalScripts,views=partitionDeclarationViews(owned,input.galaxyDeclarations??[]);assert.equal(views.conflicts.length,0,'LOCAL_SOURCE_ABI_SOURCE_VIEW_CONFLICT');
 const rootName=input.documentKind==='library'?'Lib'+(input.libraryId??'Map')+'.galaxy':'MapScript.galaxy';
 const root={fileName:rootName,text:[input.header,input.script].filter(Boolean).join('\n')};
 const sources=[{...root,owned:true},...owned.map(f=>({...f,fileName:logicalSourcePath(f.originalPath??f.fileName),owned:true})),...views.external.map(f=>({...f,owned:false}))];
 const files=sources.map((f,i)=>({...f,sourceId:'source-abi:'+i,contentSha256:sha(f.text)}));
 const program=new GalaxyProgramContext(files,{files},sha,{checks:'binding'});
 try{
  for(const ast of program.documents.values()){assert.equal(ast.parseDiagnostics.length,0,'LOCAL_SOURCE_ABI_SOURCE_SYNTAX');program.attachOriginal(ast);}
  const originalTypes=new Map();for(const f of owned){const name=logicalSourcePath(f.originalPath??f.fileName),ast=program.documents.get(name);assert(ast);
   for(const n of ast.statements)if(n.kind===K.StructDeclaration){const list=originalTypes.get(n.name.name)??[];list.push({node:n,file:name,sha256:sha(f.text)});originalTypes.set(n.name.name,list);}
  }
  let closure;
  for(const {ref,lib}of types.values()){
   const data=libraries.get(ref.library??lib),structure=data?.elementsByType.Structure?.[ref.id];assert(structure,'LOCAL_SOURCE_ABI_TYPE_REFERENCE');
   const prefix=(structure.library==='Map'&&input.documentKind!=='library')?'gs_':'lib'+structure.library+'_gs_';
   const name=prefix+(structure.identifier??structure.name),matches=originalTypes.get(name);if(!matches){assert(!structure.disabled,'LOCAL_SOURCE_ABI_SOURCE_TYPE_IDENTITY_UNRESOLVED');continue;}
   assert.equal(matches.length,1,'LOCAL_SOURCE_ABI_NOMINAL_OWNER_AMBIGUOUS');const source=matches[0];
   assert(structure.disabled,'LOCAL_SOURCE_ABI_RUNTIME_TYPE_DUPLICATED');
   closure??=removeAlreadyLoadedOwnedIncludes({root,ownedSources:owned,externalSources:views.external,includeEvidence:input.includeEvidence,includeRoot:false}).proof;
   assert(closure.completeReachableClosure===true&&Array.isArray(closure.resolvedFiles),'LOCAL_SOURCE_ABI_COMPLETE_INCLUDE_CLOSURE_REQUIRED');
   const reached=closure.resolvedFiles.filter(f=>logicalSourcePath(f.path)===source.file);assert(reached.length&&reached.every(f=>f.sha256===source.sha256),'LOCAL_SOURCE_ABI_TYPE_NOT_REACHABLE');
   const fieldRefs=structure.variables??[];
   if(fieldRefs.length){assert.equal(fieldRefs.length,source.node.members.length,'LOCAL_SOURCE_ABI_FIELD_CARDINALITY');
    for(const [i,r]of fieldRefs.entries()){
     const field=data.elementsByType.Variable?.[r.id],decl=source.node.members[i];assert(field&&field.library===structure.library,'LOCAL_SOURCE_ABI_FIELD_OWNER');
     assert.equal(key(r,lib),key({library:field.library,type:'Variable',id:field.id},lib),'LOCAL_SOURCE_ABI_FIELD_ID');
     assert.equal('lv_'+field.identifier,decl.name.name,'LOCAL_SOURCE_ABI_MEMBER_SPELLING');
     assert(!field.flags?.length&&!field.initialValue&&!field.isArray&&!field.isConstant,'LOCAL_SOURCE_ABI_MEMBER_RUNTIME_STATE');
     const shape=boundStorageShape(program,decl.type);assert(shape.status==='RESOLVED'&&!shape.rank&&!shape.nominal,'LOCAL_SOURCE_ABI_SCALAR_FIELD');
     assert.deepEqual(Object.fromEntries(Object.entries(field.variableType).filter(([,value])=>value!==undefined)),{type:tokenToString(shape.node.kind)},'LOCAL_SOURCE_ABI_MEMBER_TYPE');
    }
   }
   // Check the actual GUI declaration phases, independently of source planning.
   const target=key({library:structure.library,type:'Structure',id:structure.id},lib);
   for(const [scope,library]of libraries)for(const e of Object.values(library.elements)){
    const t=typeRef(e.variableType??e.paramType??e.returnType);if(!t||key(t,scope)!==target)continue;
    if(e.type==='Variable')assert(locals.has(key(e,scope))&&!memberOwners.has(key(e,scope)),'LOCAL_SOURCE_ABI_GLOBAL_OR_MEMBER_HEADER_ORDER');
    else if(e.type==='ParamDef'){const owner=parameterOwners.get(key(e,scope));assert(owner?.flags?.includes('Operator')&&!owner.actions?.length,'LOCAL_SOURCE_ABI_PARAMETER_HEADER_ORDER');}
    else if(e.type==='FunctionDef')assert(e.flags?.includes('Operator')&&!e.actions?.length,'LOCAL_SOURCE_ABI_RETURN_HEADER_ORDER');
   }
   base.records.push({type:{library:structure.library,type:'Structure',id:structure.id},name,sourceFile:source.file,sourceSha256:source.sha256,
    fieldsChecked:fieldRefs.length,opaqueReferenceOnly:fieldRefs.length===0,sourceDefinitionRetained:true,duplicateRuntimeType:false,guiHeaderConsumersAbsent:true,nativeQualification:'NOT_RUN'});
  }
  return base;
 }finally{program.dispose();}
}

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Printer,SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {withImplicitLibrary,globalVariables,globalVariableNames} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {triggerHandleName,toGalaxyFunctionName,namingIndexes,withNamingIndexes} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/a8e17466d0b6-cc6e32b546f5-ttg-core.js';
import {indexGuiDeclarationOwnership} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/gui-declaration-ownership.mjs';
import {boundDeclarationOrigin} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/7b0a730b72b5-bound-declaration-origin.mjs';
import {unwrapArrayType} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/5525aadcbc5a-99a6b4ba322b-eebfe085e3ed-d14d4b948618471b-g2t-core.mjs';
const printer=new Printer(),key=(r,owner)=>JSON.stringify([r.library??owner,r.type,r.id]);
const restricted=new Set(['Native','Event','Operator','CustomScript']);
const supportedCarrier=s=>typeof s==='string'&&/^[_A-Za-z]\w*$/u.test(s);
const catalogs=new WeakMap(),abiFields=['type','id','library','name','identifier','flags','variableType','returnType','paramType','parameters','localVariables','variables','items','arraySizes','isArray','isConstant','isReference','isFuncEvent','isFuncAction','isFuncCall','isSubFunction','disabled'];
const snapshot=libraries=>{
 const hash=createHash('sha256');for(const [owner,library]of libraries){
  hash.update(JSON.stringify([owner,library.id,library.rootRefs??library.items??[]]));
  for(const e of new Set(Object.values(library.elements)))if(['Variable','FunctionDef','ParamDef','Trigger','Structure','Category','Preset','PresetValue'].includes(e.type))
   hash.update(JSON.stringify(Object.fromEntries(abiFields.filter(k=>e[k]!==undefined).map(k=>[k,e[k]]))));
 }return hash.digest('hex');
};
export function assertGuiEmittedDeclarationFrontierSnapshot(catalog){
 const state=catalogs.get(catalog);assert(state,'GUI_FRONTIER_UNTRUSTED_CATALOG');
 assert.equal(snapshot(state.libraries),state.sha256,'GUI_FRONTIER_GRAPH_CHANGED');
}
export function resolveGuiEmittedDeclarationFrontier(catalog,program,declaration){
 assert(catalogs.has(catalog),'GUI_FRONTIER_UNTRUSTED_CATALOG');return catalog.resolve(program,declaration);
}

// Model expected GUI declarations, not arbitrary identifier substitutions. A
// Trigger owns its implicit handle; it is never a Variable with a similar name.
// The returned ABI/ownership facts alone cannot authorize component emission.
export function indexGuiEmittedDeclarationFrontier({libraries,implicitLibraryId='Map',carrier}){
 assert(libraries instanceof Map&&typeof carrier==='function','GUI_FRONTIER_TYPED_LIBRARIES_REQUIRED');
 const symbols=new Map(),scopes=new Map(),catalogIssues=[],identities=new Map();
 for(const [owner,library]of libraries)for(const e of new Set(Object.values(library.elements))){
  const id=key(e,owner),rows=identities.get(id)??[];rows.push(e);identities.set(id,rows);
 }
 const add=(name,row)=>{const rows=symbols.get(name)??[];rows.push(row);symbols.set(name,rows);};
 const resolve=(ref,owner,type)=>{
  if(ref.type!==type)return;
  const rows=identities.get(key(ref,owner));return rows?.length===1?rows[0]:undefined;
 };
 withNamingIndexes(()=>{
  for(const [owner,library]of libraries){
   const ownership=indexGuiDeclarationOwnership({elements:library.elements,library:owner,rootRefs:library.rootRefs??library.items??[]});
   scopes.set(owner,new Map(ownership.records.map(r=>[JSON.stringify(r.identity),r])));catalogIssues.push(...ownership.issues.map(i=>({library:owner,...i})));
   const index=()=>{
    const variables=globalVariables(library),names=globalVariableNames(owner,variables);
    for(const e of new Set(Object.values(library.elements))){
     if((e.library??owner)!==owner)continue;
     const identity={library:owner,type:e.type,id:e.id},scope=scopes.get(owner).get(key(e,owner));
     try{
      if(e.type==='Variable'&&names.has(e.id))add(names.get(e.id),{identity,e,scope,projection:'GLOBAL_VARIABLE',carrier:carrier(e.variableType,owner),constant:!!e.isConstant});
      if(e.type==='Trigger')add(triggerHandleName(owner,e),{identity,e,scope,projection:'TRIGGER_HANDLE',carrier:'trigger',constant:false});
      if(e.type==='FunctionDef'){
       const ctx={libId:owner,library,allLibraries:libraries,...namingIndexes()};
       const name=toGalaxyFunctionName(e,ctx),parameters=(e.parameters??[]).map(ref=>{
        if(ref.type!=='ParamDef')return;
        const formal=resolve(ref,owner,'ParamDef');if(!formal)return;
        const formalScope=scopes.get(formal.library??owner)?.get(key(formal,owner));
        if(formalScope?.scope!=='PARAMETER'||JSON.stringify(formalScope.lexicalOwner)!==key(e,owner))return;
        return {identity:{library:formal.library??owner,type:'ParamDef',id:formal.id},carrier:carrier(formal.paramType,formal.library??owner),reference:!!formal.isReference};
       });
       add(name,{identity,e,scope,projection:'ORDINARY_FUNCTION',carrier:carrier(e.returnType??{type:'void'},owner),parameters});
      }
     }catch(error){catalogIssues.push({library:owner,identity,code:'GUI_FRONTIER_DECLARATION_CARRIER_UNRESOLVED',reason:error.message});}
    }
   };
   if(owner===implicitLibraryId)withImplicitLibrary(owner,index);else index();
  }
 });
 const catalog=Object.freeze({kind:'QUALIFIED_GUI_EMITTED_DECLARATION_FRONTIER',catalogIssues,
  resolve(program,declaration){
   const refused=reason=>({status:'UNPROVED',reason,guiEmissionAuthorized:false});
   const origin=boundDeclarationOrigin(program,declaration)?.sourceDeclaration;
   if(!origin||declaration.parent!==program.documents.get(origin.sourceFile)||origin.scopeOwner?.kind!=='SourceFile')return refused('SOURCE_GLOBAL_DECLARATION_NOT_BOUND');
   if(![K.VariableDeclaration,K.FunctionDeclaration].includes(declaration.kind)||declaration.modifiers?.some(m=>[K.StaticKeyword,K.NativeKeyword].includes(m.kind)))return refused('SOURCE_DECLARATION_ROLE_NOT_SUPPORTED');
   const candidates=symbols.get(declaration.name.name)??[];
   if(candidates.length!==1)return {...refused('GUI_EMITTED_SYMBOL_NOT_UNIQUE'),candidates:candidates.map(c=>c.identity)};
   const target=candidates[0],e=target.e;
   if(e.disabled||!target.scope?.treeReachable||!['GLOBAL','TREE_DECLARATION'].includes(target.scope.scope))return refused('GUI_DECLARATION_SCOPE_OR_VISIBILITY');
   if(e.flags?.includes('NoScriptPrefix')&&e.type==='Variable')return refused('NATIVE_VARIABLE_NO_SCRIPT_PREFIX_NOT_SUPPORTED');
   if(declaration.kind===K.FunctionDeclaration){
    if(target.projection!=='ORDINARY_FUNCTION'||e.isFuncEvent===true||e.isSubFunction===true||e.flags?.some(f=>restricted.has(f)))return refused('SOURCE_FUNCTION_GUI_ROLE_MISMATCH');
    if(!supportedCarrier(target.carrier)||target.carrier!==printer.printNode(declaration.type)||target.parameters.length!==declaration.parameters.length)return refused('FUNCTION_RETURN_OR_ARITY_MISMATCH');
    for(let i=0;i<target.parameters.length;i++){
     const a=target.parameters[i],b=declaration.parameters[i];
     if(!a||!supportedCarrier(a.carrier)||a.carrier!==printer.printNode(b.type)||a.reference!==!!b.isReference)return refused('FUNCTION_PARAMETER_OWNER_OR_ABI_MISMATCH');
    }
   }else{
    if(!['GLOBAL_VARIABLE','TRIGGER_HANDLE'].includes(target.projection))return refused('SOURCE_STORAGE_GUI_ROLE_MISMATCH');
    if(!supportedCarrier(target.carrier)||target.constant!==!!declaration.modifiers?.some(m=>m.kind===K.ConstKeyword))return refused('GLOBAL_CARRIER_OR_MODIFIER_MISMATCH');
    const {baseType:sourceType,sizes}=unwrapArrayType(declaration.type),dimensions=sizes.map(n=>printer.printNode(n));
    if(printer.printNode(sourceType)!==target.carrier)return refused('GLOBAL_ELEMENT_CARRIER_MISMATCH');
    const axes=e.arraySizes??[];
    if(target.projection==='TRIGGER_HANDLE'&&(dimensions.length||e.isArray))return refused('TRIGGER_HANDLE_MUST_BE_SCALAR');
    if(dimensions.length!==axes.length||!!e.isArray!==(axes.length>0))return refused('ARRAY_DIMENSIONS_NOT_COMPLETE');
    const seen=new Set();for(const [i,axis]of [...axes].sort((a,b)=>a.dim-b.dim).entries()){
     if(!Number.isInteger(axis.dim)||axis.dim!==i||seen.has(axis.dim)||axis.variable||!/^\d+$/u.test(String(axis.value))||!/^\d+$/u.test(dimensions[i]))return refused('ARRAY_AXIS_REQUIRES_EXACT_LITERAL_BOUND');
     seen.add(axis.dim);if(BigInt(axis.value)+1n!==BigInt(dimensions[i]))return refused('ARRAY_AXIS_COUNT_MISMATCH');
    }
   }
   return {status:'EXACT_MODELED_GUI_DECLARATION_ABI',source:origin,target:target.identity,projection:target.projection,
    emittedName:declaration.name.name,carrier:target.carrier,parameters:target.parameters,
    guiScope:target.scope.scope,threaded:e.flags?.includes('CreateThread')===true,
    guiEmissionAuthorized:false,semanticEquivalenceProved:false,actualEditor:false};
  }
 });
 catalogs.set(catalog,{libraries,sha256:snapshot(libraries)});return catalog;
}

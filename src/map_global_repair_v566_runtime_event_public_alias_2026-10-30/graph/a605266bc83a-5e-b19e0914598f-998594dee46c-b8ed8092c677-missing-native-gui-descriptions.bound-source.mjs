import {galaxyExpressionUse} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/galaxy-expression-use.mjs';
import {withIsolatedGalaxyToTriggerIds} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/39db0c9c9123-ae8e39bac3e6-0131c278e7d7-3449b17ca5f9-174ab517065c-g2t-core.generated-call-provenance.mjs';
import {deriveNativeTypeMapping} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/c7fb2b544860-f5647e66d7da-701ab5fdb888-189652cc1dc7-core.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/fcab726e87f4-5551e9009019-galaxy-program-context.lazy-carriers.mjs';
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {parseTriggerXmlSync} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/64abc5b7821f-4e81e70a964b-be1ffe491b9d-2bec201047f2-738aa3fd7188-sax-reader.js';
import {FunctionCandidateIndex} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/ffe973da2409-9509435a0471-5ebadf13fba0-1ed8433b7367-function-candidates.mjs';
import {createMissingNativeGuiDescriptions} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v566_runtime_event_public_alias_2026-10-30/graph/82cf54637990-fc0b89ab-caa5f5a4c52f-b38c56e4d642-1918e5c4a98b-missing-native-gui-description.guarded.mjs';
import {readOwnedGuiLibraries} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/f98910ad6310-155d45f9a8af-c0d248323679-88f8f88bdc59-0511d3687a2c-read-owned-gui-libraries.mjs';
import {declaredCarrier} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d47b1c49befb-galaxy-program-context.js';

const sha=s=>createHash('sha256').update(s).digest('hex');
const identity=(owner,e)=>JSON.stringify([owner,e.type,e.id]);
function signature(definition,owner,lookup){
 const params=definition.parameters.map(r=>{
  const library=r.library??owner,p=lookup(library,r.id);assert(p?.type==='ParamDef','NATIVE_FORMAL_UNRESOLVED');
  return {type:p.paramType,isReference:p.isReference===true,isMultiple:p.isMultiple===true,default:p.default??null,preset:p.preset??null};
 });
 assert(!definition.scriptCode&&!definition.expressionCode&&!definition.subFunctions?.length,'NATIVE_RUNTIME_BODY_FORBIDDEN');
 return JSON.stringify({api:definition.identifier??definition.name,flags:definition.flags.toSorted(),returnType:definition.returnType??{type:'void'},params});
}

/** Reconstruct authorization from the supplied source and loaded SDK, never
 * from converter receipts. This is GUI provenance, not runtime equivalence.
 * The unchanged oracle and complete native export remain separate obligations.
 */
export const verifyMissingNativeGuiDescriptions=options=>withIsolatedGalaxyToTriggerIds(()=>verifyDescriptions(options));
function verifyDescriptions({input,after,before=input.existingTriggerData??''}){
 const owner=input.libraryId??'Map',parsed=readOwnedGuiLibraries(after,owner),old=before?readOwnedGuiLibraries(before,owner):new Map();
 const fresh=[];
 for(const [id,lib]of parsed)for(const e of Object.values(lib.elements??{}))if(e.type==='FunctionDef'&&e.flags?.includes('Native')){
  const previous=old.get(id)?.elementsByType?.FunctionDef?.[e.id];
  if(previous?.flags?.includes('Native'))continue;
  fresh.push({owner:id,definition:e});
 }
 if(!fresh.length)return {kind:'SOURCE_BOUND_MISSING_NATIVE_GUI_DESCRIPTIONS',passed:true,records:[],newNativeDescriptions:0,newRuntimeFunctions:0,newCustomScript:0};
 const libraries=new Map();
 for(const dep of input.dependencyLibraries??[])for(const [id,lib]of parseTriggerXmlSync(dep.triggerData??'')){
  assert(!libraries.has(id),'NATIVE_DESCRIPTION_DEPENDENCY_AMBIGUOUS');libraries.set(id,lib);
 }
 for(const library of libraries.values())deriveNativeTypeMapping(library,input.galaxyDeclarations??[]);
 const wanted=new Set(fresh.map(f=>f.definition.identifier??f.definition.name));
 const index=new FunctionCandidateIndex([...libraries.values()]),all=new Map([...libraries,...parsed]);
 const lookup=(id,key)=>all.get(id)?.elementsByType?.ParamDef?.[key];
 const files=[{fileName:'__primary__.galaxy',text:input.script??'',owned:true},{fileName:'__header__.galaxy',text:input.header??'',owned:true},
  ...(input.additionalScripts??[]).map(f=>({...f,owned:true})),...(input.galaxyDeclarations??[]).map(f=>({...f,owned:false}))];
 const unique=new Map();
 for(const f of files){
  const prior=unique.get(f.fileName);
  if(prior){assert.equal(prior.text,f.text,'NATIVE_DESCRIPTION_SOURCE_ALIAS_CONFLICT');if(f.owned)prior.owned=true;}
  else unique.set(f.fileName,{...f});
 }
 const sources=[...unique.values()].map(f=>({...f,sourceId:f.fileName,contentSha256:sha(f.text)}));
 const program=new GalaxyProgramContext(sources,{files:sources,dependencies:[]},sha,{checks:'binding'}),session={program,candidates:index};
 const expected=new Map(),records=[],contexts=new Map([...new Set(fresh.map(f=>f.owner))].map(libId=>[libId,{libId,elements:{}}]));
 try{
  const factory=createMissingNativeGuiDescriptions(session);
  const visit=n=>{
   if(n.kind===K.CallExpression&&n.expression?.kind===K.Identifier&&wanted.has(n.expression.name)){
    const declaration=program.declarationAt(n.expression);
    if(declaration?.parameters){
     const use=galaxyExpressionUse(n),abi={returnType:declaredCarrier(declaration.type),parameters:declaration.parameters.map(p=>declaredCarrier(p.type))};
     const result=index.resolve({name:n.expression.name,guiUse:use,declaration:abi});
     for(const [target,ctx]of contexts){
      const def=factory.describe(n,ctx,use,result);
      if(def){const key=signature(def,target,(id,k)=>id===target?ctx.elements[k]:lookup(id,k));expected.set(key,factory.report().records.find(r=>r.definition.id===def.id));}
     }
    }
   }
   forEachChild(n,visit);
  };
  for(const ast of program.documents.values())if(program.verifiedInputIdentity(ast.fileName)?.owned===true)visit(ast);
  for(const item of fresh){
   const key=signature(item.definition,item.owner,lookup),record=expected.get(key);
   assert(record,'NEW_NATIVE_DESCRIPTION_HAS_NO_PROVEN_SOURCE_AND_SDK_CONTRACT: '+identity(item.owner,item.definition));
   records.push({...record,definition:{library:item.owner,type:'FunctionDef',id:item.definition.id},descriptorSignatureSha256:sha(key)});
  }
 }finally{program.dispose();}
 return {kind:'SOURCE_BOUND_MISSING_NATIVE_GUI_DESCRIPTIONS',passed:true,records,newNativeDescriptions:records.length,
  inputSha256:sha(input.script??''),outputXmlSha256:sha(after),newRuntimeFunctions:0,newCustomScript:0,
  reconstructedFromSource:true,converterReceiptsUsed:false,bindingOnly:true,fullSemanticValidationRequired:true,fullNativeExportAndOracleRequired:true,wholeMapAccepted:false};
}

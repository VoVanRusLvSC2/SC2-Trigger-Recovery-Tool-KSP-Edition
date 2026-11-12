import {reifyStringLiteralParameters} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/bindings/string-literal-presets.frontend-scope.mjs';
import {bindLocalizedTextParameters,bindLoadedStatementTemplates} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v256_closed_aggregate_ownership_2026-10-20/template-binding.mjs';
// Per-call metadata only: no map fixture, library default, preparation path or persistent cache.
import assert from 'node:assert/strict';
import {createAutomaticCompletion} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v256_closed_aggregate_ownership_2026-10-20/graph/incremental-completion.literal-bytes.mjs';
import * as core from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v256_closed_aggregate_ownership_2026-10-20/graph/d14d4b948618471b-g2t-core.mjs';
import * as names from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v256_closed_aggregate_ownership_2026-10-20/30aaef130726-dbd944e9c28b-5ac1aec7c09a-ttg-core.verified-getter.mjs';
import * as model from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/trigger_ast_implementation_2026-10-07/source-bug-v1670/native-gui-recipes-v2371/explicit-numeric-global-model.mjs';
import * as xmlTools from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/trigger_ast_implementation_2026-10-07/source-bug-v1670/subfunction-scope-v1850/graph/667e8c11a224-trigger-xml.mjs';
import {readAuthoredTriggerDocument} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/trigger_ast_implementation_2026-10-07/source-bug-v1670/subfunction-scope-v1850/read-authored.scope.mjs';
import {xmlTree} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
import {GalaxyConstantIndex} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v256_closed_aggregate_ownership_2026-10-20/graph/2738ff46d2ff8158-galaxy-constants.mjs';
import {syntaxShape,printNode,templateMacros} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v256_closed_aggregate_ownership_2026-10-20/graph/cf5412e476e04e5a-balanced-script-template.mjs';
import {convertUserFunctionBody} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v256_closed_aggregate_ownership_2026-10-20/b612a435b506-300509170e70-1e4d629256be-g2t-trigger-body.mjs';
import {parseSharedGalaxySource as parseGalaxySource} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v256_closed_aggregate_ownership_2026-10-20/8f838c70c2ba-c8339682d349-4e95a8bf056f-galaxy-to-trigger.standard-getter.mjs';
const sdk="K:\\SC2_MAP_Workspace\\sc2_editor_C++\\map_build_validation_2026-10-01\\bundle\\modkit-extensions-blizzard\\starcraft2-trigger-ast-array-values-2026-10-07";
export async function completeExistingGui(input,signal,service) {
 signal?.throwIfAborted();
 const libraries=new Map();
 for(const document of input.dependencyLibraries??[]){
  const parsed=await readAuthoredTriggerDocument(document.triggerData,sdk,document.triggerStrings??'');
  for(const [id,library] of parsed.document.libraries){assert(!libraries.has(id),'Duplicate dependency library: '+id);libraries.set(id,library);}
 }
 const context={core,names,model,xmlTools,readAuthoredTriggerDocument,xmlTree,GalaxyConstantIndex,syntaxShape,printNode,templateMacros,convertUserFunctionBody,parseGalaxySource,sdk,service,
  libraries,nativeLibrary:libraries.get('Ntve'),galaxyDeclarations:input.galaxyDeclarations??[],opts:input};
 context.prepareIncrementalSourceValues=(work,libraryId,roots,originalIds)=>{
  const added=Object.fromEntries(Object.values(work.elements).filter(e=>!originalIds.has(e.id)).map(e=>[e.id,e]));
  const allocate=()=>{let id;do{id=core.generateId();}while(work.elements[id]||added[id]);return id;};
  reifyStringLiteralParameters(added,libraryId,roots,allocate);
  const tables=[...(input.localizedStrings??[])];
  if(input.locale&&!tables.some(t=>t.locale===input.locale))tables.push({locale:input.locale,triggerStrings:input.triggerStrings,gameStrings:input.gameStrings});
  bindLocalizedTextParameters(added,libraryId,context.nativeLibrary,libraries,tables,work.implicit===true);
  bindLoadedStatementTemplates(added,libraryId,context.nativeLibrary,libraries);
  Object.assign(work.elements,added);
 };
 const result=await createAutomaticCompletion(context).complete({xml:input.existingTriggerData,strings:input.triggerStrings??'',galaxy:input.script,libraryId:input.libraryId??'Map',sourceCheckpoint:input.sourceCheckpoint,options:input});
 signal?.throwIfAborted();
 if(result.mode==='FULL_REBUILD')return {...result.conversion,incremental:{mode:result.mode,timingsMs:result.timingsMs,proof:result.proof}};
 return {schemaVersion:1,operation:'galaxy-to-triggers',output:{libraryId:input.libraryId??'Map',documentKind:input.documentKind??'map',triggerData:result.xml,triggerStrings:result.strings,triggerStringsFileName:'TriggerStrings.txt',generationOptions:result.generationOptions},
  incremental:{mode:result.mode,changes:result.changes,proof:result.proof,timingsMs:result.timingsMs}};
}

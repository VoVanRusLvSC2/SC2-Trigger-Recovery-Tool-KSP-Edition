import {reifyStringLiteralParameters} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d78aab693e2a-string-literal-presets.frontend-scope.mjs';
import {bindLocalizedTextParameters,bindLoadedStatementTemplates} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v566_runtime_event_public_alias_2026-10-30/graph/9950bdd3fbed--e654236a9fb3-13421a8bd9e4-defc8def2e02-3e88dafb992f-missing-description-template-gate.mjs';
// Per-call metadata only: no map fixture, library default, preparation path or persistent cache.
import assert from 'node:assert/strict';
import {createAutomaticCompletion} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v569_template_formal_domain_2026-10-30/graph/25a031722407-d27cb914b334-319ad3910ce1-e4e246b588ef-incremental-completion.literal-bytes.mjs';
import * as core from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/39db0c9c9123-ae8e39bac3e6-0131c278e7d7-3449b17ca5f9-174ab517065c-g2t-core.generated-call-provenance.mjs';
import * as names from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v566_runtime_event_public_alias_2026-10-30/graph/22412dfad429-c8c7e36-837a45d37ca76a-30aaef130726-dbd944e9c28b-5ac1aec7c09a-ttg-core.verified-getter.mjs';
import * as model from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_implementation_2026-10-07/source-bug-v1670/native-gui-recipes-v2371/explicit-numeric-global-model.mjs';
import * as xmlTools from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/5bfa9fa750e5-9fdf325ff3a2-c9225fa6b3d8-018f68c38604-e640247343a7-667e8c11a224-trigger-xml.mjs';
import {readAuthoredTriggerDocument} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_implementation_2026-10-07/source-bug-v1670/subfunction-scope-v1850/read-authored.scope.mjs';
import {xmlTree} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
import {GalaxyConstantIndex} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/e4b30fe1b4ed-4da4527089d5-34f91d6c0d99-2738ff46d2ff8158-galaxy-constants.mjs';
import {syntaxShape,printNode,templateMacros} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/d5734da0691b-56a9139d7536-a7e6f1fe81bc-cf5412e476e04e5a-balanced-script-template.mjs';
import {convertUserFunctionBody} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v566_runtime_event_public_alias_2026-10-30/graph/4377cf481adb--1606ff5f786d26-92d5e8a85df8d8-b612a435b506-300509170e70-1e4d629256be-g2t-trigger-body.mjs';
import {parseSharedGalaxySource as parseGalaxySource} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v566_runtime_event_public_alias_2026-10-30/graph/4b4b99c25b58-92a991eafe07d-8f838c70c2ba-c8339682d349-4e95a8bf056f-galaxy-to-trigger.standard-getter.mjs';
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

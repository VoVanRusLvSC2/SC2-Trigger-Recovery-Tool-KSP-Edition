// Per-call metadata only: no map fixture, library default, preparation path or persistent cache.
import assert from 'node:assert/strict';
import {createAutomaticCompletion} from './automatic-completion.empty-document.mjs';
import * as core from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
import * as names from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v150_incremental_empty_document_2026-10-18/30aaef130726-dbd944e9c28b-5ac1aec7c09a-ttg-core.verified-getter.mjs';
import * as model from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_implementation_2026-10-07/source-bug-v1670/native-gui-recipes-v2371/explicit-numeric-global-model.mjs';
import * as xmlTools from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_implementation_2026-10-07/source-bug-v1670/subfunction-scope-v1850/graph/667e8c11a224-trigger-xml.mjs';
import {readAuthoredTriggerDocument} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_implementation_2026-10-07/source-bug-v1670/subfunction-scope-v1850/read-authored.scope.mjs';
import {xmlTree} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
import {GalaxyConstantIndex} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/galaxy-constants.js';
import {syntaxShape,printNode} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_implementation_2026-10-07/source-bug-v1670/native-gui-recipes-v2371/balanced-script-template.mjs';
import {convertUserFunctionBody} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v150_incremental_empty_document_2026-10-18/b612a435b506-300509170e70-1e4d629256be-g2t-trigger-body.mjs';
import {parseSharedGalaxySource as parseGalaxySource} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v150_incremental_empty_document_2026-10-18/8f838c70c2ba-c8339682d349-4e95a8bf056f-galaxy-to-trigger.standard-getter.mjs';
const sdk="K:\\SC2_MAP_Workspace\\sc2_editor_C++\\map_build_validation_2026-10-01\\bundle\\modkit-extensions-blizzard\\starcraft2-trigger-ast-array-values-2026-10-07";
export async function completeExistingGui(input,signal,service) {
 signal?.throwIfAborted();
 const libraries=new Map();
 for(const document of input.dependencyLibraries??[]){
  const parsed=await readAuthoredTriggerDocument(document.triggerData,sdk,document.triggerStrings??'');
  for(const [id,library] of parsed.document.libraries){assert(!libraries.has(id),'Duplicate dependency library: '+id);libraries.set(id,library);}
 }
 const context={core,names,model,xmlTools,readAuthoredTriggerDocument,xmlTree,GalaxyConstantIndex,syntaxShape,printNode,convertUserFunctionBody,parseGalaxySource,sdk,service,
  libraries,nativeLibrary:libraries.get('Ntve'),galaxyDeclarations:input.galaxyDeclarations??[],opts:input};
 const result=await createAutomaticCompletion(context).complete({xml:input.existingTriggerData,strings:input.triggerStrings??'',galaxy:input.script,libraryId:input.libraryId??'Map',sourceCheckpoint:input.sourceCheckpoint,options:input});
 signal?.throwIfAborted();
 if(result.mode==='FULL_REBUILD')return {...result.conversion,incremental:{mode:result.mode,timingsMs:result.timingsMs,proof:result.proof}};
 return {schemaVersion:1,operation:'galaxy-to-triggers',output:{libraryId:input.libraryId??'Map',documentKind:input.documentKind??'map',triggerData:result.xml,triggerStrings:result.strings,triggerStringsFileName:'TriggerStrings.txt'},
  incremental:{mode:result.mode,changes:result.changes,proof:result.proof,timingsMs:result.timingsMs}};
}

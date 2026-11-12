// Preserve the existing SDK singleton and its conversion-scoped indexes.
// This adapter overrides one pure naming operation, not the whole compiler.
export * from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/a8e17466d0b6-cc6e32b546f5-ttg-core.js";
import {resolveRefFull,namingIndexes,sanitizeName} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/a8e17466d0b6-cc6e32b546f5-ttg-core.js";
import {refKey,libraryPrefix} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
import {generatedStructureStem} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/generated-structure-stem.mjs";
export function structureTypeName(typeRef,library,nativeLibrary,allLibraries){
 const structure=resolveRefFull(typeRef,library,nativeLibrary,allLibraries);if(!structure)return;
 const declared=namingIndexes().dependencyStructures.namesByRef.get(refKey(structure,structure.library??typeRef?.library??library.id));if(declared)return declared;
 const raw=structure.identifier??structure.name??structure.id,owner=structure.library??typeRef?.library??library.id,prefix=libraryPrefix(owner)+'gs_';
 const stem=structure.identifier!==undefined&&generatedStructureStem(prefix+raw,prefix)!==undefined?raw:sanitizeName(raw);if(!stem)return;
 return prefix+(structure.identifier!==undefined?stem:stem.charAt(0).toUpperCase()+stem.slice(1));
}

import * as legacyLocalSymbols from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/a8e17466d0b6-cc6e32b546f5-ttg-core.js";
import {createEditorLocalSymbols} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/editor-local-symbols.mjs";
import {createElementAccessExpression,createPropertyAccessExpression} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ast-factory.js";
import {conversionError as localSymbolError} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
export const {localVarName,memberVarName,resolveVariableGalaxyName,applyParamAccessors}=createEditorLocalSymbols({legacy:legacyLocalSymbols,createElementAccessExpression,createPropertyAccessExpression,conversionError:localSymbolError});

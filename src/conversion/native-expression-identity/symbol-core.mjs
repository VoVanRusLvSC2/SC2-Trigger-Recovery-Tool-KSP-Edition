// Preserve the existing SDK singleton and its conversion-scoped indexes.
// This adapter overrides one pure naming operation, not the whole compiler.
export * from "./ttg-core.js";
import {resolveRefFull,namingIndexes,sanitizeName} from "./ttg-core.js";
import {refKey,libraryPrefix} from "../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
import {generatedStructureStem} from "../../model/generated-structure-stem.mjs";
export function structureTypeName(typeRef,library,nativeLibrary,allLibraries){
 const structure=resolveRefFull(typeRef,library,nativeLibrary,allLibraries);if(!structure)return;
 const declared=namingIndexes().dependencyStructures.namesByRef.get(refKey(structure,structure.library??typeRef?.library??library.id));if(declared)return declared;
 const raw=structure.identifier??structure.name??structure.id,owner=structure.library??typeRef?.library??library.id,prefix=libraryPrefix(owner)+'gs_';
 const stem=structure.identifier!==undefined&&generatedStructureStem(prefix+raw,prefix)!==undefined?raw:sanitizeName(raw);if(!stem)return;
 return prefix+(structure.identifier!==undefined?stem:stem.charAt(0).toUpperCase()+stem.slice(1));
}

import * as legacyLocalSymbols from "./ttg-core.js";
import {createEditorLocalSymbols} from "../../model/editor-local-symbols.mjs";
import {createElementAccessExpression,createPropertyAccessExpression} from "../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/ast-factory.js";
import {conversionError as localSymbolError} from "../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
export const {localVarName,memberVarName,resolveVariableGalaxyName,applyParamAccessors}=createEditorLocalSymbols({legacy:legacyLocalSymbols,createElementAccessExpression,createPropertyAccessExpression,conversionError:localSymbolError});

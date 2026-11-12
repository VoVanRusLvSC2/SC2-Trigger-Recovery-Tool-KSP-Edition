export * from "./ttg-core-alternate-4.js";
export {deriveNativeTypeMapping,declaredReturnType,isResolvedGalaxyType,mapParameterTypeToGalaxy,isIdentityConversionOperator} from "./types-alternate-2.mjs";

import * as legacyLocalSymbols from "./ttg-core-alternate-4.js";
import {createEditorLocalSymbols} from "../../model/editor-local-symbols.mjs";
import {createElementAccessExpression,createPropertyAccessExpression} from "../../sdk/literal-native/modules/triggers/services/galaxy-conversion/internal/ast-factory.js";
import {conversionError as localSymbolError} from "../../sdk/literal-native/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
export const {localVarName,memberVarName,resolveVariableGalaxyName,applyParamAccessors}=createEditorLocalSymbols({legacy:legacyLocalSymbols,createElementAccessExpression,createPropertyAccessExpression,conversionError:localSymbolError});

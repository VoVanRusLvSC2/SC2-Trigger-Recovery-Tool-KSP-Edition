export * from "./ttg-core-alternate.js";
export {deriveNativeTypeMapping,declaredReturnType,isResolvedGalaxyType,mapParameterTypeToGalaxy,isIdentityConversionOperator} from "./types-alternate-4.mjs";

import * as legacyLocalSymbols from "./ttg-core-alternate.js";
import {createEditorLocalSymbols} from "../../model/editor-local-symbols.mjs";
import {createElementAccessExpression,createPropertyAccessExpression} from "../../sdk/production-preparation/modules/triggers/services/galaxy-conversion/internal/ast-factory.js";
import {conversionError as localSymbolError} from "../../sdk/production-preparation/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
export const {localVarName,memberVarName,resolveVariableGalaxyName,applyParamAccessors}=createEditorLocalSymbols({legacy:legacyLocalSymbols,createElementAccessExpression,createPropertyAccessExpression,conversionError:localSymbolError});

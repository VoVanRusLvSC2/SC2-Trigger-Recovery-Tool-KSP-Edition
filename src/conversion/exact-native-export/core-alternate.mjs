export * from './ttg-core.js';
export {
  deriveNativeTypeMapping,
  declaredReturnType,
  isResolvedGalaxyType,
  mapParameterTypeToGalaxy,
  isIdentityConversionOperator,
} from './types-alternate-3.mjs';

import * as legacyLocalSymbols from './ttg-core.js';
import { createEditorLocalSymbols } from '../../model/editor-local-symbols.mjs';
import {
  createElementAccessExpression,
  createPropertyAccessExpression,
} from '../../sdk/core/modules/triggers/services/galaxy-conversion/internal/ast-factory.js';
import { conversionError as localSymbolError } from '../../sdk/core/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
export const { localVarName, memberVarName, resolveVariableGalaxyName, applyParamAccessors } =
  createEditorLocalSymbols({
    legacy: legacyLocalSymbols,
    createElementAccessExpression,
    createPropertyAccessExpression,
    conversionError: localSymbolError,
  });

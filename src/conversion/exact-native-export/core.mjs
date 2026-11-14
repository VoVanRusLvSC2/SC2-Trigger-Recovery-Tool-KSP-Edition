export * from './ttg-core-alternate-2.js';
export {
  deriveNativeTypeMapping,
  declaredReturnType,
  isResolvedGalaxyType,
  mapParameterTypeToGalaxy,
  isIdentityConversionOperator,
} from './types.mjs';

import * as legacyLocalSymbols from './ttg-core-alternate-2.js';
import { createEditorLocalSymbols } from '../../model/editor-local-symbols.mjs';
import {
  createElementAccessExpression,
  createPropertyAccessExpression,
} from '../../sdk/lossless-colors/modules/triggers/services/galaxy-conversion/internal/ast-factory.js';
import { conversionError as localSymbolError } from '../../sdk/lossless-colors/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
export const { localVarName, memberVarName, resolveVariableGalaxyName, applyParamAccessors } =
  createEditorLocalSymbols({
    legacy: legacyLocalSymbols,
    createElementAccessExpression,
    createPropertyAccessExpression,
    conversionError: localSymbolError,
  });

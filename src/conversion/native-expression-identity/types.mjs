import * as legacy from "./symbol-core.mjs";
import * as model from "../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
import * as language from "../../sdk/array-values/modules/galaxy/language-core/index.js";
import {createSdkTypeEvidence} from "../../types/sdk-type-evidence.bfb0e0a59736.shared-ast.mjs";
const evidence=createSdkTypeEvidence({...legacy,...model,...language});
export const {deriveNativeTypeMapping,declaredReturnType,isResolvedGalaxyType,mapParameterTypeToGalaxy,isIdentityConversionOperator}=evidence;

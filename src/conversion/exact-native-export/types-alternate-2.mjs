import * as legacy from "./ttg-core-alternate-4.js";
import * as model from "../../sdk/literal-native/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
import * as language from "../exact-function-signatures/index-alternate.js";
import {createSdkTypeEvidence} from "../exact-function-signatures/sdk-type-evidence.bfb0e0a59736.shared-ast.mjs";
const evidence=createSdkTypeEvidence({...legacy,...model,...language});
export const {deriveNativeTypeMapping,declaredReturnType,isResolvedGalaxyType,mapParameterTypeToGalaxy,isIdentityConversionOperator}=evidence;

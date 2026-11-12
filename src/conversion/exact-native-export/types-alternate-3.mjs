import * as legacy from "./ttg-core.js";
import * as model from "../../sdk/core/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
import * as language from "../exact-function-signatures/index.js";
import {createSdkTypeEvidence} from "../exact-function-signatures/sdk-type-evidence.68483c6e6fd2.shared-ast.mjs";
const evidence=createSdkTypeEvidence({...legacy,...model,...language});
export const {deriveNativeTypeMapping,declaredReturnType,isResolvedGalaxyType,mapParameterTypeToGalaxy,isIdentityConversionOperator}=evidence;

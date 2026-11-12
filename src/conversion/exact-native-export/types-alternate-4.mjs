import * as legacy from "./ttg-core-alternate.js";
import * as model from "../../sdk/production-preparation/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
import * as language from "../exact-function-signatures/index-alternate-2.js";
import {createSdkTypeEvidence} from "../exact-function-signatures/sdk-type-evidence.bfb0e0a59736.shared-ast.mjs";
const evidence=createSdkTypeEvidence({...legacy,...model,...language});
export const {deriveNativeTypeMapping,declaredReturnType,isResolvedGalaxyType,mapParameterTypeToGalaxy,isIdentityConversionOperator}=evidence;

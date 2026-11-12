import * as legacy from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import * as model from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import * as language from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/galaxy/language-core/index.js';
import {createSdkTypeEvidence} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/types/sdk-type-evidence.bfb0e0a59736.shared-ast.mjs';
const evidence=createSdkTypeEvidence({...legacy,...model,...language});
export const {deriveNativeTypeMapping,declaredReturnType,isResolvedGalaxyType,mapParameterTypeToGalaxy,isIdentityConversionOperator}=evidence;

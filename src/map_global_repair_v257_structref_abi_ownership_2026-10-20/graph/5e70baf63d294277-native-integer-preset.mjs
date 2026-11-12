/** Only the actual loaded native preset-to-int identity is eligible. */
// @ts-nocheck
import {lookupElement} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {mkParamRef,mkFCRef,fdRef} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v257_structref_abi_ownership_2026-10-20/graph/d14d4b948618471b-g2t-core.mjs';
export function nativeIntegerPresetParam(preset,ctx){
 const lib=ctx.nativeLibrary;if(!lib)return;
 const definitions=Object.values(lib.elementsByType?.FunctionDef??lib.elements??{}).filter(d=>d.type==='FunctionDef'&&d.identifier==='ConvertPresetToInteger');
 if(definitions.length!==1)return;
 const def=definitions[0],refs=def.parameters??[];
 if(def.returnType?.type!=='int'||refs.length!==1||!def.flags?.includes('Call')||!def.flags?.includes('Operator')||def.scriptCode)return;
 const param=lookupElement([lib],refs[0],lib.id);
 if(param?.type!=='ParamDef'||param.paramType?.type!=='anypreset'||param.paramType?.variableType!=='int')return;
 const value=mkParamRef({preset,parameterDef:refs[0]},ctx);
 const call=mkFCRef({functionDef:fdRef(def),parameters:[value]},ctx);
 return mkParamRef({functionCall:call,valueType:{type:'int'}},ctx);
}

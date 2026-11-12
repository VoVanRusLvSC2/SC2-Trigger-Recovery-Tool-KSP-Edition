import {auditNativeCustomScriptLayout} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/native-custom-script-layout.mjs';
import {createGuiExpressionPreparation} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/conversion/gui-expression-preparation.mjs';
import {lowerExpressionIntegerComplements} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/aa91e8c52bf7-expression-integer-complement.mjs';
import {lowerLiteralBooleanIfPredicates} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/c07a2c24d25d-literal-boolean-if-predicates.mjs';
import {lowerTypedIntegerPredicates} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/56da3a203a80-typed-integer-predicates.mjs';
import {promoteReadonlyLiteralStringGlobals} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/8dab17c8f5d1-readonly-literal-string-globals.mjs';
import {lowerRedundantGlobalIntegerZeros} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/41b64f887c67-redundant-global-integer-zero.mjs';
import {lowerScalarBitwiseAssignments} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e870d52b8d07-scalar-bitwise-assignment.mjs';
import {lowerScalarShiftAssignments} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/b49724e4d58d-scalar-shift-assignment.mjs';
import {createGalaxyProgram} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/850db6e20892-galaxy-program.collections.mjs';
import {discardGalaxySyntax} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d38acb45983d-immutable-galaxy-syntax.collections.mjs';
import {createStringLiteralBindings} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d78aab693e2a-string-literal-presets.frontend-scope.mjs';
import {withStringLiteralBindings} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d78aab693e2a-string-literal-presets.frontend-scope.mjs';
import {createExternalIntConstants} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/df0c73d2ac41-external-int-constants.bound-writes.mjs';
import {withExternalIntConstants} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/df0c73d2ac41-external-int-constants.bound-writes.mjs';
const prepareGuiExpressions=createGuiExpressionPreparation({lowerExpressionIntegerComplements,lowerLiteralBooleanIfPredicates,lowerTypedIntegerPredicates,promoteReadonlyLiteralStringGlobals,lowerRedundantGlobalIntegerZeros,lowerScalarBitwiseAssignments,lowerScalarShiftAssignments});

async function convertFreshLibrary(input,signal){
 const full=input.guiRecoveryMode==='full-gui'||input.guiRecoveryMode===undefined&&input.convertAdditionalScripts===true;
 if(input.documentKind!=='library'||!full||input.existingTriggerData?.trim()||input.sourceSyntax!==undefined)
  return {value:await previous.convertGalaxyToTriggers(input,signal)};
 signal?.throwIfAborted();
 const declarations=[...(input.galaxyDeclarations??[]),...(input.additionalScripts??[]),
  ...(input.header?[{fileName:'__library_header__.galaxy',text:input.header}]:[])];
 const program=createGalaxyProgram();let prepared,syntax;
 try{
  const file={fileName:input.scriptFileName??'__library__.galaxy',text:input.script};
  const document=program.document(file,{role:'root'});
  prepared=prepareGuiExpressions(input.script,{declarations,document});syntax=program.takeSyntax();
 }finally{program.dispose();}
 const sources=[{fileName:input.scriptFileName??'__library__.galaxy',text:prepared.text},
  ...(input.header?[{fileName:'__library_header__.galaxy',text:input.header}]:[]),...(input.additionalScripts??[])];
 const strings=createStringLiteralBindings({ownedSources:sources,externalSources:declarations});
 const integers=createExternalIntConstants({ownedSources:sources,externalSources:declarations});
 try{
  signal?.throwIfAborted();
  const value=await withStringLiteralBindings(strings.capability,()=>withExternalIntConstants(integers.capability,
   ()=>previous.convertGalaxyToTriggers({...input,script:prepared.text,sourceSyntax:syntax},signal)));
  return {value,proof:{...prepared.proof,stages:prepared.stages,stringLiteralBindings:strings.proof,externalIntegerBindings:integers.proof,
   sourceInputWasFreshLibrary:true,incrementalGuiUntouched:true,benchmarkChanged:false}};
 }finally{discardGalaxySyntax(syntax);}
}
import {normalizeGeneratedIntegerConstantPresets} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/gui/integer-constant-presets.mjs';
import * as previous from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v569_template_formal_domain_2026-10-30/graph/7dba4629576e-3-bd1456050490-95ec51816397-ef6e0b822b56e5-3a0c708399f483-d4821e6f285a73-candidate-r89.mjs';
import {preserveGeneratedFixedLiterals} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v423_fixed_literal_library_refs_2026-10-26/graph/2c2fce4f2a76-exact-fixed-literals.mjs';
export {convertTriggersToGalaxy,createTriggerConversionContext,triggerConversionBounds} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v569_template_formal_domain_2026-10-30/graph/7dba4629576e-3-bd1456050490-95ec51816397-ef6e0b822b56e5-3a0c708399f483-d4821e6f285a73-candidate-r89.mjs';
export async function convertGalaxyToTriggers(input,signal) {
 const libraryConversion=await convertFreshLibrary(input,signal);
 const result=libraryConversion.value;
 const next=preserveGeneratedFixedLiterals({xml:result.output.triggerData,existingXml:input.existingTriggerData??'',implicitLibraryId:input.libraryId??'Map'});
 const normalized=normalizeGeneratedIntegerConstantPresets({xml:next.xml,existingXml:input.existingTriggerData??'',implicitLibraryId:input.libraryId??'Map'});
 const scope=c=>c.libraryScoped?'lib_'+c.library+'_':'';
 const strings=next.proof.presets.flatMap(p=>[`Preset/Name/${scope(p)}${p.id}=Exact fixed literals`,...p.values.map(v=>`PresetValue/Name/${scope(p)}${v.id}=${v.token}`)]).join('\n');
 return {...result,output:{...result.output,triggerData:normalized.xml,triggerStrings:(result.output.triggerStrings??'')+(strings?'\n'+strings+'\n':'')},exactFixedLiterals:next.proof,nativeCustomScriptLayout:auditNativeCustomScriptLayout(normalized.xml,input.libraryId??'Map'),integerConstantPresets:normalized.proof,sourceInputPreparation:libraryConversion.proof};
}

import {auditNativeCustomScriptLayout} from "../../verification/native-custom-script-layout.mjs";
import {createGuiExpressionPreparation} from "../gui-expression-preparation.mjs";
import {lowerExpressionIntegerComplements} from "../exact-function-signatures/expression-integer-complement.mjs";
import {lowerLiteralBooleanIfPredicates} from "../exact-function-signatures/literal-boolean-if-predicates.mjs";
import {lowerTypedIntegerPredicates} from "../exact-function-signatures/typed-integer-predicates.mjs";
import {promoteReadonlyLiteralStringGlobals} from "../exact-function-signatures/readonly-literal-string-globals.mjs";
import {lowerRedundantGlobalIntegerZeros} from "../exact-function-signatures/redundant-global-integer-zero.mjs";
import {lowerScalarBitwiseAssignments} from "../exact-function-signatures/scalar-bitwise-assignment.mjs";
import {lowerScalarShiftAssignments} from "../exact-function-signatures/scalar-shift-assignment.mjs";
import {createGalaxyProgram} from "../exact-function-signatures/galaxy-program.collections.mjs";
import {discardGalaxySyntax} from "../exact-function-signatures/immutable-galaxy-syntax.collections.mjs";
import {createStringLiteralBindings} from "../exact-function-signatures/string-literal-presets.frontend-scope.mjs";
import {withStringLiteralBindings} from "../exact-function-signatures/string-literal-presets.frontend-scope.mjs";
import {createExternalIntConstants} from "../exact-function-signatures/external-int-constants.bound-writes.mjs";
import {withExternalIntConstants} from "../exact-function-signatures/external-int-constants.bound-writes.mjs";
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
import {normalizeGeneratedIntegerConstantPresets} from "../../gui/integer-constant-presets.mjs";
import * as previous from "./candidate-alternate-6.mjs";
import {preserveGeneratedFixedLiterals} from "../fixed-literal-library-refs/exact-fixed-literals.mjs";
export {convertTriggersToGalaxy,createTriggerConversionContext,triggerConversionBounds} from "./candidate-alternate-6.mjs";
export async function convertGalaxyToTriggers(input,signal) {
 const libraryConversion=await convertFreshLibrary(input,signal);
 const result=libraryConversion.value;
 const next=preserveGeneratedFixedLiterals({xml:result.output.triggerData,existingXml:input.existingTriggerData??'',implicitLibraryId:input.libraryId??'Map'});
 const normalized=normalizeGeneratedIntegerConstantPresets({xml:next.xml,existingXml:input.existingTriggerData??'',implicitLibraryId:input.libraryId??'Map'});
 const scope=c=>c.libraryScoped?'lib_'+c.library+'_':'';
 const strings=next.proof.presets.flatMap(p=>[`Preset/Name/${scope(p)}${p.id}=Exact fixed literals`,...p.values.map(v=>`PresetValue/Name/${scope(p)}${v.id}=${v.token}`)]).join('\n');
 return {...result,output:{...result.output,triggerData:normalized.xml,triggerStrings:(result.output.triggerStrings??'')+(strings?'\n'+strings+'\n':'')},exactFixedLiterals:next.proof,nativeCustomScriptLayout:auditNativeCustomScriptLayout(normalized.xml,input.libraryId??'Map'),integerConstantPresets:normalized.proof,sourceInputPreparation:libraryConversion.proof};
}

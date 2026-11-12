import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {verifyUniqueFunctionBodies} from './unique-function-bodies.mjs';
import {SyntaxKind as K,Printer} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {toGalaxyFunctionName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import {withImplicitLibrary} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const voidZero=n=>n?.kind===K.FunctionDeclaration&&n.body&&n.type.kind===K.VoidKeyword&&!n.parameters.length&&!n.modifiers?.length;

// This is an observation of one input, not a universal list of reserved phases.
// Qualification of the real generator, input GUI and dependencies stays external.
export function inspectNativeSystemFunctionContract(text,{entryPoint='InitMap'}={}){
 const integrity=verifyUniqueFunctionBodies(text);assert(integrity.valid,'SYSTEM_PHASE_NATIVE_SOURCE_NOT_UNIQUE');
 const ast=parseImmutableGalaxySyntax(text,'ObservedSystemFrame.galaxy'),bodies=ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body),
  definitions=new Map(bodies.map(n=>[n.name.name,n])),entry=definitions.get(entryPoint);
 assert(voidZero(entry),'SYSTEM_PHASE_ENTRY_ABI');
 const calls=entry.body.statements.map(n=>{
  const c=n.kind===K.ExpressionStatement&&n.expression;
  assert(c?.kind===K.CallExpression&&c.expression.kind===K.Identifier&&!c.arguments.length,'SYSTEM_PHASE_DIRECT_NATIVE_SCHEDULE_REQUIRED');return c.expression.name;
 });
 assert.equal(new Set([entryPoint,...calls]).size,calls.length+1,'SYSTEM_PHASE_NATIVE_SCHEDULE_NOT_UNIQUE');
 for(const name of calls)assert(voidZero(definitions.get(name)),'SYSTEM_PHASE_NATIVE_CALLEE_ABI');
 return {kind:'INPUT_SPECIFIC_OBSERVED_NATIVE_SYSTEM_FUNCTION_CONTRACT',nativeSourceSha256:sha(text),entryPoint,
  functionNames:[entryPoint,...calls],order:calls,emptyEntry:calls.length===0,
  bodies:[entryPoint,...calls].map(name=>({name,syntaxSha256:sha(printer.printNode(definitions.get(name)))})),
  applicableToOtherGuiInputs:false,nativeQualificationStillRequired:true,wholeMapAccepted:false};
}

export function verifyGuiSystemFunctionOwnership({libraries,nativeSystemSource,implicitLibrary='Map'}){
 const contract=inspectNativeSystemFunctionContract(nativeSystemSource),reserved=new Set(contract.functionNames),issues=[],references=[];
 assert(libraries instanceof Map,'SYSTEM_PHASE_TYPED_GUI_LIBRARIES_REQUIRED');const functionNameGroups=new Map();
 for(const [library,lib]of libraries)for(const e of Object.values(lib.elements)){
  if(e.type!=='FunctionDef'||e.disabled)continue;assert.equal(e.library,library,'SYSTEM_PHASE_GUI_OWNER');
  const name=e.identifier??e.name,sdkName=withImplicitLibrary(implicitLibrary,()=>toGalaxyFunctionName({...e,name},{libId:library,library:lib,allLibraries:libraries,functionNameGroups}));
  // Explicit names must not be hidden by the SDK's duplicate-name repair.
  const runtimeName=e.flags?.includes('NoScriptPrefix')?name:sdkName;
  if(!reserved.has(runtimeName))continue;
  const identity={library,type:'FunctionDef',id:e.id};
  if(e.flags?.includes('Operator')&&!e.flags?.includes('Native'))references.push({identity,runtimeName,emitsOwnBody:false});
  else issues.push({identity,runtimeName,sdkName,flags:e.flags??[],
   reason:e.flags?.includes('Native')?'SYSTEM_PHASE_CANNOT_BE_A_NATIVE_API_DESCRIPTION':'ORDINARY_GUI_DEFINITION_COLLIDES_WITH_NATIVE_SYSTEM_FUNCTION',
   sourcePhaseOwnershipRequired:true,deleteOrRenameAutomatically:false});
 }
 return {kind:'INPUT_SPECIFIC_NATIVE_SYSTEM_OWNERSHIP_PREFLIGHT',passed:issues.length===0,contract,issues,references,
  observedInputBindingStillRequired:true,sourceOrGuiChanged:false,phaseEffectsOrOrderProved:false,nativeCompilationStillRequired:true,wholeMapAccepted:false};
}

// A fast negative gate before the full unchanged oracle. Even matching frames do
// not prove the other functions, storage, include ownership, GUI or lobby.
export function verifySdkNativeSystemFrame(sdkText,nativeText,options){
 const sdkIntegrity=verifyUniqueFunctionBodies(sdkText),nativeIntegrity=verifyUniqueFunctionBodies(nativeText);
 const report={kind:'SDK_NATIVE_SYSTEM_FRAME_CONSISTENCY',sdkSha256:sha(sdkText),nativeSha256:sha(nativeText),
  sdkIntegrity,nativeIntegrity,passed:false,issues:[],wholeMapAccepted:false,fullProgramOracleStillRequired:true};
 if(!sdkIntegrity.valid||!nativeIntegrity.valid){report.issues.push('FUNCTION_DECLARATION_INTEGRITY');return report;}
 try{
  report.sdk=inspectNativeSystemFunctionContract(sdkText,options);report.native=inspectNativeSystemFunctionContract(nativeText,options);
  if(JSON.stringify(report.sdk.order)!==JSON.stringify(report.native.order))report.issues.push('SYSTEM_PHASE_ORDER_OR_MEMBERSHIP');
  if(JSON.stringify(report.sdk.bodies)!==JSON.stringify(report.native.bodies))report.issues.push('SYSTEM_PHASE_BODY_SYNTAX');
  report.passed=report.issues.length===0;
 }catch(error){report.issues.push(String(error.message));}
 return report;
}

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {verifyUniqueFunctionBodies} from './unique-function-bodies.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {toGalaxyFunctionName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import {withImplicitLibrary} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const voidZero=n=>n?.kind===K.FunctionDeclaration&&n.body&&n.type.kind===K.VoidKeyword&&!n.parameters.length&&!n.modifiers?.length;

/** Derive the generated phase names from a separately qualified Native fixture.
 * Source text alone grants no Native qualification or equivalence permission. */
export function inspectNativeSystemFunctionContract(text,{entryPoint='InitMap'}={}){
 const integrity=verifyUniqueFunctionBodies(text);assert(integrity.valid,'SYSTEM_PHASE_NATIVE_SOURCE_NOT_UNIQUE');
 const ast=parseImmutableGalaxySyntax(text,'NativeSystemPhase.galaxy'),entry=ast.statements.filter(n=>n.name?.name===entryPoint&&n.body);
 assert(entry.length===1&&voidZero(entry[0]),'SYSTEM_PHASE_ENTRY_ABI');
 const calls=entry[0].body.statements.map(n=>{
  const c=n.kind===K.ExpressionStatement&&n.expression;
  assert(c?.kind===K.CallExpression&&c.expression.kind===K.Identifier&&!c.arguments.length,'SYSTEM_PHASE_DIRECT_NATIVE_SCHEDULE_REQUIRED');return c.expression.name;
 });
 assert(calls.length>0&&new Set([entryPoint,...calls]).size===calls.length+1,'SYSTEM_PHASE_NATIVE_SCHEDULE_NOT_UNIQUE');
 for(const name of calls){const functions=ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name===name&&n.body);
  assert(functions.length===1&&voidZero(functions[0]),'SYSTEM_PHASE_NATIVE_CALLEE_ABI');}
 return {kind:'OBSERVED_NATIVE_ROOT_SYSTEM_FUNCTION_CONTRACT',nativeSourceSha256:sha(text),entryPoint,
  functionNames:[entryPoint,...calls],order:calls,nativeQualificationStillRequired:true,wholeMapAccepted:false};
}

/** Fast negative preflight. An ordinary FunctionDef cannot also own a function
 * which the actual root generator emits. Pure inline references remain legal.
 * Passing this gate says nothing about phase effects, source includes or order. */
export function verifyGuiSystemFunctionOwnership({libraries,nativeSystemSource,implicitLibrary='Map'}){
 const contract=inspectNativeSystemFunctionContract(nativeSystemSource),reserved=new Set(contract.functionNames),issues=[],references=[];
 assert(libraries instanceof Map,'SYSTEM_PHASE_TYPED_GUI_LIBRARIES_REQUIRED');
 const functionNameGroups=new Map();
 for(const [library,lib]of libraries)for(const e of Object.values(lib.elements)){
  if(e.type!=='FunctionDef')continue;assert.equal(e.library,library,'SYSTEM_PHASE_GUI_OWNER');
  if(e.disabled||e.flags?.includes('Native'))continue;
  const runtimeName=withImplicitLibrary(implicitLibrary,()=>toGalaxyFunctionName({...e,name:e.identifier??e.name},{
   libId:library,library:lib,allLibraries:libraries,functionNameGroups}));
  if(!reserved.has(runtimeName))continue;
  const identity={library,type:'FunctionDef',id:e.id},inline=e.flags?.includes('Operator');
  if(inline)references.push({identity,runtimeName,emitsOwnBody:false});
  else issues.push({identity,runtimeName,flags:e.flags??[],reason:'ORDINARY_GUI_DEFINITION_COLLIDES_WITH_NATIVE_SYSTEM_FUNCTION',
   sourcePhaseOwnershipRequired:true,deleteOrRenameAutomatically:false});
 }
 return {kind:'NATIVE_SYSTEM_FUNCTION_GUI_OWNERSHIP_PREFLIGHT',passed:issues.length===0,contract,issues,references,
  sourceOrGuiChanged:false,phaseEffectsOrOrderProved:false,nativeCompilationStillRequired:true,wholeMapAccepted:false};
}

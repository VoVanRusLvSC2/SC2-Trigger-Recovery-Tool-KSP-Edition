/** Compiler declarations and GUI lowering have independent authorities.
 * These prototypes enter only the semantic input; they authorize no GUI node,
 * runtime implementation, call rewrite, or raw-code fallback. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {declaredCarrier} from '../../trigger_ast_implementation_2026-10-07/source-bug-v1670/verified-input-v1689/galaxy-program-context.identity.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const qualified=new WeakSet();

export async function loadQualifiedCompilerContracts({profilePath,profileSha256,editorPath,nativeHeaderPath}) {
 const bytes=await readFile(profilePath);assert.equal(sha(bytes),profileSha256,'COMPILER_CONTRACT_PROFILE_CHANGED');
 const profile=JSON.parse(bytes);assert.equal(profile.schema,1);assert.equal(profile.authority,'original-editor-compiler');
 assert.equal(sha(await readFile(editorPath)),profile.editorSha256,'COMPILER_BUILD_CHANGED');
 assert.equal(sha(await readFile(nativeHeaderPath)),profile.nativeHeaderSha256,'NATIVE_HEADER_CHANGED');
 const evidence=new Map();
 for(const item of profile.evidence){
  assert(!evidence.has(item.id),'DUPLICATE_COMPILER_EVIDENCE');
  const data=await readFile(item.path);assert.equal(sha(data),item.sha256,'COMPILER_EVIDENCE_CHANGED');
  evidence.set(item.id,JSON.parse(data));
 }
 const contracts=[],names=new Set();
 for(const contract of profile.contracts){
  assert(!names.has(contract.name),'DUPLICATE_COMPILER_CONTRACT');names.add(contract.name);
  const ast=parseImmutableGalaxySyntax(contract.declaration,'CompilerContract.galaxy');
  assert.equal(ast.parseDiagnostics.length,0);assert.equal(ast.statements.length,1);
  const fn=ast.statements[0];
  assert.equal(fn.kind,K.FunctionDeclaration);assert.equal(fn.name.name,contract.name);assert(!fn.body);
  assert(fn.modifiers?.some(m=>m.kind===K.NativeKeyword),'COMPILER_CONTRACT_IS_NOT_A_PROTOTYPE');
  assert.equal(declaredCarrier(fn.type),contract.returnType);
  assert.deepEqual(fn.parameters.map(p=>declaredCarrier(p.type)),contract.parameterTypes);
  assert(contract.positive.length&&contract.negative.length,'COMPILER_CONTRACT_HAS_NO_CONTROLS');
  for(const id of contract.positive){
   const proof=evidence.get(id);assert(proof?.nativeConfirmed&&proof.status==='PASS'&&proof.coverage?.coveragePassed,'COMPILER_POSITIVE_NOT_CONFIRMED');
   assert.equal(proof.wholeMapAccepted,false);
  }
  for(const pair of contract.negative){
   const response=evidence.get(pair.response),guard=evidence.get(pair.guard);
   assert.equal(response?.nativeCompilePassed,false,'COMPILER_NEGATIVE_DID_NOT_FAIL');
   assert.equal(response.failureKind,'NATIVE_COMPILE_ERRORS');
   assert(response.diagnostics?.compilerErrors?.length,'COMPILER_NEGATIVE_HAS_NO_DIAGNOSTICS');
   assert.equal(guard?.coverage?.coveragePassed,true,'COMPILER_NEGATIVE_COMPONENT_MISSING');
   assert.equal(guard.responseSha256,profile.evidence.find(e=>e.id===pair.response).sha256);
  }
  contracts.push(Object.freeze({...contract,parameterTypes:Object.freeze([...contract.parameterTypes])}));
 }
 const result=Object.freeze({contracts:Object.freeze(contracts),profilePath,profileSha256,editorSha256:profile.editorSha256});
 qualified.add(result);return result;
}

export function supplementCompilerContracts({sources,missing,qualification}) {
 assert(qualified.has(qualification),'UNQUALIFIED_COMPILER_CONTRACTS');
 const declared=new Set();
 for(const source of sources){
  const ast=parseImmutableGalaxySyntax(source.text,source.fileName);
  assert.equal(ast.parseDiagnostics.length,0,'SOURCE_SYNTAX_INVALID');
  for(const node of ast.statements)if(node.name?.name)declared.add(node.name.name);
 }
 const wanted=new Set(missing),selected=qualification.contracts.filter(c=>wanted.has(c.name)&&!declared.has(c.name));
 return {text:selected.map(c=>c.declaration).join('\n'),evidence:selected.map(c=>({name:c.name,returnType:c.returnType,parameterTypes:c.parameterTypes,
  authority:'qualified-compiler-language-only',profilePath:qualification.profilePath,profileSha256:qualification.profileSha256,
  sourceScriptRewritten:false,implementationsAdded:false,guiDefinitionsAdded:false,guiLoweringAuthorized:false})),
  implementationsAdded:false,syntheticGuiDefinitionsAdded:false,guiLoweringAuthorized:false};
}

import assert from 'node:assert/strict';
import {supplementCompilerContracts} from '../types/qualified-compiler-contracts.mjs';
import {parseImmutableGalaxySyntax as parse} from './immutable-galaxy-syntax.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

// Compiler-only metadata is not an authored include, GUI Native or runtime
// declaration. The existing loader requires pinned Editor/header/control proofs.
export function compilerContractAnalysisInputs(files,qualification){
  if(!qualification)return {files,names:new Set(),evidence:[]};
  const names=new Set();
  const visit=n=>{if(n.kind===K.CallExpression&&n.expression.kind===K.Identifier)names.add(n.expression.name);forEachChild(n,c=>{visit(c);});};
  for(const f of files)visit(f.ast);
  const supplement=supplementCompilerContracts({sources:files,missing:[...names],qualification});
  if(!supplement.text)return {files,names:new Set(),evidence:supplement.evidence};
  const fileName='CompilerContracts/'+qualification.profileSha256+'.galaxy';assert(!files.some(f=>f.fileName.toLowerCase()===fileName.toLowerCase()),'COMPILER_METADATA_PATH_COLLISION');
  return {files:[...files,{fileName,text:supplement.text,ast:parse(supplement.text,fileName),sourceId:'compiler-profile:'+qualification.profileSha256,
    role:'qualified-compiler-interface',owned:false}],names:new Set(supplement.evidence.map(e=>e.name)),evidence:supplement.evidence};
}

// Comparison guard, independent of initializer values and native-effect catalogs.
// An existing initializer body must not become a runtime reset after relocation.
import assert from 'node:assert/strict';
import {Parser,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {provePrivateStartupEntry} from '../model/startup-entry-closure.projected-string-types.mjs';
const parse=text=>{const ast=new Parser().parseFile('header-lifetime.galaxy',text);assert.equal(ast.parseDiagnostics.length,0,'HEADER_LIFETIME_SYNTAX');return ast;};
export function proveHeaderRelocationLifetime(source,externalSources,rule){
 const ast=parse(source),external=externalSources.map(f=>parse(typeof f==='string'?f:f.text));
 const callers=new Map();
 const visit=(n,owner)=>{
  if(n.kind===K.FunctionDeclaration)owner=n.name.name;
  if(n.kind===K.CallExpression&&n.expression?.kind===K.Identifier){const name=n.expression.name,list=callers.get(name)??[];list.push(owner);callers.set(name,list);}
  forEachChild(n,c=>visit(c,owner));
 };
 for(const input of [ast,...external])visit(input);
 const chain=[rule.root];
 while(chain[0]!=='InitMap'){
  assert(chain.length<32,'HEADER_LIFETIME_CHAIN_BOUND');
  const owners=callers.get(chain[0])??[];
  assert.equal(owners.length,1,'HEADER_LIFETIME_NON_PRIVATE_CALLER:'+chain[0]);
  assert(owners[0]&&!chain.includes(owners[0]),'HEADER_LIFETIME_REENTRANT_CALLER');chain.unshift(owners[0]);
 }
 const guard=rule.guardProof;
 assert(guard,'HEADER_LIFETIME_GUARD_ABSENT');
 const completionFlags=[{flag:guard.flag,owner:rule.root},...(guard.variableGuard?[{flag:guard.variableGuard.flag,owner:guard.variableGuard.function}]:[])].filter(f=>f.flag);
 const root=provePrivateStartupEntry(ast,external,chain,{completionFlags});
 const variables=guard.variableGuard?provePrivateStartupEntry(ast,external,[...chain,guard.variableGuard.function],{completionFlags}):undefined;
 return {kind:'PRIVATE_HEADER_RELOCATION_LIFETIME',root,variables,sourceOrCandidateChanged:false};
}

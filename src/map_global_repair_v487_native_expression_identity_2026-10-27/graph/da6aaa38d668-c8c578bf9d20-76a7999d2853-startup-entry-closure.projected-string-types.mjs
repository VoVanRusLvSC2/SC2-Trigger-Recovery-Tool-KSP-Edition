import assert from 'node:assert/strict';
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {proveClosedProtocolNameAbsence} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/01f7dabd0abd-9661957b5246-d37675586f4c-protocol-name-flow.projected-string-types.mjs';

// An earlier initializer may have arbitrary effects only if it cannot reach a
// startup body changed by GUI recovery. A straight-line InitMap path alone is
// insufficient: another direct/indirect entry could run before the moved value.
export function provePrivateStartupEntry(ast,externalAsts,chain,{completionFlags=[]}={}){
 assert(chain.length>=1&&chain[0]==='InitMap'&&new Set(chain).size===chain.length,'STARTUP_ENTRY_INVALID_CHAIN');
 const names=new Set(chain),calls=new Map(chain.map(n=>[n,0])),flagUses=new Map(completionFlags.map(f=>[f.flag,[]]));
 const visit=(node,parent,owner)=>{
  if(node.kind===K.FunctionDeclaration)owner=node.name.name;
  if(node.kind===K.Identifier&&flagUses.has(node.name))flagUses.get(node.name).push({node,parent,owner});
  if(node.kind===K.Identifier&&names.has(node.name)){
   if(!(parent?.kind===K.FunctionDeclaration&&parent.name===node)){
    const i=chain.indexOf(node.name);
    assert(i>0&&parent?.kind===K.CallExpression&&parent.expression===node&&!parent.arguments.length&&owner===chain[i-1],
     'STARTUP_ENTRY_NON_PRIVATE_REFERENCE:'+node.name);
    calls.set(node.name,calls.get(node.name)+1);
   }
  }
  forEachChild(node,child=>visit(child,node,owner));
 };
 for(const file of [ast,...externalAsts])visit(file);
 assert.equal(calls.get('InitMap'),0,'STARTUP_ENTRY_REENTRANT_MAP_ENTRY');
 for(const name of chain.slice(1))assert.equal(calls.get(name),1,'STARTUP_ENTRY_CALL_NOT_UNIQUE:'+name);
 for(const {flag,owner}of completionFlags){
  const uses=flagUses.get(flag),declarations=uses.filter(u=>u.parent?.kind===K.VariableDeclaration&&u.parent.name===u.node);
  assert.equal(uses.length,3,'STARTUP_ENTRY_GUARD_NOT_PRIVATE:'+flag);
  assert.equal(declarations.length,1,'STARTUP_ENTRY_GUARD_DECLARATION:'+flag);
  const declaration=declarations[0].parent;
  assert(declaration.type?.kind===K.BoolKeyword&&!declaration.modifiers?.length&&declaration.initializer?.kind===K.FalseKeyword,'STARTUP_ENTRY_GUARD_INITIALIZER:'+flag);
  assert(uses.filter(u=>!declarations.includes(u)).every(u=>u.owner===owner),'STARTUP_ENTRY_GUARD_FOREIGN_REFERENCE:'+flag);
 }
 const nameFlow=proveClosedProtocolNameAbsence([ast,...externalAsts],[...chain,...completionFlags.map(f=>f.flag)]);
 return {kind:'PRIVATE_EXPLICIT_STARTUP_ENTRY_CHAIN',chain,callCounts:Object.fromEntries(calls),completionFlags,nameFlow,
  boundary:'Supplied Galaxy entries and documented native name consumers; external runtime entry mechanisms remain a separate gate.'};
}

import assert from 'node:assert/strict';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const walk=(n,f,p)=>{f(n,p);forEachChild(n,c=>walk(c,f,n));};
// A private global trigger cell may receive the compiler's mandatory gt_ name.
// Values and every use remain; no storage lookup or foreign reference may see it.
export function qualifyPrivateTriggerHandleIdentities(asts,bindings){
 const records=bindings.filter(b=>b.handle!==b.targetHandle).map(b=>({from:b.handle,to:b.targetHandle}));
 if(!records.length)return {kind:'NO_GLOBAL_TRIGGER_HANDLE_IDENTITIES_CHANGED',records};
 const root=asts[0],globals=root.statements.filter(n=>n.kind===K.VariableDeclaration),changed=new Set(records.flatMap(r=>[r.from,r.to]));
 assert(new Set(records.map(r=>r.from)).size===records.length&&new Set(records.map(r=>r.to)).size===records.length,'TRIGGER_HANDLE_ALIAS_DUPLICATE');
 for(const r of records){const defs=globals.filter(n=>n.name.name===r.from);assert(defs.length===1&&defs[0].type.kind===K.TriggerKeyword&&!defs[0].modifiers?.length,'TRIGGER_HANDLE_SOURCE_GLOBAL_REQUIRED');assert(!root.statements.some(n=>n.name?.name===r.to),'TRIGGER_HANDLE_TARGET_COLLISION');}
 for(const [i,ast]of asts.entries())walk(ast,(n,p)=>{
  if(n.kind===K.Identifier&&n.name==='UnitRefFromVariable')assert(p?.kind===K.FunctionDeclaration&&p.name===n,'TRIGGER_HANDLE_NAMED_STORAGE_OBSERVER');
  if(n.kind!==K.Identifier||!changed.has(n.name)||p?.kind===K.PropertyAccessExpression&&p.name===n)return;
  assert(i===0,'TRIGGER_HANDLE_FOREIGN_IDENTITY_REFERENCE');
  if(p?.kind===K.VariableDeclaration&&p.name===n)assert(globals.includes(p)&&records.some(r=>r.from===n.name),'TRIGGER_HANDLE_LOCAL_SHADOW');
  assert(!(p?.kind===K.ParameterDeclaration&&p.name===n),'TRIGGER_HANDLE_PARAMETER_SHADOW');
  assert(!records.some(r=>r.to===n.name),'TRIGGER_HANDLE_TARGET_ALREADY_REFERENCED');
 });
 return {kind:'CLOSED_PRIVATE_GLOBAL_TRIGGER_CELL_IDENTITIES',records,globalTriggerTypesVerified:true,noNamedStorageConsumers:true,foreignReferencesAbsent:true,valuesAndOperationsUnchanged:true,wholeProgramOracleStillRequired:true};
}
export function verifyActualTriggerHandleTargets(candidate,records){
 for(const r of records){const defs=candidate.statements.filter(n=>n.name?.name===r.to);assert(defs.length===1&&defs[0].kind===K.VariableDeclaration&&defs[0].type.kind===K.TriggerKeyword&&!defs[0].modifiers?.length,'TRIGGER_HANDLE_ACTUAL_NATIVE_TARGET');assert(!candidate.statements.some(n=>n.name?.name===r.from),'TRIGGER_HANDLE_ACTUAL_NATIVE_OLD_CELL');}
}
export function projectPrivateTriggerHandleIdentifiers(ast,records,edit){
 const mapping=new Map(records.map(r=>[r.from,r.to])),globals=ast.statements.filter(n=>n.kind===K.VariableDeclaration);
 for(const r of records){assert(globals.filter(n=>n.name.name===r.from&&n.type.kind===K.TriggerKeyword).length===1,'TRIGGER_HANDLE_VIEW_SOURCE_CELL');assert(!ast.statements.some(n=>n.name?.name===r.to),'TRIGGER_HANDLE_VIEW_TARGET_COLLISION');}
 walk(ast,(n,p)=>{
  if(n.kind!==K.Identifier||!mapping.has(n.name)||p?.kind===K.PropertyAccessExpression&&p.name===n)return;
  assert(!(p?.kind===K.ParameterDeclaration&&p.name===n),'TRIGGER_HANDLE_VIEW_PARAMETER_SHADOW');
  if(p?.kind===K.VariableDeclaration&&p.name===n)assert(globals.includes(p),'TRIGGER_HANDLE_VIEW_LOCAL_SHADOW');
  assert(!(p?.kind===K.FunctionDeclaration&&p.name===n)&&p?.kind!==K.TypeReference,'TRIGGER_HANDLE_VIEW_NAMESPACE_COLLISION');edit(n,mapping.get(n.name));
 });
}
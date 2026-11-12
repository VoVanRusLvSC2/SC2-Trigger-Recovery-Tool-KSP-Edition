// Keep default-valued mutable globals as GUI Variables, without moving their
// header initializer into a runtime reset. Source startup recognition runs on
// the original AST; only the matching GUI initialValue edge is redundant.
import assert from 'node:assert/strict';import {AsyncLocalStorage} from 'node:async_hooks';import {createHash} from 'node:crypto';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const context=new AsyncLocalStorage(),sha=t=>createHash('sha256').update(t).digest('hex');
export function withImplicitGlobalDefaultBindings(records,callback){assert(Array.isArray(records));return context.run(records,callback);}
function paramReferenceCounts(elements,library){
 const counts=new Map(),visited=new WeakSet();
 function walk(value,definition=false){
  if(!value||typeof value!=='object')return;
  // Count incoming edges before deduplicating child traversal: two parents
  // can deliberately share the very same reference object.
  if(!definition&&value.type==='Param'&&typeof value.id==='string'&&(value.library??library)===library)counts.set(value.id,(counts.get(value.id)??0)+1);
  if(visited.has(value))return;visited.add(value);
  for(const child of Object.values(value))if(child&&typeof child==='object')walk(child);
 }
 for(const element of Object.values(elements))walk(element,true);
 return counts;
}
export function createImplicitGlobalDefaultRetainer(previous){
 assert.equal(typeof previous,'function');
 return function retain(args){
  const init=args.initialization;
  if(init&&(init.initialValues!==undefined&&!(init.initialValues instanceof Map)||init.completionGlobals!==undefined&&!(init.completionGlobals instanceof Set)||init.structureValues!==undefined&&!Array.isArray(init.structureValues)))return previous(args);
  let incoming;const counts=new Map(),processed=new Set();for(const n of args.statements)if(n.kind===K.VariableDeclaration)counts.set(n.name.name,(counts.get(n.name.name)??0)+1);
  for(const n of args.statements){
   if(n.kind!==K.VariableDeclaration||!n.initializer||n.type?.kind===K.ArrayType||n.modifiers?.length||counts.get(n.name.name)!==1)continue;
   // That edge may instead encode an explicit executable startup store. Its
   // literal value alone is not evidence that the later reset is redundant.
   if(args.initialization?.initialValues?.has(n.name.name)||args.initialization?.structureValues?.some(e=>e.array===n.name.name)||args.initialization?.completionGlobals?.has(n.name.name))continue;
   const type=args.getTypeName(n.type),literal=type==='bool'&&n.initializer.kind===K.FalseKeyword?'false':type==='trigger'&&n.initializer.kind===K.NullKeyword?'null':undefined;
   if(!literal)continue;const ref=args.globalVars.get(n.name.name),v=ref&&args.elements[ref.id];
   if(!ref||(ref.library??args.libId)!==args.libId||v?.type!=='Variable'||v.variableType?.type!==type||v.variableType.typeElement||v.isConstant||v.isArray)continue;
   const initial=v.initialValue,p=initial&&(initial.library??args.libId)===args.libId&&args.elements[initial.id];
   if(initial?.type!=='Param'||p?.type!=='Param'||p.value!==literal||p.valueType&&p.valueType.type!==type||['scriptCode','functionCall','variable','paramRef','preset','valueElement','expressionCode','expressionText','expressionType','structMember'].some(k=>p[k]!==undefined)||p.arrayIndexes?.length||p.valueParams?.length||p.expressionParams?.length)continue;
   // An initializer Param may be shared by an executable use. Remove its data
   // node only when this Variable owns the sole reference; never rewrite users.
   incoming??=paramReferenceCounts(args.elements,args.libId);const references=incoming.get(p.id)??0;
   delete v.initialValue;incoming.set(p.id,Math.max(0,references-1));if(references===1)delete args.elements[p.id];processed.add(n);
   context.getStore()?.push({library:args.libId,name:n.name.name,variable:ref.id,type,literal,sourceDeclarationSha256:sha(args.printNode(n)),sourceAstChanged:false,guiVariableRetained:true,noRuntimeResetIntroduced:true,sharedInitializerDataPreserved:references>1});
  }
  return previous({...args,statements:args.statements.filter(n=>!processed.has(n))});
 };
}

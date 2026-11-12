import {createNativeStorageReferences} from '../../trigger_ast_core/model/native-storage-reference.constant-extents.mjs';
import {createHeaderIntegerResolver,unchangedFixedLiteral} from '../../trigger_ast_core/model/header-numeric-values.include-once.mjs';
import {planTypedHeaderRetention as planHeaderComponentRetention} from '../../trigger_ast_core/model/header-component-retention.typed.mjs';
import {selectClosedHeaderComponents} from '../../trigger_ast_core/model/header-scalar-components.mjs';
// Per-conversion proof context for mutable scalar header variables. This does
// not prove the whole program. Unknown native effects, observable early reads,
// re-entrant startup or unproved initial values leave the old raw-retention
// protection in place. The original source and oracle are never rewritten.
import assert from 'node:assert/strict';
import {initializersAfterMovedHeader} from '../../trigger_ast_core/model/initialization-order.include-once.mjs';
import {provePrivateStartupEntry} from '../../trigger_ast_core/model/startup-entry-closure.projected-string-types.mjs';
import {verifiedNativeEventEffect,nativeEventEffectEvidence} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v259_typedef_initializer_anchors_2026-10-20/graph/3dec160460c21372-native-event-startup-effects.param-aware.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {Parser,Printer,SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName,unwrapArrayType} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v259_typedef_initializer_anchors_2026-10-20/graph/d14d4b948618471b-g2t-core.mjs';
import {splitEmbeddedLibraries} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v259_typedef_initializer_anchors_2026-10-20/graph/0ad250c2cb118639-embedded-libraries.custom-section-ownership.v2.mjs';
import {closedStartupHeaderBoundary} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v259_typedef_initializer_anchors_2026-10-20/graph/89822bc394b94179-closed-startup-header-boundary.prototypes.mjs';
import {retainInlineCustomGlobals as previousRetain} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v259_typedef_initializer_anchors_2026-10-20/graph/20f220ce064ab7fd-readonly-null-gui.mjs';
const context=new AsyncLocalStorage(),printer=new Printer(),sha=s=>createHash('sha256').update(s).digest('hex');
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
function walk(n,visit){if(!n)return;visit(n);forEachChild(n,c=>walk(c,visit));}
function parse(text){const a=new Parser().parseFile('header-startup.galaxy',text);assert.equal(a.parseDiagnostics.length,0,'HEADER_STARTUP_PARSE');return a;}
const omitted=new Set(['parent','pos','end','line','char','syntaxTokens']);
function shape(n){if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.map(shape);return Object.fromEntries(Object.keys(n).sort().filter(k=>!omitted.has(k)).map(k=>[k,shape(n[k])]));}
// Explicit Galaxy API contracts: these calls do not invoke Galaxy callbacks or
// suspend the current startup thread. Registration is not callback execution.
// Every use must also have the exact, non-overridden actual native declaration.
// Wait, TriggerExecute, timers starting execution, and unknown APIs are absent.
export {startupNativeContracts} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/startup-native-effect-contracts.storage.mjs';
import {startupNativeContracts,startupNativeEffectEvidence,conditionalStorageNativeContracts} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/startup-native-effect-contracts.storage.mjs';

export function proveClosedHeaderStartupGui(source,externalSources=[],eventCapability,initializationOrder){
 const own=parse(source),external=externalSources.map(s=>parse(typeof s==='string'?s:s.text)),all=[own,...external],parts=splitEmbeddedLibraries(source,own)??{libraries:[],map:source};
 const report={sourceSha256:sha(source),externalInputs:externalSources.map(s=>{const text=typeof s==='string'?s:s.text;return {sha256:sha(text),bytes:Buffer.byteLength(text)};}),records:[],refused:[],nativeContracts:startupNativeContracts,nativeEffectEvidence:startupNativeEffectEvidence,trustedEventEffects:nativeEventEffectEvidence(eventCapability),nativeContractScope:'Non-invoking, non-yielding value/registration operations with exact native ABI; other calls refuse',wholeProgramEquivalenceProved:false,accepted:false};
 if(!parts)return report;
 const storageReferences=createNativeStorageReferences(all,{sourceTexts:[source,...externalSources.map(s=>typeof s==='string'?s:s.text)]});
 const definitions=new Map(),declarations=new Map(),globals=new Map();
 for(const ast of all)for(const n of ast.statements){
  if(n.kind===K.FunctionDeclaration){const map=n.body?definitions:declarations,list=map.get(n.name.name)??[];list.push(n);map.set(n.name.name,list);}
  if(n.kind===K.VariableDeclaration){const list=globals.get(n.name.name)??[];list.push(n);globals.set(n.name.name,list);}
 }
 const nativeContract=name=>{
  const event=verifiedNativeEventEffect(eventCapability,name);
  return startupNativeContracts[name]??conditionalStorageNativeContracts[name]??(event?[event.signature.returnType,event.signature.parameterTypes]:undefined);
 };
 const nativeOK=name=>{
  const contract=nativeContract(name),ds=declarations.get(name)??[];
  return contract&&!definitions.has(name)&&!globals.has(name)&&ds.length>0&&ds.every(d=>d.modifiers?.length===1&&d.modifiers[0].kind===K.NativeKeyword&&getTypeName(d.type)===contract[0]&&JSON.stringify(d.parameters.map(p=>getTypeName(p.type)))===JSON.stringify(contract[1]));
 };
 const sourceFunctions=new Map(own.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body).map(n=>[n.name.name,n]));
 for(const part of [...parts.libraries,...(parts.map?[{id:'Map',script:parts.map}]:[])]){
  let storageDiagnostic;
  try{
   const ast=parse(part.script),isMap=part.id==='Map',root=isMap?'InitGlobals':`lib${part.id}_InitLib`,guard=isMap?{completionFlags:[],earlyStages:['InitGlobals'],ownedMapInitializationStage:true}:closedStartupHeaderBoundary(ast.statements,part.id);
   assert(guard,'HEADER_STARTUP_STANDARD_ROOT_NOT_PROVED');
   let candidates=ast.statements.filter(n=>n.kind===K.VariableDeclaration&&!guard.completionFlags.includes(n.name.name)&&n.initializer&&!n.modifiers?.length&&!unwrapArrayType(n.type).sizes.length&&['string','int','bool','fixed'].includes(getTypeName(n.type)));
   assert(candidates.length,'HEADER_STARTUP_NO_CANDIDATES');
   let names=new Set(candidates.map(n=>n.name.name));
   assert([...names].every(n=>globals.get(n)?.length===1),'HEADER_STARTUP_GLOBAL_COLLISION');
   const values=new Map(),numericValueProofs=[];
   const integerValues=createHeaderIntegerResolver({source,externalSources,order:initializationOrder,asts:all,candidates});
   for(const d of candidates){
    const n=unwrap(d.initializer),type=getTypeName(d.type);let value,proved=false;
    if(type==='string'&&n.kind===K.StringLiteral&&/^[\x20-\x7e]*$/u.test(n.value)&&!n.value.includes('\\')){value=n.value;proved=true;}
    if(type==='bool'&&[K.TrueKeyword,K.FalseKeyword].includes(n.kind)){value=n.kind===K.TrueKeyword;proved=true;}
    if(type==='int'&&n.kind===K.NumericLiteral&&/^\d+$/u.test(String(n.value))&&BigInt(n.value)<=2147483647n){value=Number(n.value);proved=true;}
    if(type==='int'&&n.kind===K.PrefixUnaryExpression&&n.operator?.kind===K.MinusToken&&n.operand?.kind===K.NumericLiteral&&/^\d+$/u.test(String(n.operand.value))&&BigInt(n.operand.value)<=2147483648n){value=-Number(n.operand.value);proved=true;}
    if(type==='int'&&n.kind===K.CallExpression&&n.expression?.name==='StringLength'&&n.arguments.length===1&&nativeOK('StringLength')){
     const arg=unwrap(n.arguments[0]);if(arg.kind===K.Identifier&&typeof values.get(arg.name)==='string'){value=values.get(arg.name).length;proved=true;}
    }
    if(type==='fixed'){const fixed=unchangedFixedLiteral(n);if(fixed){value=fixed;proved=true;}}
    if(type==='int'&&!proved){const evaluated=integerValues.evaluate(n,d.name.name,values);if(evaluated){value=evaluated.value;proved=true;numericValueProofs.push(evaluated.proof);}}
    if(proved)values.set(d.name.name,value);
   }
   const componentPlan=selectClosedHeaderComponents(all,candidates,new Set(values.keys()));
   candidates=componentPlan.selected;names=new Set(candidates.map(n=>n.name.name));
   assert(candidates.length,'HEADER_STARTUP_NO_CLOSED_INDEPENDENT_COMPONENT');
   // Locate a unique straight-line source entry path. Only the prefix before
   // the first library entry can observe the changed initialization time.
   const paths=[],entryChains=[];
   const find=(name,prefix,stack)=>{
    assert(stack.length<32,'HEADER_STARTUP_PATH_BOUND');if(stack.includes(name))return;
    if(name===root){paths.push(prefix);entryChains.push([...stack,name]);return;}
    const fn=sourceFunctions.get(name);if(!fn||definitions.get(name)?.length!==1||fn.parameters.length||getTypeName(fn.type)!=='void')return;
    const ss=fn.body.statements;
    if(!ss.every(s=>s.kind===K.ExpressionStatement&&s.expression?.kind===K.CallExpression&&s.expression.expression?.kind===K.Identifier&&s.expression.arguments.length===0))return;
    for(let i=0;i<ss.length;i++){
     const call=ss[i].kind===K.ExpressionStatement?ss[i].expression:undefined;
     if(call?.kind!==K.CallExpression||call.expression?.kind!==K.Identifier||call.arguments.length)continue;
     find(call.expression.name,[...prefix,...ss.slice(0,i)], [...stack,name]);
    }
   };
   assert(sourceFunctions.has('InitMap'),'HEADER_STARTUP_ENTRY_ABSENT');find('InitMap',[],[]);assert.equal(paths.length,1,'HEADER_STARTUP_PATH_NOT_UNIQUE');
   // Moving a mutable header store into a callable body changes every later
   // invocation too. Scanning early effects alone cannot exclude a runtime
   // reset. Require a private, single entry even without include-order data;
   // guarded library roots keep the same conservative lifetime requirement.
   const completionFlags=[{flag:guard.flag,owner:root},...(guard.variableGuard?[{flag:guard.variableGuard.flag,owner:guard.variableGuard.function}]:[])].filter(f=>f.flag);
   const privateEntry=provePrivateStartupEntry(own,external,entryChains[0],{completionFlags});
   if(guard.variableGuard)provePrivateStartupEntry(own,external,[...entryChains[0],guard.variableGuard.function],{completionFlags});
   const conditionalNativeUses=[];
   const protectedNames=new Set([...names,...guard.completionFlags]),nativeUses=new Set(),visited=new Set();let steps=0;
   const check=(node,stack=[])=>{
    walk(node,n=>{
     assert(++steps<2000000,'HEADER_STARTUP_SCAN_BOUND');
     assert(n.kind!==K.Identifier||!protectedNames.has(n.name),'HEADER_STARTUP_EARLY_GLOBAL_OBSERVATION');
     if(n.kind!==K.CallExpression)return;
     assert(n.expression?.kind===K.Identifier,'HEADER_STARTUP_INDIRECT_CALL');const name=n.expression.name;
     const calleeBinding=storageReferences.calleeStatus(n);assert(calleeBinding==='GLOBAL','HEADER_STARTUP_CALLEE_NOT_GLOBAL:'+name+':'+calleeBinding);
     if(nativeOK(name)){assert.equal(n.arguments.length,nativeContract(name)[1].length,'HEADER_STARTUP_NATIVE_ARGUMENT_COUNT');if(conditionalStorageNativeContracts[name]){
      const storage=storageReferences.resolveLiteral(n.arguments[0],'unit',protectedNames);
      if(!storage)storageDiagnostic={native:name,argument:printer.printNode(n.arguments[0]),stack};
      assert(storage,'HEADER_STARTUP_NATIVE_STORAGE_REFERENCE_NOT_CLOSED:'+name);
      conditionalNativeUses.push({name,storage});
     }nativeUses.add(name);return;}
     const defs=definitions.get(name);assert(defs?.length===1&&!globals.has(name),'HEADER_STARTUP_UNKNOWN_CALL:'+name);
     assert(!stack.includes(name),'HEADER_STARTUP_REENTRANT_PREFIX');
     if(visited.has(name))return;visited.add(name);check(defs[0].body,[...stack,name]);
    });
   };
   // Header initializers in every source are evaluated before entry. They may
   // neither observe a moved value nor dispatch/yield through an unknown API.
   let headerInterval;
   if(initializationOrder){
    headerInterval=initializersAfterMovedHeader(initializationOrder,source,externalSources,names);
    headerInterval.proof.privateEntry=privateEntry;
    for(const initializer of headerInterval.initializers)check(initializer);
   }else{
    for(const input of all)for(const d of input.statements)if(d.kind===K.VariableDeclaration&&d.initializer&&!names.has(d.name.name))check(d.initializer);
   }
   for(const statement of paths[0])check(statement);
   for(const name of guard.earlyStages){const fs=definitions.get(name);assert.equal(fs?.length,1,'HEADER_STARTUP_STAGE_BINDING');const fn=fs[0];if(guard.variableGuard?.function===name)check({...fn.body,statements:fn.body.statements.slice(guard.variableGuard.prefixLength)});else check(fn.body);visited.add(name);}
   report.records.push({libraryId:part.id,root,variables:candidates.map(d=>({name:d.name.name,type:getTypeName(d.type),initializerShape:shape(d.initializer),closedInitialValue:values.get(d.name.name)})),guardProof:guard,numericValues:{...integerValues.evidence,records:numericValueProofs},componentPlan:componentPlan.proof,prefixFunctions:[...visited],nativeUses:[...nativeUses],noEarlyReadsWritesCallbacksOrYield:true,initializationOrder:candidates.map(d=>d.name.name),nativeEffectsAreExplicitContracts:true,conditionalNativeUses:conditionalNativeUses.filter(r=>nativeUses.has(r.name)),...(headerInterval?{headerInterval:headerInterval.proof}:{}),privateEntry,lifetimePolicy:'PRIVATE_SINGLE_ENTRY_REQUIRED'});
  }catch(error){report.refused.push({libraryId:part.id,reason:String(error.message),...(storageDiagnostic?{storageDiagnostic}:{})});}
 }
 return report;
}
export function withClosedHeaderStartupGui(proof,callback){
 assert(proof?.records&&/^[0-9a-f]{64}$/u.test(proof.sourceSha256));return context.run(proof,callback);
}
export function retainInlineCustomGlobals(args){
 const proof=context.getStore(),rule=proof?.records.find(r=>r.libraryId===args.libId);
 if(!rule)return previousRetain(args);
 const plan=planHeaderComponentRetention(args,rule,shape);
 (proof.retentionAttempts??=[]).push({library:args.libId,...plan.proof});
 if(!plan.proof.applied.length)return previousRetain(args);
 return previousRetain({...args,statements:plan.statements});
}

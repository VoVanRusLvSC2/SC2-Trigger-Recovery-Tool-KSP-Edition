import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {indexSourceFunctionDeclarations,canonicalSourceFunctionDeclaration} from "../model/source-function-declarations.mjs";
import {SyntaxKind as K} from "../sdk/array-values/modules/galaxy/language-core/index.js";
const sha=s=>createHash('sha256').update(s).digest('hex'),plans=new WeakMap();
const voidZero=n=>n?.kind===K.FunctionDeclaration&&n.body&&n.type?.kind===K.VoidKeyword&&n.parameters.length===0&&
 !n.modifiers?.some(m=>[K.StaticKeyword,K.NativeKeyword].includes(m.kind));

// Partition an original direct-call phase around the actual automatic GUI
// initializer sequence. This never moves a call across another source effect.
export function planSourceInitializerWeave({program,fileName,phaseName,automaticNames}){
 assert(program?.documents instanceof Map,'SOURCE_PHASE_BOUND_PROGRAM_REQUIRED');
 const ast=program.documents.get(fileName),identity=program.verifiedInputIdentity(fileName);
 assert(ast&&identity?.contentSha256===sha(ast.text),'SOURCE_PHASE_VERIFIED_SOURCE_REQUIRED');
 const declarations=indexSourceFunctionDeclarations(program.documents),group=declarations.get(phaseName);
 assert.equal(group?.status,'UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES','SOURCE_PHASE_UNIQUE_BODY_REQUIRED');
 const phase=group.body.node;assert(voidZero(phase)&&group.body.fileName===fileName,'SOURCE_PHASE_VOID_ZERO_REQUIRED');
 assert(Array.isArray(automaticNames)&&automaticNames.length&&automaticNames.every(n=>typeof n==='string')&&new Set(automaticNames).size===automaticNames.length,'SOURCE_PHASE_AUTOMATIC_SEQUENCE_REQUIRED');
 const calls=[];
 for(const statement of phase.body.statements){
  const call=statement.kind===K.ExpressionStatement&&statement.expression;
  assert(call?.kind===K.CallExpression&&call.expression.kind===K.Identifier&&call.arguments.length===0,'SOURCE_PHASE_DIRECT_ZERO_ARGUMENT_CALL_REQUIRED');
  assert.equal(program.getBinding(call.expression).status,'BOUND','SOURCE_PHASE_TARGET_BOUND_REQUIRED');
  const target=canonicalSourceFunctionDeclaration(declarations,program.declarationAt(call.expression));
  assert(voidZero(target)&&declarations.get(target.name.name)?.status==='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES','SOURCE_PHASE_TARGET_VOID_ZERO_BODY_REQUIRED');
  const location=program.location(target);assert(location?.contentSha256,'SOURCE_PHASE_TARGET_SOURCE_REQUIRED');
  calls.push(Object.freeze({name:target.name.name,start:statement.pos,end:statement.end,callSha256:sha(ast.text.slice(statement.pos,statement.end)),target:location}));
 }
 const automatic=new Set(automaticNames),projected=calls.filter(c=>automatic.has(c.name));
 assert.deepEqual(projected.map(c=>c.name),automaticNames,'SOURCE_PHASE_AUTOMATIC_ORDER_OR_MULTIPLICITY_CHANGED');
 const prefix=[],slots=[];let slot;
 for(const call of calls){
  if(automatic.has(call.name)){slot={automaticName:call.name,calls:[]};slots.push(slot);}
  else(slot?.calls??prefix).push(call);
 }
 const capability=Object.freeze({kind:'BOUND_SOURCE_INITIALIZER_WEAVE',sourceSha256:identity.contentSha256,phaseName});
 const plan=Object.freeze({fileName,phaseName,sourceSha256:identity.contentSha256,calls:Object.freeze(calls),prefix:Object.freeze(prefix),
  slots:Object.freeze(slots.map(s=>Object.freeze({...s,calls:Object.freeze(s.calls)})))});
 plans.set(capability,plan);
 return {capability,proof:{...plan,newNative:0,newRuntimeFunctions:0,sourceChanged:false,guiEmissionAuthorized:false,wholeMapAccepted:false}};
}

// A native Event+Operator expands directly inside the existing trigger Init.
// Return plain metadata only; the caller must independently verify the entire
// phase, prefix handling, symbol ownership and the packed output before use.
export function sourceInitializerSlotDefinitions(capability,{library,automaticName,definitionId,callId}){
 const plan=plans.get(capability);assert(plan,'SOURCE_PHASE_UNTRUSTED_CAPABILITY');
 const slot=plan.slots.find(s=>s.automaticName===automaticName);assert(slot,'SOURCE_PHASE_AUTOMATIC_SLOT_MISSING');
 assert(typeof library==='string'&&library&&typeof definitionId==='string'&&definitionId&&typeof callId==='string'&&callId&&definitionId!==callId,'SOURCE_PHASE_TYPED_IDENTITIES_REQUIRED');
 if(!slot.calls.length)return undefined;
 return {definition:{type:'FunctionDef',library,id:definitionId,flags:['Event','Operator'],isFuncEvent:true,returnType:{type:'void'},
   scriptCode:slot.calls.map(c=>c.name+'();').join('\n')},
  call:{type:'FunctionCall',library,id:callId,functionDef:{type:'FunctionDef',library,id:definitionId},parameters:[]},
  sourceCallHashes:slot.calls.map(c=>c.callSha256),sourcePhaseSha256:plan.sourceSha256,
  prefixCallsStillRequired:plan.prefix.length,newNative:0,newRuntimeFunctions:0,guiEmissionAuthorized:false,wholeMapAccepted:false};
}

export function verifySourceInitializerSlotExport({capability,automaticName,exportAst}){
 const plan=plans.get(capability);assert(plan,'SOURCE_PHASE_UNTRUSTED_CAPABILITY');
 const slot=plan.slots.find(s=>s.automaticName===automaticName);assert(slot,'SOURCE_PHASE_AUTOMATIC_SLOT_MISSING');
 assert.equal(exportAst.parseDiagnostics.length,0,'SOURCE_PHASE_NATIVE_EXPORT_SYNTAX');
 const owners=exportAst.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body&&n.name.name===automaticName);
 assert.equal(owners.length,1,'SOURCE_PHASE_NATIVE_SLOT_UNIQUE');
 const statements=owners[0].body.statements,tail=slot.calls.length?statements.slice(-slot.calls.length):[];
 assert.equal(tail.length,slot.calls.length,'SOURCE_PHASE_NATIVE_CALLS_MISSING');
 for(const [i,statement]of tail.entries()){
  const call=statement.kind===K.ExpressionStatement&&statement.expression;
  assert(call?.kind===K.CallExpression&&call.expression?.kind===K.Identifier&&call.expression.name===slot.calls[i].name&&call.arguments.length===0,'SOURCE_PHASE_NATIVE_CALL_ORDER_OR_ABI_CHANGED');
 }
 return {automaticName,sourcePhaseSha256:plan.sourceSha256,calls:slot.calls.map(c=>c.name),exactSlotTail:true,
  prefixCallsStillRequired:plan.prefix.length,wholePhaseAccepted:false,wholeMapAccepted:false};
}

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalizeSourceBoundTriggerAliases as lexical} from './source-bound-trigger-aliases.preserve-identities.mjs';
import {proveClosedProtocolNameAbsence} from '../analysis/protocol-name-flow.projected-string-types.mjs';
import {inspectNamedStorageObservers} from '../analysis/named-storage-observers.mjs';
import {Parser,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {startupFunctionName,withImplicitLibrary} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
const sha=t=>createHash('sha256').update(t).digest('hex');
const walk=(n,f,p)=>{f(n,p);forEachChild(n,c=>walk(c,f,n));};

/** Preserve-mode permission for private root roles, never for owned includes,
 * existing GUI, renamed storage, opaque dispatch or observable callback names.
 * This establishes alpha permission only; Native and whole-program checks
 * remain mandatory and must independently re-establish the same permission. */
export function qualifyPrivateRootTriggerAliases(input){
 const scope=input.sourceEligibility;
 assert(scope&&scope.existingTriggerData===undefined&&Array.isArray(scope.ownedSources)&&!scope.ownedSources.length,'ROOT_ALIAS_PROTECTED_SOURCE_SCOPE');
 const proposal=lexical({...input,document:undefined,preserveSourceIdentities:false});
 if(!proposal.proof.edits)return {text:input.text,proof:{kind:'PRIVATE_ROOT_TRIGGER_ALPHA_NOT_NEEDED',bindings:[],edits:0,sourceArchiveChanged:false}};
 assert(proposal.proof.bindings.every(b=>b.handle===b.targetHandle),'ROOT_ALIAS_STORAGE_RENAME_NOT_AUTHORIZED');
 const files=[{name:'MapScript.galaxy',text:input.text},...(input.otherSources??[])];
 const asts=files.map(f=>{const ast=new Parser().parseFile(f.name,f.text);assert.equal(ast.parseDiagnostics.length,0,'ROOT_ALIAS_SOURCE_SYNTAX');return ast;});
 const root=asts[0],all=asts.flatMap(a=>a.statements),create=all.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name==='TriggerCreate');
 assert(create.length&&create.every(n=>!n.body&&n.modifiers?.length===1&&n.modifiers[0].kind===K.NativeKeyword&&n.type.kind===K.TriggerKeyword&&n.parameters.length===1&&n.parameters[0].type.kind===K.StringKeyword&&!n.parameters[0].isReference),'ROOT_ALIAS_NATIVE_CREATE_ABI_REQUIRED');
 assert(!all.some(n=>n.kind!==K.FunctionDeclaration&&n.name?.name==='TriggerCreate'),'ROOT_ALIAS_NATIVE_CREATE_SHADOWED');
 const names=new Set(withImplicitLibrary('Map',()=>['InitLib','InitLibraries','InitVariables','InitCustomScript','InitTriggers'].map(role=>startupFunctionName('Map',role))));
 for(const n of root.statements)if(n.kind===K.FunctionDeclaration&&n.body)names.add(n.name.name);
 const changed=new Set(),storageNames=new Set(),masks=[];
 for(const b of proposal.proof.bindings){
  names.add(b.constructor.to);names.add(b.callback.to);
  const ctor=root.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body&&n.name.name===b.constructor.from),callback=root.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body&&n.name.name===b.callback.from);
  assert(ctor.length===1&&callback.length===1&&!ctor[0].modifiers?.length&&!callback[0].modifiers?.length&&ctor[0].type.kind===K.VoidKeyword&&!ctor[0].parameters.length&&callback[0].type.kind===K.BoolKeyword&&callback[0].parameters.length===2&&callback[0].parameters.every(p=>p.type.kind===K.BoolKeyword&&!p.isReference),'ROOT_ALIAS_CALLBACK_ABI');
  const call=ctor[0].body.statements[0]?.expression?.right;
  assert(call?.kind===K.CallExpression&&call.expression.kind===K.Identifier&&call.expression.name==='TriggerCreate'&&call.arguments.length===1&&call.arguments[0].kind===K.StringLiteral&&call.arguments[0].value===b.callback.from,'ROOT_ALIAS_EXACT_REGISTRATION_REQUIRED');
  walk(ctor[0],n=>{assert(!(n.kind===K.VariableDeclaration&&n.name.name==='TriggerCreate'),'ROOT_ALIAS_NATIVE_CREATE_LOCAL_SHADOW');});
  masks.push(call.arguments[0]);
  for(const [from,to]of [[b.constructor.from,b.constructor.to],[b.callback.from,b.callback.to]])if(from!==to)changed.add(from);
  for(const p of b.parameters){storageNames.add(p.from);storageNames.add(p.to);}
 }
 let storageConsumers=false;
 for(let i=0;i<asts.length;i++)walk(asts[i],(n,p)=>{
  const declaration=p?.kind===K.FunctionDeclaration&&p.name===n;
  if(n.kind===K.Identifier&&n.name==='TriggerGetFunction'&&!declaration)throw Error('ROOT_ALIAS_CALLBACK_NAME_GETTER');
  if(n.kind===K.Identifier&&n.name==='UnitRefFromVariable'&&!declaration)storageConsumers=true;
  if(n.kind===K.Identifier&&changed.has(n.name)){
   const field=p?.kind===K.PropertyAccessExpression&&p.name===n;
   assert(i===0&&(declaration||field||p?.kind===K.CallExpression&&p.expression===n),'ROOT_ALIAS_ESCAPING_FUNCTION_REFERENCE');
  }
 });
 // A bound, exact source registration is renamed together with its callback.
 // Other name consumers still see the complete original source closure.
 let masked=input.text;
 for(const m of masks.sort((a,b)=>b.pos-a.pos))masked=masked.slice(0,m.pos)+'""'+masked.slice(m.end);
 const maskedRoot=new Parser().parseFile('MapScript.galaxy',masked);assert.equal(maskedRoot.parseDiagnostics.length,0);
 const flow=proveClosedProtocolNameAbsence([maskedRoot,...asts.slice(1)],[...names]);
 let storage={kind:'NO_STANDARD_STORAGE_PATH_CONSUMERS',calls:[]};
 if(storageConsumers){storage=inspectNamedStorageObservers(input.text,[...storageNames],{externalSources:files.slice(1).map(f=>({fileName:f.name,text:f.text}))});assert(!storage.unknownObserverInput&&!storage.observedNames.length,'ROOT_ALIAS_PARAMETER_NAME_OBSERVED');}
 return {text:proposal.text,proof:{kind:'BOUND_PRIVATE_ROOT_TRIGGER_ALPHA',...proposal.proof,sourceClosure:files.map(f=>({fileName:f.name,sha256:sha(f.text)})),
  nativeCreateAbi:'trigger(string)',sourceRegistrationSlots:masks.length,flow,storage,originalGuiAbsent:true,ownedSourceFilesAbsent:true,storageIdentifiersUnchanged:true,
  callbackNameGettersAbsent:true,newRuntimeFunctions:0,newNative:0,newCustomScript:0,alphaPermissionOnly:true,wholeMapAccepted:false}};
}

export function canonicalizeSourceBoundTriggerAliases(input){
 if(!input.preserveSourceIdentities)return lexical(input);
 const unchanged=()=>lexical(input);
 if(!input.sourceEligibility)return unchanged();
 let result;
 try{result=qualifyPrivateRootTriggerAliases(input);}catch(e){const kept=unchanged();return {...kept,proof:{...kept.proof,privateRootAlphaRefused:e.message}};}
 if(result.text!==input.text&&input.document)input.document.output(result.text);
 return result;
}

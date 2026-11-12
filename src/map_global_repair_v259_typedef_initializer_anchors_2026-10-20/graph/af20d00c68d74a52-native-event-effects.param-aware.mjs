// Registration effects come from a hash-bound trusted NativeLib Event role,
// not an API-name prefix. The existing candidate resolver supplies ownership,
// hidden-trigger and carrier checks; this adds a no-unknown-carrier guard.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v259_typedef_initializer_anchors_2026-10-20/graph/d14d4b948618471b-g2t-core.mjs';
import {resolveNativeRoleCandidate} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/trigger_ast_implementation_2026-10-07/source-bug-v1670/native-role-candidate.mjs';
import {readAuthoredTriggerDocument} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/read_authored_trigger_document_v1632.mjs';
import {formalGalaxyCarrier} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/trigger_ast_core/types/formal-galaxy-carrier.mjs';

// Each facade owns one producer/verifier context. Inject the frozen ABI index
// instead of mutating an older index prototype or mixing capability stores.
export function createNativeEventEffectTools(FunctionCandidateIndex,deriveNativeTypeMapping){
assert.equal(typeof deriveNativeTypeMapping,'function','EVENT_EFFECT_TYPE_CONTEXT_REQUIRED');
const sha=b=>createHash('sha256').update(b).digest('hex'),capabilities=new WeakMap();
function freeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
const parse=text=>{const a=new Parser().parseFile('event-effect-input.galaxy',text);assert.equal(a.parseDiagnostics.length,0,'EVENT_EFFECT_DECLARATION_PARSE');return a;};
function classifyNativeEventContracts(library,externalSources=[]){
 // Resolve editor-only carriers in the SAME owning type context as this ABI
 // index. Signature comparison must not compare GUI `control` to Galaxy int.
 // This does not alter ParamDefs or infer effects for non-Event operations.
 deriveNativeTypeMapping(library,externalSources.map((s,i)=>typeof s==='string'?{fileName:`event-declaration-${i}.galaxy`,text:s}:s));
 const index=new FunctionCandidateIndex([library]),declarations=new Map(),overrides=new Set(),records=[],refused=[];
 for(const source of externalSources)for(const n of parse(typeof source==='string'?source:source.text).statements){
  if(n.kind===K.VariableDeclaration)overrides.add(n.name.name);
  if(n.kind!==K.FunctionDeclaration)continue;
  if(n.body){overrides.add(n.name.name);continue;}
  const list=declarations.get(n.name.name)??[];list.push(n);declarations.set(n.name.name,list);
 }
 for(const [name,ds]of declarations){
  const candidates=(index.bySymbol.get(name)??[]).filter(c=>c.origin==='emitted'&&c.library.id===library.id&&c.definition.flags?.includes('Native')&&c.definition.flags.includes('Event')&&!c.definition.disabled&&!c.definition.scriptCode);
  if(!candidates.length)continue;
  const signature=d=>({returnType:getTypeName(d.type),parameters:d.parameters.map(p=>getTypeName(p.type))}),s=signature(ds[0]);
  if(overrides.has(name)||ds.some(d=>d.modifiers?.length!==1||d.modifiers[0].kind!==K.NativeKeyword||JSON.stringify(signature(d))!==JSON.stringify(s))){refused.push({name,reason:'NON_NATIVE_OVERRIDE_OR_CONFLICT'});continue;}
  const resolution=resolveNativeRoleCandidate(index,{name,declaration:s},'Event');
  if(resolution.status!=='RESOLVED'||resolution.definition.library!==library.id){refused.push({name,reason:resolution.status});continue;}
  const fd=resolution.definition;
  const carriers=(fd.parameters??[]).map(r=>{const p=index.formal(r,library);return p?formalGalaxyCarrier(index,p,library,fd):undefined;});
  const expected=['trigger',...carriers];
  if(s.returnType!=='void'||index.carrier(fd.returnType,library)!=='void'||carriers.some(t=>!t)||JSON.stringify(expected)!==JSON.stringify(s.parameters)){refused.push({name,reason:'UNKNOWN_OR_MISMATCHED_EVENT_CARRIER'});continue;}
  records.push({name,signature:{returnType:s.returnType,parameterTypes:s.parameters},owner:resolution.owner,eventFunctionId:fd.id,hiddenTrigger:true,role:'Event',native:true,effect:'EVENT_REGISTRATION_ONLY',mayInvokeGalaxySynchronously:false,mayYield:false});
 }
 return {records,refused,accepted:false};
}
async function createTrustedNativeEventEffects(prepared,externalSources,sdk){
 const anchorUrl=new URL('../../queue_audit_2026-10-15/TRUSTED_NATIVE_EVENT_GUI_ANCHOR_20261016.json',"file:///K:/SC2_MAP_Workspace/sc2_editor_C++/trigger_ast_core/bindings/native-event-effects.param-aware.mjs"),anchorBytes=await readFile(anchorUrl),anchor=JSON.parse(anchorBytes);
 const inputs=prepared.dependencyInputs.filter(d=>d.group==='NativeLib');assert.equal(inputs.length,1,'TRUSTED_NATIVE_GUI_OWNER_NOT_UNIQUE');
 const input=inputs[0].triggerData;assert.equal(input.sha256,anchor.nativeGui.sha256,'TRUSTED_NATIVE_GUI_VERSION_CHANGED');const bytes=await readFile(input.path);assert.equal(sha(bytes),anchor.nativeGui.sha256,'TRUSTED_NATIVE_GUI_BYTES_CHANGED');
 const {document,scopeProof}=await readAuthoredTriggerDocument(bytes.toString('utf8'),sdk);assert.equal(document.libraries.size,1,'TRUSTED_NATIVE_GUI_MIXED_OWNERS');const library=document.libraries.get('Ntve');assert(library,'TRUSTED_NATIVE_GUI_SCOPE');
 const classified=classifyNativeEventContracts(library,externalSources),evidence={anchorSha256:sha(anchorBytes),nativeGui:{path:input.path,sha256:sha(bytes)},scopeProof,...classified,semanticBasis:'The trusted GUI Event role represents registration; this is not inferred from a Galaxy function-name prefix or from ABI alone.'};
 freeze(evidence);const capability=Object.freeze({evidence});capabilities.set(capability,new Map(evidence.records.map(r=>[r.name,r])));return capability;
}
function verifiedNativeEventEffect(capability,name){return capability&&capabilities.get(capability)?.get(name);}
function nativeEventEffectEvidence(capability){return capability&&capabilities.has(capability)?capability.evidence:undefined;}

return Object.freeze({classifyNativeEventContracts,createTrustedNativeEventEffects,verifiedNativeEventEffect,nativeEventEffectEvidence});
}

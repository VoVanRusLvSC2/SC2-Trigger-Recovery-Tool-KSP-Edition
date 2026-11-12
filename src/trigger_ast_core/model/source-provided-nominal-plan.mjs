import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {resolveBoundStructref,resolveBoundTypeAlias} from '../types/bound-type-alias.mjs';
import {indexSourceFunctionDeclarations} from './source-function-declarations.mjs';
import {createSourceProvidedNominalProxy,createSourceProvidedTypedFunctionDescription} from '../gui/source-provided-nominal-interfaces.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const walk=(node,visit)=>{visit(node);forEachChild(node,n=>walk(n,visit));};
const root=node=>{while(node?.parent)node=node.parent;return node;};
const unwrap=node=>{while(node?.kind===K.ParenthesizedExpression)node=node.expression;return node;};

/** Build a source-bound interface transaction, not an archive patch or a PASS.
 * A structref invocation no longer implies migrating its entire library to GUI.
 * Header-time consumers stay explicit blockers until declaration order is proved. */
export function planSourceProvidedNominalInterfaces({program,primaryFiles,ownedFiles,library,allocate}){
 const inputs=new Map(),primary=new Set(primaryFiles.map(f=>f.fileName)),owned=new Set(ownedFiles.map(f=>f.fileName));
 for(const f of [...primaryFiles,...ownedFiles]){
  assert(f.sha256===sha(f.text)&&!inputs.has(f.fileName),'NOMINAL_PLAN_SOURCE_IDENTITY');
  const id=program.verifiedInputIdentity(f.fileName),ast=program.documents.get(f.fileName);
  assert(id?.owned===true&&id.contentSha256===f.sha256&&ast?.text===f.text&&!ast.parseDiagnostics.length,'NOMINAL_PLAN_VERIFIED_SOURCE');
  program.attachOriginal(ast);inputs.set(f.fileName,f);
 }
 const groups=indexSourceFunctionDeclarations(program.documents),proxies=new Map(),functions=new Map(),calls=[],refused=[],headerRequirements=[];
 const used=new Set(),commit=elements=>{for(const e of elements){const k=JSON.stringify([e.library,e.type,e.id]);assert(!used.has(k),'NOMINAL_PLAN_GUI_ID_COLLISION');used.add(k);}};
 const key=node=>{const p=program.location(node);assert(p?.contentSha256,'NOMINAL_PLAN_BOUND_LOCATION');return [p.sourceFile,p.contentSha256,node.pos,node.end].join('|');};
 const nominalAt=type=>{
  const ref=resolveBoundStructref(program,type);if(ref.status==='RESOLVED_STRUCTREF')return ref.nominal;
  const value=resolveBoundTypeAlias(program,type);return value.status==='RESOLVED'?value.nominal:undefined;
 };
 function sourceProxy(node){
  const identity=key(node);if(proxies.has(identity))return proxies.get(identity);
  const source=inputs.get(root(node).fileName);assert(source&&owned.has(source.fileName),'NOMINAL_PLAN_OWNED_TYPE_REQUIRED');
  const p=createSourceProvidedNominalProxy({program,source,symbol:node.name.name,library,allocate,existingIdentities:used});
  commit([p.structure]);proxies.set(identity,p);return p;
 }
 function argumentNominal(node){
  node=unwrap(node);if(!node)return;
  if(node.kind===K.ElementAccessExpression){
   const type=argumentType(node.expression);if(type?.kind!==K.ArrayType||program.getBinding(node.argumentExpression).carrier!=='int')return;
   return nominalAt(type.elementType);
  }
  const type=argumentType(node);return type&&nominalAt(type);
 }
 function argumentType(node){
  node=unwrap(node);
  if(![K.Identifier,K.PropertyAccessExpression].includes(node?.kind)||program.getBinding(node).status!=='BOUND')return;
  const d=program.declarationAt(node);if(![K.VariableDeclaration,K.ParameterDeclaration,K.PropertyDeclaration].includes(d?.kind))return;
  return d.type;
 }
 for(const fileName of primary){const ast=program.documents.get(fileName);
  walk(ast,call=>{
   if(call.kind!==K.CallExpression||call.expression.kind!==K.Identifier)return;
   const binding=program.getBinding(call.expression),bound=program.declarationAt(call.expression);
   if(binding.status!=='BOUND'||bound?.kind!==K.FunctionDeclaration){
    const candidates=groups.get(call.expression.name)?.declarations??[];
    if(candidates.some(r=>owned.has(r.fileName)&&r.node.parameters?.some(p=>resolveBoundStructref(program,p.type).status==='RESOLVED_STRUCTREF')))
     refused.push({source:program.location(call),symbol:call.expression.name,reason:'NOMINAL_PLAN_UNBOUND_SOURCE_CALL_CANDIDATE'});
    return;
   }
   const group=groups.get(bound.name.name),fn=group?.body?.node??bound,owner=root(fn)?.fileName;
   if(!owned.has(owner)||!fn.parameters.some(p=>resolveBoundStructref(program,p.type).status==='RESOLVED_STRUCTREF'))return;
   const location=program.location(call);
   try{
    assert.equal(group?.status,'UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES','NOMINAL_PLAN_UNIQUE_SOURCE_BODY');
    assert.equal(call.arguments.length,fn.parameters.length,'NOMINAL_PLAN_CALL_ARITY');
    const targets=[];
    for(const [i,p]of fn.parameters.entries()){
     const type=resolveBoundStructref(program,p.type);if(type.status!=='RESOLVED_STRUCTREF')continue;
     const actual=argumentNominal(call.arguments[i]);assert(actual&&key(actual)===key(type.nominal),'NOMINAL_PLAN_REFERENCE_ARGUMENT_OWNER');
     targets.push(sourceProxy(type.nominal));
    }
    const identity=key(fn);let description=functions.get(identity);
    if(!description){description=createSourceProvidedTypedFunctionDescription({program,source:inputs.get(owner),symbol:fn.name.name,library,allocate,
     existingIdentities:used,nominalProxies:[...new Set(targets)]});commit([description.definition,...description.parameters]);functions.set(identity,description);}
    calls.push({source:location,function:description.proof.gui,sourceFunction:identity,referenceArgumentOwners:targets.map(p=>p.proof.gui)});
   }catch(error){refused.push({source:location,symbol:fn.name.name,reason:String(error.message).slice(0,300)});}
  });
  // A generated root type/global/prototype is emitted before a source include.
  // Inline call success cannot silently authorize that different declaration phase.
  for(const declaration of ast.statements){
   const uses=declaration.kind===K.StructDeclaration?declaration.members.map(n=>({node:n,type:n.type,role:'STRUCT_MEMBER'})):
    declaration.kind===K.VariableDeclaration?[{node:declaration,type:declaration.type,role:'GLOBAL_STORAGE'}]:
     declaration.kind===K.FunctionDeclaration?[{node:declaration,type:declaration.type,role:'FUNCTION_RESULT'},...declaration.parameters.map(n=>({node:n,type:n.type,role:'FUNCTION_PARAMETER'}))]:[];
   for(const use of uses){let type=use.type;while(type?.kind===K.ArrayType)type=type.elementType;
    if(!type)continue;const target=nominalAt(type);if(!target||!owned.has(root(target)?.fileName))continue;
    headerRequirements.push({source:program.location(use.node),role:use.role,nominal:program.location(target),symbol:target.name.name,
     declarationPhaseProved:false,reason:'SOURCE_NOMINAL_REQUIRED_BEFORE_ROOT_GUI_DECLARATION'});
   }
  }
 }
 return {kind:'SOURCE_PROVIDED_NOMINAL_INTERFACE_TRANSACTION',status:refused.length?'REQUIRES_REFERENCE_ABI_REPAIR':headerRequirements.length?'REQUIRES_NOMINAL_DECLARATION_SCHEDULE':'CANDIDATE_INTERFACES_BOUND',
  primaryFiles:primaryFiles.map(f=>({fileName:f.fileName,sha256:f.sha256})),ownedFiles:ownedFiles.map(f=>({fileName:f.fileName,sha256:f.sha256})),
  proxies:[...proxies.values()],functions:[...functions.values()],calls,refused,headerRequirements,
  allObservedDirectRootStructrefCallsRepresented:refused.length===0,rootDeclarationScheduleProved:headerRequirements.length===0,
  inputChanged:false,originalIncludesRemoved:0,newNative:0,newRuntimeFunctions:0,newOpaqueFallback:0,
  guiPatchAuthorized:false,wholeMapAccepted:false,wholeProgramOracleStillRequired:true};
}

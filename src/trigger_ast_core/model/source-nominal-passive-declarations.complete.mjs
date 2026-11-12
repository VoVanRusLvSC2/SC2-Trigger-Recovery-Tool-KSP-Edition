import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {resolveBoundTypeAlias,resolveBoundStructref} from '../types/bound-type-alias.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const container=node=>{while(node?.parent)node=node.parent;return node;};
const walk=(node,visit)=>{visit(node);forEachChild(node,n=>walk(n,visit));};
const declarationKinds=new Set([K.StructDeclaration,K.TypedefDeclaration,K.VariableDeclaration]);

/** Plan original passive declarations whose nominal type is supplied by an
 * unchanged source include. They cannot be emitted in Editor's early global
 * section. This is a bound source slice, not permission for executable fallback
 * or moving a source library into GUI. Actual order and GUI references still
 * require Native export plus the unchanged complete-program comparison. */
export function planSourceNominalPassiveDeclarations({program,primaryFiles,ownedFiles}){
 const inputs=new Map(),primary=new Set(primaryFiles.map(f=>f.fileName)),owned=new Set(ownedFiles.map(f=>f.fileName));
 for(const f of [...primaryFiles,...ownedFiles]){
  assert(!inputs.has(f.fileName)&&sha(f.text)===f.sha256,'NOMINAL_PASSIVE_SOURCE_IDENTITY');
  const input=program.verifiedInputIdentity(f.fileName),ast=program.documents.get(f.fileName);
  assert(input?.owned===true&&input.contentSha256===f.sha256&&ast?.text===f.text&&!ast.parseDiagnostics.length,'NOMINAL_PASSIVE_VERIFIED_SOURCE');
  program.attachOriginal(ast);inputs.set(f.fileName,f);
 }
 const nodes=primaryFiles.flatMap(f=>program.documents.get(f.fileName).statements.filter(n=>declarationKinds.has(n.kind))),nodeSet=new Set(nodes),dependencies=new Map(),external=new Map(),unprovedTypes=new Set(),failures=[];
 const where=node=>{const p=program.location(node);assert(p?.contentSha256,'NOMINAL_PASSIVE_BOUND_LOCATION');return {...p,name:node.name?.name,declarationSha256:sha(inputs.get(p.sourceFile).text.slice(node.pos,node.end))};};
 const types=node=>node.kind===K.StructDeclaration?node.members.map(n=>n.type):[node.type];
 function addType(owner,type){
  while(type?.kind===K.ArrayType)type=type.elementType;
  if(!type)return;
  const resolved=resolveBoundTypeAlias(program,type);
  if(resolved.status!=='RESOLVED'){unprovedTypes.add(owner);return;}
  if(resolved.node.kind===K.MappedType){unprovedTypes.add(owner);return;}
  const targets=[...resolved.aliases.map(a=>program.documents.get(a.sourceFile).statements.find(n=>n.pos===a.start&&n.end===a.end)),resolved.nominal].filter(Boolean);
  for(const target of targets){
   const file=container(target).fileName;
   if(primary.has(file)&&nodeSet.has(target))dependencies.get(owner).add(target);
   else if(owned.has(file))external.get(owner).add(target);
  }
 }
 for(const n of nodes){dependencies.set(n,new Set());external.set(n,new Set());for(const type of types(n))addType(n,type);}
 const selected=new Set(nodes.filter(n=>external.get(n).size));
 let changed=true;while(changed){changed=false;for(const n of nodes)if(!selected.has(n)&&[...dependencies.get(n)].some(d=>selected.has(d))){selected.add(n);changed=true;}}
 // A declaration needs its root-owned aliases/nominals too, even when they
 // were not themselves a reverse edge from an external type.
 changed=true;while(changed){changed=false;for(const n of [...selected])for(const dep of dependencies.get(n))if(!selected.has(dep)){selected.add(dep);changed=true;}}
 function passive(n){
  if(n.modifiers?.length||n.initializer||unprovedTypes.has(n))return false;
  if(n.kind===K.StructDeclaration&&!n.members.every(m=>m.kind===K.PropertyDeclaration&&!m.modifiers?.length&&!m.initializer))return false;
  let safe=true;for(const type of types(n))walk(type,part=>{
   if(part.kind===K.ArrayType&&part.size?.kind!==K.NumericLiteral)safe=false;
   if([K.CallExpression,K.PostfixUnaryExpression,K.BinaryExpression].includes(part.kind))safe=false;
  });return safe;
 }
 for(const node of selected)if(!passive(node))failures.push({...where(node),reason:'NOMINAL_PASSIVE_DECLARATION_HAS_UNPROVED_INITIALIZATION_OR_TYPE_EXPRESSION'});
 const headerConsumers=[];
 for(const f of primaryFiles)for(const fn of program.documents.get(f.fileName).statements.filter(n=>n.kind===K.FunctionDeclaration)){
  for(const slot of [{node:fn,type:fn.type,role:'FUNCTION_RESULT'},...fn.parameters.map(p=>({node:p,type:p.type,role:'FUNCTION_PARAMETER'}))]){
   let type=slot.type;while(type?.kind===K.ArrayType)type=type.elementType;
   const resolved=resolveBoundTypeAlias(program,type),reference=resolveBoundStructref(program,type),nominal=resolved.nominal??reference.nominal;
   if(selected.has(nominal)||owned.has(container(nominal)?.fileName))headerConsumers.push({...where(slot.node),role:slot.role,reason:'NOMINAL_PASSIVE_FUNCTION_HEADER_REQUIRES_SEPARATE_INTERFACE'});
  }
 }
 const units=[];
 for(const f of primaryFiles){let group=[];const flush=()=>{
   if(!group.length)return;const start=group[0].pos,end=group.at(-1).end,code=f.text.slice(start,end);
   units.push({fileName:f.fileName,sourceSha256:f.sha256,start,end,code,sha256:sha(code),declarations:group.map(where),
    originalDeclarationBytesOnly:true,newRuntimeBodies:0,newInitializationActions:0});group=[];
  };
  for(const node of program.documents.get(f.fileName).statements){if(selected.has(node))group.push(node);else flush();}flush();
 }
 return {kind:'SOURCE_BOUND_PASSIVE_NOMINAL_DECLARATION_PLAN',status:failures.length||headerConsumers.length?'REQUIRES_INTERFACE_REPAIR':'CANDIDATE_PASSIVE_DECLARATIONS_BOUND',
  units,failures,headerConsumers,dependencies:[...selected].map(node=>({declaration:where(node),primary:[...dependencies.get(node)].map(where),owned:[...external.get(node)].map(where)})),
  selectedDeclarations:selected.size,sourceBodiesChanged:false,originalIncludesRemoved:0,newNative:0,newRuntimeFunctions:0,newExecutableFallback:0,
  passiveCustomScriptUnitsRequired:units.length,guiPatchAuthorized:false,nativeOrderQualified:false,completeProgramProofStillRequired:true,wholeMapAccepted:false};
}

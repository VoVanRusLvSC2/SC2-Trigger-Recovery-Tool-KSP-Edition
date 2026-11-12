import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SyntaxKind as K,Printer,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {indexSourceFunctionDeclarations,canonicalSourceFunctionDeclaration} from './source-function-declarations.mjs';
const states=new WeakMap(),printer=new Printer();
const sha=s=>createHash('sha256').update(s).digest('hex');
const digest=n=>sha(printer.printNode(n));
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const walk=(n,f,p)=>{f(n,p);forEachChild(n,c=>walk(c,f,n));};

// Splitting an inlined library must not erase its callers in the parent map.
// This capability transports the existing bound direct-call classification;
// it grants no permission to move startup operations or rename callbacks.
export function capturePartitionStartupOwnership(program,{entryPoint='InitMap'}={}){
 assert(program?.documents instanceof Map&&!program.closed,'PARTITION_STARTUP_BOUND_PROGRAM_REQUIRED');
 const index=indexSourceFunctionDeclarations(program.documents),entry=index.get(entryPoint);
 if(entry?.status!=='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES')return;
 const root=entry.body.node;
 if(root.type.kind!==K.VoidKeyword||root.parameters.length||root.modifiers?.length)return;
 const files=[];
 for(const [fileName,ast] of program.documents){
  assert.equal(program.verifiedInputIdentity(fileName)?.contentSha256,sha(ast.text),'PARTITION_STARTUP_SOURCE_CHANGED');
  program.attachOriginal(ast);files.push({fileName,sha256:sha(ast.text)});
 }
 const outgoing=new Map(),incoming=new Map(),references=new Map();
 const bound=id=>{
  if(id?.kind!==K.Identifier||program.getBinding(id).status!=='BOUND')return;
  const group=index.get(id.name),decl=canonicalSourceFunctionDeclaration(index,program.declarationAt(id));
  if(group?.status==='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES'&&group.body.node===decl)return decl;
 };
 for(const group of index.values())if(group.body){
  const owner=group.body.node;
  walk(owner.body,(n,p)=>{
   if(n.kind===K.Identifier){const rows=references.get(n.name)??[];rows.push({node:n,parent:p});references.set(n.name,rows);}
   if(n.kind!==K.CallExpression)return;
   const callee=un(n.expression),target=bound(callee);if(!target)return;
   const edges=outgoing.get(owner)??[];edges.push(target);outgoing.set(owner,edges);
   const sites=incoming.get(target)??[];sites.push({owner,source:program.location(n)});incoming.set(target,sites);
  });
 }
 const startup=new Set(),pending=[root];
 while(pending.length){const n=pending.pop();if(startup.has(n))continue;startup.add(n);pending.push(...outgoing.get(n)??[]);}
 const functions=new Map();
 for(const [name,group] of index)if(group.body){
  const fn=group.body.node,sites=incoming.get(fn)??[],refs=references.get(name)??[];
  functions.set(name,{sha256:digest(fn),callers:sites.map(s=>({owner:s.owner.name.name,source:s.source,directStartupPath:startup.has(s.owner)})),
   allReferencesAreBoundDirectCalls:refs.every(r=>r.parent?.kind===K.CallExpression&&un(r.parent.expression)===r.node&&bound(r.node)===fn)});
 }
 const proof={kind:'BOUND_PARENT_PARTITION_STARTUP_OWNERSHIP',entryPoint,entrySha256:digest(root),files,
  startupMovementAuthorized:false,callbackRenamingAuthorized:false,nativeDispatchTimingInferred:false};
 const cap=Object.freeze({kind:proof.kind});states.set(cap,{functions,proof});return cap;
}

export function readPartitionStartupOwnership(capability,program){
 if(capability===undefined)return;
 const state=states.get(capability);assert(state,'PARTITION_STARTUP_UNTRUSTED_CAPABILITY');
 assert(program?.documents instanceof Map&&!program.closed,'PARTITION_STARTUP_CHILD_PROGRAM_REQUIRED');
 const index=indexSourceFunctionDeclarations(program.documents);
 return {proof:structuredClone(state.proof),functionOwnership(fn){
  const row=state.functions.get(fn.name?.name),group=index.get(fn.name?.name);
  // A source body from another revision, an overload or a shadow is no witness.
  if(!row||group?.status!=='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES'||group.body.node!==fn||digest(fn)!==row.sha256)return;
  return structuredClone(row);
 }};
}

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGalaxyDocument} from "./galaxy-document.collections.mjs";
import {logicalSourcePath} from "../../model/source-ownership.mjs";
import {removeAlreadyLoadedOwnedIncludes} from "./owned-include-closure.mjs";
import {SyntaxKind as K,forEachChild} from "./index-alternate-3.js";

const sha=text=>createHash('sha256').update(text).digest('hex');

// Source libraries need no synthetic GUI Library. Their startup call is usable
// only when the complete resolved program supplies one unchanged owned body.
// This index is evidence about existing code, never permission to emit a body.
export function proveOwnedStartupFunctions(input,names){
 const closure=removeAlreadyLoadedOwnedIncludes({...input,includeRoot:false}).proof;
 if(closure.completeReachableClosure!==true)return {closure,functions:[],reason:'STARTUP_CLOSED_INCLUDES_REQUIRED'};
 const reachable=new Map(closure.resolvedFiles.map(f=>[logicalSourcePath(f.path),f.sha256]));
 const wanted=new Set(names),symbols=new Map(),shadowed=new Set(),seen=new Set();
 for(const [group,files]of [['root',[input.root]],['owned',input.ownedSources??[]],['external',input.externalSources??[]]])for(const file of files){
  const owner=logicalSourcePath(file.originalPath??file.fileName),digest=sha(file.text);
  if(!reachable.has(owner))continue;
  assert.equal(reachable.get(owner),digest,'STARTUP_REACHABLE_SOURCE_SHA');
  if(file.sha256!==undefined)assert.equal(file.sha256,digest,'STARTUP_DECLARED_SOURCE_SHA');
  const identity=JSON.stringify([owner,digest]);if(seen.has(identity))continue;seen.add(identity);
  const doc=createGalaxyDocument(file);
  try{
   assert.equal(doc.ast.parseDiagnostics.length,0,'STARTUP_SOURCE_SYNTAX');
   for(const node of doc.ast.statements){
    if(wanted.has(node.name?.name)){
     const rows=symbols.get(node.name.name)??[];
     rows.push({group,owner,sourceSha256:digest,declarationSha256:sha(file.text.slice(node.pos,node.end)),
      function:node.kind===K.FunctionDeclaration,body:!!node.body,
      voidZeroAbi:node.type?.kind===K.VoidKeyword&&node.parameters?.length===0,
      forbiddenModifier:!!node.modifiers?.some(m=>[K.NativeKeyword,K.StaticKeyword].includes(m.kind))});
     symbols.set(node.name.name,rows);
    }
    const walk=(n,local=false)=>{const inside=local||n.kind===K.FunctionDeclaration;
     if(inside&&[K.VariableDeclaration,K.ParameterDeclaration].includes(n.kind)&&wanted.has(n.name?.name))shadowed.add(n.name.name);
     forEachChild(n,child=>walk(child,inside));};
    walk(node);
   }
  }finally{doc.dispose();}
 }
 const functions=[];
 for(const name of wanted){
  const rows=symbols.get(name)??[],bodies=rows.filter(r=>r.function&&r.body);
  const valid=rows.length>0&&bodies.length===1&&bodies[0].group==='owned'&&!shadowed.has(name)&&
   rows.every(r=>r.function&&r.voidZeroAbi&&!r.forbiddenModifier);
  functions.push(valid?{name,status:'UNIQUE_OWNED_VOID_ZERO_ABI',...bodies[0]}:
   {name,status:'UNPROVED',declarations:rows.length,bodies:bodies.length,shadowed:shadowed.has(name)});
 }
 return {closure,functions,newRuntimeFunction:false,newNative:false,newCustomScript:false};
}

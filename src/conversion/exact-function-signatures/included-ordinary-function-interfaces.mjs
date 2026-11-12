import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGalaxyDocument} from "./galaxy-document.collections.mjs";
import {logicalSourcePath} from "../../model/source-ownership.mjs";
import {SyntaxKind as K,Printer,forEachChild} from "./index-alternate-3.js";

const sha=text=>createHash('sha256').update(text).digest('hex'),printer=new Printer();
const abi=node=>({returnType:printer.printNode(node.type),parameters:node.parameters.map(p=>({type:printer.printNode(p.type),isReference:!!p.isReference}))});
const sameAbi=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

/** Reuse an ordinary function already supplied by an unchanged, reachable
 * dependency. This only extends the call-interface index: it never generates
 * a body, changes an include, or labels an ordinary function as Native.
 * Root/owned definitions, native declarations, shadowing and ABI ambiguity
 * remain barriers, even when the candidate name resembles a stock API. */
export function withIncludedOrdinaryFunctions(base,input){
 assert.equal(base.closure.completeReachableClosure,true,'DEPENDENCY_INTERFACE_CLOSED_INCLUDES_REQUIRED');
 const reachable=new Map(base.closure.resolvedFiles.map(f=>[logicalSourcePath(f.path),f.sha256]));
 const symbols=new Map(),seen=new Set(),locals=new Set();
 const add=(name,row)=>{const list=symbols.get(name)??[];list.push(row);symbols.set(name,list);};
 for(const [group,files]of [['root',[input.root]],['owned',input.ownedSources??[]],['dependency',input.externalSources??[]]]){
  for(const file of files){
   const owner=logicalSourcePath(file.originalPath??file.fileName),digest=sha(file.text);
   if(group!=='root'&&!reachable.has(owner))continue;
   if(reachable.has(owner))assert.equal(reachable.get(owner),digest,'DEPENDENCY_INTERFACE_SOURCE_SHA');
   if(file.sha256!==undefined)assert.equal(file.sha256,digest,'DEPENDENCY_INTERFACE_DECLARED_SHA');
   const identity=JSON.stringify([owner,digest]);if(seen.has(identity))continue;seen.add(identity);
   const doc=createGalaxyDocument(file);
   try{
    assert.equal(doc.ast.parseDiagnostics.length,0,'DEPENDENCY_INTERFACE_SOURCE_SYNTAX');
    for(const node of doc.ast.statements??[]){
     if(node.kind!==K.FunctionDeclaration){if(node.name?.name)add(node.name.name,{group,kind:'OTHER_GLOBAL'});continue;}
     const signature=abi(node),name=node.name.name;
     add(name,{group,kind:'FUNCTION',body:!!node.body,native:!!node.modifiers?.some(m=>m.kind===K.NativeKeyword),
      static:!!node.modifiers?.some(m=>m.kind===K.StaticKeyword),signature,
      definition:{name,owner,sourceSha256:digest,declarationSha256:sha(file.text.slice(node.pos,node.end)),
       ...signature,parameters:node.parameters.map(p=>({name:p.name.name,type:printer.printNode(p.type),isReference:!!p.isReference})),
       sourceKind:'UNCHANGED_INCLUDED_DEPENDENCY',newRuntimeFunction:false,newNative:false}});
     // A local function-pointer-like identifier must not resolve as a global
     // call interface solely because it shares the dependency function's name.
     const walk=n=>{if([K.VariableDeclaration,K.ParameterDeclaration].includes(n.kind)&&n.name?.name)locals.add(n.name.name);forEachChild(n,walk);};
     for(const p of node.parameters)walk(p);if(node.body)walk(node.body);
    }
   }finally{doc.dispose();}
  }
 }
 const candidates=new Map();
 for(const [name,rows]of symbols){
  const bodies=rows.filter(r=>r.kind==='FUNCTION'&&r.body);
  if(bodies.length!==1||bodies[0].group!=='dependency'||locals.has(name))continue;
  const body=bodies[0];
  if(rows.some(r=>r.kind!=='FUNCTION'||r.native||r.static||!sameAbi(r.signature,body.signature)))continue;
  if(!/^[A-Za-z_]\w*$/u.test(body.signature.returnType)||body.signature.parameters.some(p=>p.isReference||!/^[A-Za-z_]\w*$/u.test(p.type)))continue;
  candidates.set(name,body.definition);
 }
 return Object.freeze({...base,dependencyInterfaces:Object.freeze([...candidates.values()]),resolve(name){
  const prior=base.resolve(name);if(prior.status!=='MISSING')return prior;
  const definition=candidates.get(name);return definition?{status:'UNIQUE_SIMPLE_ABI',definition}:prior;
 }});
}

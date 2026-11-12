import {AsyncLocalStorage} from 'node:async_hooks';
import * as previous from "../exact-function-signatures/bound-source-access.formals.mjs";
import {boundSourceStoragePath} from "./authored-storage-boundary-path.member-tokens.mjs";
import {boundStorageShape} from "../source-axes-integrated/bound-storage-shape.mjs";
import {currentAuthoredStorageScope} from "../../bindings/authored-storage-scope.mjs";
import {SyntaxKind as K} from "../exact-function-signatures/index-alternate-3.js";
export * from "../exact-function-signatures/bound-source-access.formals.mjs";
const scope=new AsyncLocalStorage(),proofs=new WeakMap(),un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
export function withBoundSourceCallReturns(program,operation){
 return scope.run(program,()=>previous.withBoundSourceCallReturns(program,operation));
}
export function authoredStorageBindingProof(binding){return binding&&proofs.get(binding);}
function access(node,mode){
 const program=scope.getStore(),index=currentAuthoredStorageScope()?.index;if(!program||!index?.rootCount)return;
 let candidate=un(node);while([K.PropertyAccessExpression,K.ElementAccessExpression].includes(candidate?.kind))candidate=un(candidate.expression);
 if(candidate?.kind!==K.Identifier)return;
 const declaration=program.declarationAt(candidate),where=declaration&&program.location(declaration),owned=index.resolveGlobal(candidate.name);
 if(declaration?.kind!==K.VariableDeclaration||owned.status!=='UNIQUE_GLOBAL_VALUE'||owned.declaration.sourceSha256!==where?.contentSha256||owned.declaration.declarationStart!==declaration.pos||owned.declaration.declarationEnd!==declaration.end)return;
 const storage=boundSourceStoragePath(program,node,{mode});if(storage.status!=='EXACT_BOUND_SCALAR_STORAGE')return;
 const path=[];let base=un(node);
 while([K.PropertyAccessExpression,K.ElementAccessExpression].includes(base?.kind)){path.unshift(base);base=un(base.expression);}
 const indices=[],steps=[];
 for(const [i,n]of path.entries()){
  const step=storage.steps[i];if(n.kind===K.ElementAccessExpression){indices.push(n.argumentExpression);steps.push({kind:'index',index:indices.length-1,dimension:step.extent});}
  else{
   const field=program.declarationAt(n),owner=field?.parent,where=field&&program.location(field);
   if(!where||owner?.kind!==K.StructDeclaration)return;
   steps.push({kind:'member',name:field.name.name,struct:owner.name.name,sourceFile:where.sourceFile,contentSha256:where.contentSha256,declarationStart:field.pos,declarationEnd:field.end});
  }
 }
 const shape=boundStorageShape(program,declaration.type);
 if(shape.status!=='RESOLVED')return;
 const binding=Object.freeze({name:base.name,sourceFile:storage.root.sourceFile,contentSha256:storage.root.contentSha256,
  declarationStart:storage.root.start,declarationEnd:storage.root.end,elementType:storage.elementType,
  rank:shape.rank,dimensions:Object.freeze([...shape.dimensions]),indices:Object.freeze(indices),steps:Object.freeze(steps.map(Object.freeze)),mode,
  semanticBindingOnly:true,guiBindingAuthorized:false,newRuntimeFunctions:0,newNative:0});
 proofs.set(binding,storage);return binding;
}
export function boundSourceAggregateAccess(node,{mode='read'}={}){
 const binding=access(node,mode);
 return binding&&(mode==='write'||binding.steps.some(s=>s.kind==='member'))?binding:previous.boundSourceAggregateAccess(node,{mode});
}
export function boundSourceValueRead(node){
 const binding=access(node,'read');
 return binding&&!binding.steps.some(s=>s.kind==='member')?binding:previous.boundSourceValueRead(node);
}

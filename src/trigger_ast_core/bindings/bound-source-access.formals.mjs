import {AsyncLocalStorage} from 'node:async_hooks';
import {withBoundSourceCallReturns as withExistingBindings} from './bound-source-call-return.values.mjs';
import {SyntaxKind as K,Printer} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
export * from './bound-source-call-return.values.mjs';
const scope=new AsyncLocalStorage(),printer=new Printer();
const unwrap=node=>{while(node?.kind===K.ParenthesizedExpression)node=node.expression;return node;};
const identity=(program,node)=>{let ast=node;while(ast.parent)ast=ast.parent;const input=program.verifiedInputIdentity(ast.fileName);return input&&{sourceFile:ast.fileName,contentSha256:input.contentSha256,declarationStart:node.pos,declarationEnd:node.end};};

// Bridge the existing call-return scope without duplicating its implementation
// or parser. The aggregate binding expires with this one operation.
export function withBoundSourceCallReturns(program,operation){
 const structNames=program.documents instanceof Map?new Set([...program.documents.values()].flatMap(ast=>ast.statements.filter(n=>n.kind===K.StructDeclaration).map(n=>n.name.name))):undefined;
 const context={program,structNames,active:true};
 return scope.run(context,()=>{
  try{const result=withExistingBindings(program,operation);if(result?.then)return Promise.resolve(result).finally(()=>{context.active=false;});context.active=false;return result;}
  catch(error){context.active=false;throw error;}
 });
}

// Semantic facts only: no GUI/code is emitted or authorized here. Every field
// resolves to its actual PropertyDeclaration in its own source struct.
export function boundSourceAggregateAccess(node,{mode='read'}={}){
 const context=scope.getStore();if(!context?.active||!context.structNames||!['read','write'].includes(mode))return undefined;
 const program=context.program,reverse=[],indices=[];let base=unwrap(node);
 while([K.PropertyAccessExpression,K.ElementAccessExpression].includes(base?.kind)){
  reverse.push(base);base=unwrap(base.expression);
 }
 if(base?.kind!==K.Identifier||program.getBinding(base).status!=='BOUND')return undefined;
 const declaration=program.declarationAt(base),source=declaration&&identity(program,declaration);
 if(declaration?.kind!==K.VariableDeclaration||declaration.parent?.kind!==K.SourceFile||!source||declaration.modifiers?.some(m=>m.kind===K.StaticKeyword)||mode==='write'&&declaration.modifiers?.some(m=>m.kind===K.ConstKeyword))return undefined;
 let type=declaration.type;const steps=[];
 for(const access of reverse.reverse()){
  if(access.kind===K.ElementAccessExpression){
   const index=access.argumentExpression,location=program.location(index);
   if(type?.kind!==K.ArrayType||!location?.contentSha256||program.getBinding(index).carrier!=='int')return undefined;
   indices.push(index);steps.push({kind:'index',index:indices.length-1,dimension:printer.printNode(type.size)});type=type.elementType;
  }else{
   if(type?.kind===K.ArrayType||program.getBinding(access).status!=='BOUND')return undefined;
   const member=program.declarationAt(access),owner=member?.parent,memberSource=member&&identity(program,member);
   if(member?.kind!==K.PropertyDeclaration||owner?.kind!==K.StructDeclaration||owner.name?.name!==printer.printNode(type)||member.name?.name!==access.name?.name||!memberSource||mode==='write'&&member.modifiers?.some(m=>m.kind===K.ConstKeyword))return undefined;
   steps.push({kind:'member',name:member.name.name,struct:owner.name.name,...memberSource});type=member.type;
  }
 }
 if(mode!=='write'&&!steps.some(step=>step.kind==='member')||type?.kind===K.ArrayType||type?.kind===K.MappedType)return undefined;
 const elementType=printer.printNode(type);
 if(context.structNames.has(elementType))return undefined;
 return {name:base.name,...source,elementType,steps,indices,mode,semanticBindingOnly:true,guiBindingAuthorized:false,newRuntimeFunctions:0,newNative:0};
}

// Formal facts come from the exact bound callee, not its display name or the
// apparent type of an argument. Full source/arity/owner fences remain intact.
export function boundSourceCallFormal(call,index){
 const context=scope.getStore();if(!context?.active||call?.kind!==K.CallExpression||!Number.isInteger(index)||index<0||index>=call.arguments.length)return undefined;
 const program=context.program,callee=unwrap(call.expression);if(callee?.kind!==K.Identifier||program.getBinding(callee).status!=='BOUND')return undefined;
 const fn=program.declarationAt(callee);if(fn?.kind!==K.FunctionDeclaration||fn.parent?.kind!==K.SourceFile||fn.parameters.length!==call.arguments.length)return undefined;
 const source=identity(program,fn),formal=fn.parameters[index];if(!source||formal.isReference||[K.ArrayType,K.MappedType].includes(formal.type?.kind))return undefined;
 const galaxyType=printer.printNode(formal.type);if(context.structNames.has(galaxyType)||!/^\w+$/u.test(galaxyType)||galaxyType==='void')return undefined;
 return {name:fn.name.name,formalIndex:index,formalName:formal.name.name,galaxyType,...source,semanticBindingOnly:true,guiBindingAuthorized:false};
}
export function refineBoundCallFormal(call,index,current,convert){
 if(current&&!['any','sameas','sameasparent','return'].includes(current.type))return current;
 const bound=boundSourceCallFormal(call,index),candidate=bound&&convert(bound.galaxyType);
 return candidate&&!['any','sameas','sameasparent','return','void'].includes(candidate.type)?candidate:current;
}

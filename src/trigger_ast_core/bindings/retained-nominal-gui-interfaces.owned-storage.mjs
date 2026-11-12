import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {openVerifiedSourceBindingProgram} from '../model/verified-source-binding-program.lexical-parameters.mjs';
import {planRetainedNominalDeclarations} from './retained-nominal-declarations.mjs';
import {partitionDeclarationViews,logicalSourcePath} from '../model/source-ownership.mjs';
import {indexSourceFunctionDeclarations} from '../model/source-function-declarations.mjs';
import {resolveBoundTypeAlias,resolveBoundStructref} from '../types/bound-type-alias.mjs';
import {createSourceProvidedNominalProxy} from '../gui/source-provided-nominal-interfaces.mjs';
import {SyntaxKind as K,tokenToString,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const originalScope=new AsyncLocalStorage(),generationScope=new AsyncLocalStorage();
const sha=s=>createHash('sha256').update(s).digest('hex'),un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const ref=e=>({library:e.library,type:e.type,id:e.id}),key=e=>JSON.stringify([e.library,e.type,e.id]);
const walk=(n,f)=>{f(n);forEachChild(n,c=>walk(c,f));};
const raw=(p,n)=>{const loc=p.location(n);assert(loc?.contentSha256,'NOMINAL_INTERFACE_SOURCE_LOCATION');const ast=p.documents.get(loc.sourceFile);return {loc,code:ast.text.slice(n.pos,n.end)};};
const signature=e=>e.type!=='FunctionDef'?JSON.stringify(e):JSON.stringify({library:e.library,type:e.type,id:e.id,flags:[...new Set(e.flags??[])].sort(),isFuncAction:e.isFuncAction===true,isFuncCall:e.isFuncCall===true,
 parameters:e.parameters??[],returnType:e.returnType,scriptCode:e.scriptCode?.replace(/\r\n?/gu,'\n'),actions:e.actions,localVariables:e.localVariables,disabled:e.disabled,expressionCode:e.expressionCode,subFunctionTypes:e.subFunctionTypes});

function openOriginal(input,files){
 const views=partitionDeclarationViews(files,input.galaxyDeclarations??[]);assert(!views.conflicts.length,'NOMINAL_INTERFACE_SOURCE_REVISION');
 const text=[input.header,input.script].filter(Boolean).join('\n'),opened=openVerifiedSourceBindingProgram(text,{ownedSources:files,externalSources:views.external,includeEvidence:input.includeEvidence});
 assert(opened.program,'NOMINAL_INTERFACE_CLOSED_PROGRAM_REQUIRED: '+opened.reason);
 const p=opened.program;try{const root=p.documents.get('mapscript.galaxy');assert(root,'NOMINAL_INTERFACE_ORIGINAL_ROOT');
 const owners=new Set(files.map(f=>logicalSourcePath(f.originalPath??f.fileName))),units=planRetainedNominalDeclarations(input),selected=new Set();
 for(const unit of units){const offset=unit.fileName==='header.galaxy'?0:(input.header?input.header.length+1:0);
  for(const d of unit.declarations){const found=root.statements.filter(n=>n.pos===d.start+offset&&n.end===d.end+offset&&n.kind===d.kind&&n.name?.name===d.name);
   assert.equal(found.length,1,'NOMINAL_INTERFACE_RETAINED_DECLARATION');assert.equal(sha(raw(p,found[0]).code),d.sha256);selected.add(found[0]);}
 }
 const types=new Map(),roots=new Map(),functions=new Map();
 for(const ast of p.documents.values())for(const n of ast.statements){
  if(n.kind===K.StructDeclaration&&(owners.has(logicalSourcePath(ast.fileName))||selected.has(n))){const rows=types.get(n.name.name)??[];rows.push(n);types.set(n.name.name,rows);}
  if(n.kind===K.VariableDeclaration){
   let type=resolveBoundTypeAlias(p,n.type);while(type.status==='RESOLVED'&&type.node.kind===K.ArrayType)type=resolveBoundTypeAlias(p,type.node.elementType);
   const sourceNominal=owners.has(logicalSourcePath(ast.fileName))&&!n.modifiers?.length&&type.status==='RESOLVED'&&type.nominal;
   if(selected.has(n)||sourceNominal){assert(!roots.has(n.name.name),'NOMINAL_INTERFACE_ROOT_AMBIGUOUS');roots.set(n.name.name,n);}
  }
 }
 for(const [name,group]of indexSourceFunctionDeclarations(p.documents))if(group.status==='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES'&&owners.has(logicalSourcePath(group.body.fileName))){
  const fn=group.body.node;if(fn.modifiers?.length||!fn.parameters.some(a=>resolveBoundStructref(p,a.type).status==='RESOLVED_STRUCTREF'))continue;
  functions.set(name,fn);
 }
 return {program:p,opened,types,roots,functions,library:input.libraryId??'Map',records:new Map(),active:true};
 }catch(error){opened.dispose();throw error;}
}
export async function withRetainedNominalInterfaces(input,policy,files,operation){
 if(!policy.preserveAuthoredCode||!files.length)return operation();
 const context=openOriginal(input,files);
 return originalScope.run(context,async()=>{try{return await operation();}finally{context.active=false;context.opened.dispose();}});
}
export function withNominalGenerationProgram(program,primaryNames,operation){
 const context={program,primary:new Set(primaryNames),proxies:new Map(),active:true};
 return generationScope.run(context,()=>{try{const result=operation();if(result?.then)return Promise.resolve(result).finally(()=>{context.active=false;});context.active=false;return result;}catch(error){context.active=false;throw error;}});
}
function sourceType(context,node){
 const rows=context.types.get(node.name?.name)??[];assert.equal(rows.length,1,'NOMINAL_INTERFACE_TYPE_AMBIGUOUS');
 const original=rows[0],a=raw(context.program,original),b=raw(generationScope.getStore().program,node);
 assert.equal(sha(a.code),sha(b.code),'NOMINAL_INTERFACE_TYPE_BODY_CHANGED');
 const primary=generationScope.getStore().primary.has(b.loc.sourceFile);
 if(!primary)assert.equal(a.loc.contentSha256,b.loc.contentSha256,'NOMINAL_INTERFACE_TYPE_SOURCE_CHANGED');
 return original;
}
function proxyFor(node,ctx,allocate){
 const o=originalScope.getStore(),g=generationScope.getStore();sourceType(o,node);
 let proxy=g.proxies.get(node);if(proxy)return proxy;
 const at=raw(g.program,node),ast=g.program.documents.get(at.loc.sourceFile),source={fileName:at.loc.sourceFile,text:ast.text,sha256:at.loc.contentSha256};
 const occupied=new Set(Object.values(ctx.elements).map(key));
 proxy=createSourceProvidedNominalProxy({program:g.program,source,symbol:node.name.name,library:ctx.libId,allocate,existingIdentities:occupied});
 assert(!ctx.elements[proxy.structure.id],'NOMINAL_INTERFACE_PROXY_ID_COLLISION');ctx.elements[proxy.structure.id]=proxy.structure;
 g.proxies.set(node,proxy);ctx.structureByGalaxyTypeName?.set(node.name.name,ref(proxy.structure));return proxy;
}
function currentFunction(call,ctx,allocate){
 const o=originalScope.getStore(),g=generationScope.getStore();if(!o?.active||!g?.active||ctx.libId!==o.library)return;
 const callee=un(call.expression);if(callee?.kind!==K.Identifier)return;
 const fn=g.program.declarationAt(callee),original=o.functions.get(callee.name);if(!original||fn?.kind!==K.FunctionDeclaration)return;
 const groups=indexSourceFunctionDeclarations(g.program.documents),group=groups.get(callee.name);if(group?.status!=='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES')return;
 const body=group.body.node,a=raw(o.program,original),b=raw(g.program,body);assert.equal(a.loc.contentSha256,b.loc.contentSha256,'NOMINAL_INTERFACE_FUNCTION_SOURCE_CHANGED');assert.equal(sha(a.code),sha(b.code),'NOMINAL_INTERFACE_FUNCTION_BODY_CHANGED');
 const existing=ctx.funcNameToFuncDef.get(callee.name);if(existing&&o.records.has(key(existing)))return existing;
 const returned=typeAt(g.program,body.type)?.scalar;assert(returned,'NOMINAL_INTERFACE_SCALAR_FUNCTION_RESULT');
 const parameters=body.parameters.map((param,i)=>{
  assert(!param.modifiers?.length&&!param.initializer&&!param.isReference,'NOMINAL_INTERFACE_PLAIN_SOURCE_FORMAL');
  const r=resolveBoundStructref(g.program,param.type),scalar=typeAt(g.program,param.type)?.scalar;
  const paramType=r.status==='RESOLVED_STRUCTREF'?proxyFor(r.nominal,ctx,allocate).type:{type:scalar};assert(paramType.type&&paramType.type!=='void','NOMINAL_INTERFACE_FORMAL_ABI');
  return {library:ctx.libId,type:'ParamDef',id:allocate('ParamDef',callee.name+':'+i),name:'argument'+i,identifier:'argument'+i,paramType,...(r.status==='RESOLVED_STRUCTREF'?{isReference:true}:{})};
 });
 const role=returned==='void'?'Action':'Call',definition={library:ctx.libId,type:'FunctionDef',id:allocate('FunctionDef',callee.name),name:callee.name,identifier:callee.name,flags:[role,'Operator','NoScriptPrefix'],
  returnType:{type:returned},parameters:parameters.map(ref),...(role==='Action'?{isFuncAction:true}:{isFuncCall:true}),scriptCode:callee.name+'('+parameters.map(p=>'#PARAM('+p.name+')').join(', ')+')'+(returned==='void'?';':'')};
 const description={definition,parameters};
 for(const e of [description.definition,...description.parameters]){assert(!ctx.elements[e.id],'NOMINAL_INTERFACE_FUNCTION_ID_COLLISION');ctx.elements[e.id]=e;}
 ctx.funcNameToFuncDef.set(callee.name,description.definition);
 const proof=qualify(o,description.definition,ctx.elements,ctx.libId);assert(proof,'NOMINAL_INTERFACE_FUNCTION_NOT_QUALIFIED');o.records.set(key(description.definition),proof);return description.definition;
}
/** Prime the actual source interfaces before local variables are assigned GUI
 * types. A source structref call does not authorize translating its library. */
export function primeRetainedNominalInterfaces({program,primaryNames,libraryId,elements,structuresByName,functionDefsByName,allocate}){
 const o=originalScope.getStore(),g=generationScope.getStore();if(!o?.active||!g?.active)return;
 assert.equal(program,g.program,'NOMINAL_INTERFACE_SHARED_SEMANTIC_PROGRAM');
 const ctx={libId:libraryId,elements,structureByGalaxyTypeName:structuresByName,funcNameToFuncDef:functionDefsByName};
 for(const name of primaryNames??g.primary){const ast=program.documents.get(name);if(ast)walk(ast,n=>{if(n.kind===K.CallExpression)currentFunction(n,ctx,allocate);});}
}
function typeAt(program,type){const r=resolveBoundTypeAlias(program,type);if(r.status!=='RESOLVED')return;
 return {node:r.node,nominal:r.nominal,scalar:!r.nominal&&r.node.kind>=K.BoolKeyword&&r.node.kind<=K.WavetargetKeyword?tokenToString(r.node.kind):undefined};}
function accessPath(context,name,steps){
 const root=context.roots.get(name);if(!root)return;
 let type=typeAt(context.program,root.type);const fields=[];
 for(const step of steps){if(!type)return;
  if(step.kind==='index'){if(type.node.kind!==K.ArrayType)return;type=typeAt(context.program,type.node.elementType);}
  else{if(!type.nominal)return;const matches=type.nominal.members.filter(m=>m.name.name===step.name);if(matches.length!==1)return;fields.push(matches[0]);type=typeAt(context.program,matches[0].type);}
 }
 if(!type||type.node.kind===K.ArrayType||!type.nominal&&!type.scalar||type.scalar==='void')return;
 return {root,fields,type};
}
function expressionPath(expr,ctx){
 const o=originalScope.getStore(),g=generationScope.getStore();if(!o?.active||!g?.active||ctx.libId!==o.library)return;
 let base=un(expr);const path=[];while([K.PropertyAccessExpression,K.ElementAccessExpression].includes(base?.kind)){path.unshift(base);base=un(base.expression);}
 if(base?.kind!==K.Identifier||g.program.getBinding(base).status!=='BOUND')return;
 const declaration=g.program.declarationAt(base),original=o.roots.get(base.name);if(!original||declaration?.kind!==K.VariableDeclaration||declaration.parent?.kind!==K.SourceFile)return;
 const a=raw(o.program,original),b=raw(g.program,declaration);assert.equal(sha(a.code),sha(b.code),'NOMINAL_INTERFACE_ROOT_DECLARATION_CHANGED');
 if(!g.primary.has(b.loc.sourceFile)){assert.equal(logicalSourcePath(a.loc.sourceFile),logicalSourcePath(b.loc.sourceFile),'NOMINAL_INTERFACE_STORAGE_SOURCE_OWNER');assert.equal(a.loc.contentSha256,b.loc.contentSha256,'NOMINAL_INTERFACE_STORAGE_SOURCE_REVISION');}
 const steps=[],indices=[];for(const n of path){if(n.kind===K.PropertyAccessExpression)steps.push({kind:'member',name:n.name.name});
  else{if(g.program.getBinding(n.argumentExpression).carrier!=='int')return;steps.push({kind:'index',index:indices.length});indices.push(n.argumentExpression);}}
 const resolved=accessPath(o,base.name,steps);if(!resolved)return;
 // Recheck the actual semantic declarations, not only path spelling.
 let field=0;for(const n of path)if(n.kind===K.PropertyAccessExpression){const bound=g.program.declarationAt(n),expected=resolved.fields[field++];if(!bound||bound.kind!==K.PropertyDeclaration)return;
  assert.equal(sha(raw(g.program,bound).code),sha(raw(o.program,expected).code),'NOMINAL_INTERFACE_MEMBER_DECLARATION_CHANGED');}
 return {...resolved,steps,indices};
}
export function lowerRetainedNominalRead(expr,ctx,paramDefRef,helpers){
 const path=expressionPath(expr,ctx);if(!path)return;
 const o=originalScope.getStore(),g=generationScope.getStore(),allocate=(type,key)=>helpers.idFromKey(ctx.libId+'|retained-nominal|'+type+'|'+key);
 let returned={type:path.type.scalar};
 if(path.type.nominal){const current=[...g.program.documents.values()].flatMap(a=>a.statements).filter(n=>n.kind===K.StructDeclaration&&n.name?.name===path.type.nominal.name.name);assert.equal(current.length,1,'NOMINAL_INTERFACE_CURRENT_RETURN_TYPE');returned=proxyFor(current[0],ctx,allocate).type;}
 const names=path.indices.map((_,i)=>'index'+i);let code=path.root.name.name;
 for(const step of path.steps)code+=step.kind==='member'?'.'+step.name:'[#PARAM('+names[step.index]+')]';
 const id=allocate('FunctionDef',code),parameters=names.map(name=>({library:ctx.libId,type:'ParamDef',id:allocate('ParamDef',code+'|'+name),name,identifier:name,paramType:{type:'int'}}));
 const definition={library:ctx.libId,type:'FunctionDef',id,name:code,identifier:'SourceValue_'+id,flags:['Call','Operator','NoScriptPrefix'],isFuncCall:true,returnType:returned,parameters:parameters.map(ref),scriptCode:code};
 for(const e of [...parameters,definition]){if(ctx.elements[e.id])assert.equal(signature(ctx.elements[e.id]),signature(e),'NOMINAL_INTERFACE_STORAGE_ID_COLLISION');else ctx.elements[e.id]=e;}
 const proof=qualify(o,definition,ctx.elements,ctx.libId);assert(proof,'NOMINAL_INTERFACE_STORAGE_NOT_QUALIFIED');o.records.set(key(definition),proof);
 const args=path.indices.map((index,i)=>helpers.exprToParamRef(index,ctx,ref(parameters[i]),'int'));
 const call=helpers.mkFCRef({functionDef:ref(definition),parameters:args},ctx);
 return helpers.mkParamRef({functionCall:call,...(paramDefRef?{parameterDef:paramDefRef}:{})},ctx);
}

const element=(elements,r,library)=>{assert((r?.library??library)===library&&r.type,'NOMINAL_INTERFACE_EXACT_REFERENCE_OWNER');const rows=[...new Set([elements[r.id],elements[r.type+':'+r.id]].filter(Boolean))];assert.equal(rows.length,1,'NOMINAL_INTERFACE_REFERENCE_CARDINALITY');const e=rows[0];assert((e.library??library)===library&&e.type===r.type&&e.id===r.id,'NOMINAL_INTERFACE_TYPED_REFERENCE');return e;};
function guiType(o,type,elements,library){
 if(type?.type!=='struct')return type?.type;
 const e=element(elements,type.typeElement,library);assert(e.type==='Structure'&&e.disabled===true&&!e.variables?.length,'NOMINAL_INTERFACE_REFERENCE_ONLY_TYPE');
 const symbol=(library==='Map'?'gs_':'lib'+library+'_gs_')+e.identifier,rows=o.types.get(symbol)??[];assert.equal(rows.length,1,'NOMINAL_INTERFACE_SOURCE_TYPE_OWNER');return symbol;
}
function parsePath(code){
 const match=code?.match(/^([A-Za-z_]\w*)((?:\.[A-Za-z_]\w*|\[#PARAM\([A-Za-z_]\w*\)\])*)$/u);if(!match)return;
 const steps=[],names=[];for(const part of match[2].matchAll(/\.([A-Za-z_]\w*)|\[#PARAM\(([A-Za-z_]\w*)\)\]/gu)){
  if(part[1])steps.push({kind:'member',name:part[1]});else{steps.push({kind:'index',index:names.length});names.push(part[2]);}}
 return {name:match[1],steps,names};
}
function qualify(o,e,elements,library){
 if(e.type!=='FunctionDef'||typeof e.scriptCode!=='string')return;
 const call=e.scriptCode.match(/^([A-Za-z_]\w*)\((.*)\)(;?)$/u),path=parsePath(e.scriptCode),fn=call&&o.functions.get(call[1]);
 if(!fn&&(!path||!o.roots.has(path.name)))return;
 const flags=new Set(e.flags??[]),role=e.returnType?.type==='void'?'Action':'Call';
 assert(flags.has('Operator')&&flags.has(role)&&flags.has('NoScriptPrefix')&&[...flags].every(f=>['Call','Action','Operator','NoScriptPrefix'].includes(f)),'NOMINAL_INTERFACE_INLINE_ROLE');
 assert(!e.disabled&&!e.actions?.length&&!e.localVariables?.length&&!e.subFunctionTypes?.length&&e.expressionCode===undefined,'NOMINAL_INTERFACE_NO_RUNTIME_BODY');
 const parameters=(e.parameters??[]).map(r=>element(elements,r,library));assert(parameters.every(p=>p.type==='ParamDef'),'NOMINAL_INTERFACE_FORMAL_KIND');
 let expectedReturn;
 if(fn){
  assert.equal(parameters.length,fn.parameters.length,'NOMINAL_INTERFACE_SOURCE_ARITY');
  for(const [i,original]of fn.parameters.entries()){
   const reference=resolveBoundStructref(o.program,original.type),shape=typeAt(o.program,original.type),p=parameters[i];
   const expected=reference.status==='RESOLVED_STRUCTREF'?reference.nominal.name.name:shape?.scalar;
   assert(expected,'NOMINAL_INTERFACE_SUPPORTED_ABI');assert.equal(p.isReference===true,reference.status==='RESOLVED_STRUCTREF','NOMINAL_INTERFACE_REFERENCE_FORMAL');
   assert.equal(guiType(o,p.paramType,elements,library),expected,'NOMINAL_INTERFACE_FORMAL_TYPE');
  }
  expectedReturn=typeAt(o.program,fn.type)?.scalar;assert(expectedReturn,'NOMINAL_INTERFACE_RETURN_ABI');
  assert.equal(e.scriptCode,fn.name.name+'('+parameters.map(p=>'#PARAM('+p.name+')').join(', ')+')'+(expectedReturn==='void'?';':''),'NOMINAL_INTERFACE_PURE_SOURCE_CALL');
 }else{
  const access=accessPath(o,path.name,path.steps);assert(access,'NOMINAL_INTERFACE_BOUND_STORAGE_PATH');
  assert.equal(parameters.length,path.names.length,'NOMINAL_INTERFACE_INDEX_ARITY');assert.equal(new Set(path.names).size,path.names.length,'NOMINAL_INTERFACE_INDEX_SINGLE_EVALUATION');
  parameters.forEach((p,i)=>{assert.equal(p.name,path.names[i]);assert.equal(p.isReference===true,false);assert.equal(guiType(o,p.paramType,elements,library),'int');});
  expectedReturn=access.type.nominal?.name.name??access.type.scalar;
 }
 assert.equal(guiType(o,e.returnType,elements,library),expectedReturn,'NOMINAL_INTERFACE_RESULT_ABI');
 return {definition:signature(e),parameters:parameters.map(p=>JSON.stringify(p)),elements,library};
}
export function registerRetainedNominalInterfaces(elements,library){
 const o=originalScope.getStore();if(!o?.active||o.library!==library)return;
 for(const e of new Set(Object.values(elements))){try{const proof=qualify(o,e,elements,library);if(proof)o.records.set(key(e),proof);}catch{ /* Unqualified elements remain subject to every existing rejecting gate. */ }}
}
export function isRetainedNominalInterfaceElement(e){
 const o=originalScope.getStore(),r=o?.active&&o.records.get(key(e));if(!r||r.definition!==signature(e))return false;
 try{const fresh=qualify(o,e,r.elements,r.library);return fresh&&JSON.stringify(fresh.parameters)===JSON.stringify(r.parameters);}catch{return false;}
}
export function hasRetainedNominalInterfaces(library){const o=originalScope.getStore();return !!o?.active&&o.library===library&&o.records.size>0;}

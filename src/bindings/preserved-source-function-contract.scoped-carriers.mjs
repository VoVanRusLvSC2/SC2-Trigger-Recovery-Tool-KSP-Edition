import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGalaxyDocument} from "../model/galaxy-document.collections.mjs";
import {logicalSourcePath} from "../model/source-ownership.mjs";
import {removeAlreadyLoadedOwnedIncludes} from "../passes/owned-include-closure.mjs";
import {SyntaxKind as K,Printer} from "../sdk/array-values/modules/galaxy/language-core/index.js";
const sha=text=>createHash('sha256').update(text).digest('hex');
const printer=new Printer();

// No code is emitted. Closed archive ownership and ABI are prerequisites for
// a future source-preserving GUI binding, never permission for a fallback.
export function indexPreservedSourceFunctions(input) {
 const closure=removeAlreadyLoadedOwnedIncludes({...input,includeRoot:false});
 assert(closure.proof.completeReachableClosure===true,'PRESERVED_FUNCTION_INCLUDE_CLOSURE_REQUIRED');
 const reachable=new Map(closure.proof.resolvedFiles.map(f=>[logicalSourcePath(f.path),f.sha256]));
 const definitions=new Map(),outsideBodies=new Set();
 // A source-owned body is not unique if the root or an active dependency
 // defines that symbol too. Forward declarations alone are not bodies.
 for(const file of [input.root,...(input.externalSources??[])]){
  const owner=logicalSourcePath(file.originalPath??file.fileName);
  if(!reachable.has(owner))continue;
  const document=createGalaxyDocument(file);
  try{for(const node of document.ast.statements)
   if(node.kind===K.FunctionDeclaration&&node.body)outsideBodies.add(node.name.name);
  }finally{document.dispose();}
 }
 for(const file of input.ownedSources??[]){
  const owner=logicalSourcePath(file.originalPath??file.fileName),digest=sha(file.text);
  if(!reachable.has(owner))continue;
  assert.equal(reachable.get(owner),digest,'PRESERVED_FUNCTION_OWNER_SHA');
  if(file.sha256!==undefined)assert.equal(file.sha256,digest,'PRESERVED_FUNCTION_INPUT_SHA');
  const document=createGalaxyDocument(file);
  try{for(const node of document.ast.statements){
   if(node.kind!==K.FunctionDeclaration||!node.body||node.modifiers?.some(m=>m.kind===K.StaticKeyword))continue;
   const row={name:node.name.name,owner,sourceSha256:digest,declarationSha256:sha(file.text.slice(node.pos,node.end)),
    returnType:printer.printNode(node.type),parameters:node.parameters.map(p=>({name:p.name.name,type:printer.printNode(p.type),isReference:!!p.isReference}))};
   row.simpleAbi=/^[A-Za-z_]\w*$/u.test(row.returnType)&&row.parameters.every(p=>/^[A-Za-z_]\w*$/u.test(p.type)&&!p.isReference);
   const list=definitions.get(row.name)??[];list.push(Object.freeze(row));definitions.set(row.name,list);
  }}finally{document.dispose();}
 }
 return Object.freeze({closure:closure.proof,resolve(name){
  const matches=definitions.get(name)??[];
  if(matches.length&&outsideBodies.has(name))return {status:'AMBIGUOUS',owners:matches.map(m=>m.owner),activeOutsideBody:true};
  return matches.length===1?{status:matches[0].simpleAbi?'UNIQUE_SIMPLE_ABI':'UNSUPPORTED_ABI',definition:matches[0]}:
   {status:matches.length?'AMBIGUOUS':'MISSING',owners:matches.map(m=>m.owner)};
 }});
}

export function checkPreservedSourceFunctionInterface(index,definition,elements,library,carrier=type=>type?.type){
 assert.equal(definition.type,'FunctionDef');assert.equal(definition.library,library);
 assert(!definition.flags?.some(f=>['Native','Event','CreateThread','SubFunctions'].includes(f)),'PRESERVED_INTERFACE_ROLE');
 assert(!definition.actions?.length&&!definition.localVariables?.length,'PRESERVED_INTERFACE_BODY');
 assert.equal(definition.expressionCode,undefined,'PRESERVED_INTERFACE_EXPRESSION_CODE');
 const params=(definition.parameters??[]).map(ref=>{
  assert(ref.type==='ParamDef'&&(ref.library??library)===library,'PRESERVED_FORMAL_REFERENCE');
  const found=[...new Set([elements[ref.id],elements['ParamDef:'+ref.id]].filter(Boolean))];
  assert.equal(found.length,1,'PRESERVED_FORMAL_UNIQUE');const p=found[0];
  assert(p.type==='ParamDef'&&p.library===library&&p.id===ref.id,'PRESERVED_FORMAL_TYPED_OWNER');
  assert(/^[A-Za-z_]\w*$/u.test(p.name),'PRESERVED_FORMAL_NAME');return p;
 });
 assert.equal(new Set(params.map(p=>p.name)).size,params.length,'PRESERVED_FORMAL_COLLISION');
 const match=definition.scriptCode?.match(/^\s*([A-Za-z_]\w*)\s*\(([^]*?)\)\s*(;?)\s*$/u);
 assert(match,'PRESERVED_INTERFACE_PURE_CALL');const resolved=index.resolve(match[1]);
 assert.equal(resolved.status,'UNIQUE_SIMPLE_ABI','PRESERVED_INTERFACE_UNIQUE_SOURCE_ABI');
 const source=resolved.definition;
 assert(definition.returnType?.type,'PRESERVED_INTERFACE_RESULT_REQUIRED');
 assert.equal(carrier(definition.returnType,library),source.returnType,'PRESERVED_INTERFACE_RETURN_TYPE');
 assert.equal(params.length,source.parameters.length,'PRESERVED_INTERFACE_ARITY');
 assert.equal(match[2].replace(/\s+/gu,''),params.map(p=>`#PARAM(${p.name})`).join(','),'PRESERVED_INTERFACE_ARGUMENT_ORDER');
 for(let i=0;i<params.length;i++)assert(carrier(params[i].paramType,library)===source.parameters[i].type&&!params[i].isReference,
  'PRESERVED_INTERFACE_FORMAL_ABI');
 assert(source.returnType==='void'||!match[3],'PRESERVED_VALUE_CALL_SEMICOLON');
 return {kind:'CLOSED_PRESERVED_SOURCE_CALL_INTERFACE',...source,
  interface:{library,type:definition.type,id:definition.id},newRuntimeFunction:false,newNative:false,
  guiBindingAuthorized:false,semanticEquivalenceProved:false,accepted:false};
}

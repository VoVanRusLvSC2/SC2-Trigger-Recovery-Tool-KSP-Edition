// Closed-program namespace proof. This does not authorize any code rewrite.
import assert from 'node:assert/strict';
import {SyntaxKind as K,forEachChild} from "../sdk/array-values/modules/galaxy/language-core/index.js";
import {getTypeName,unwrapArrayType} from "../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/g2t-core.js";
import {readCanonicalInt32Literal} from "../types/inclusive-literal-int-comparison.mjs";
import {readStringLiteralValue} from "../types/string-literal-value.mjs";
const un=n=>n?.kind===K.ParenthesizedExpression?un(n.expression):n;
const walk=(n,f,p,owner)=>{if(!n)return;if(n.kind===K.FunctionDeclaration)owner=n;f(n,p,owner);forEachChild(n,c=>walk(c,f,n,owner));};
const writeKinds=new Set(['EqualsToken','PlusEqualsToken','MinusEqualsToken','AsteriskEqualsToken','SlashEqualsToken','PercentEqualsToken','LessThanLessThanEqualsToken','GreaterThanGreaterThanEqualsToken','AmpersandEqualsToken','BarEqualsToken','CaretEqualsToken'].map(k=>K[k]));
const catalogQueries=new Set(['CatalogEntryCount','CatalogEntryGet','CatalogEntryIsDefault','CatalogEntryIsValid','CatalogEntryClass','CatalogEntryParent','CatalogEntryScope','CatalogFieldCount','CatalogFieldGet','CatalogFieldExists','CatalogFieldIsArray','CatalogFieldIsScope','CatalogFieldType','CatalogFieldTypeCategory','CatalogFieldValueCount','CatalogFieldValueGet','CatalogFieldValueGetAsInt','CatalogFieldValueGetFlagsAsInt','CatalogReferenceCount','CatalogReferenceGet','CatalogReferenceGetAsInt','CatalogLinkReplacement']);
const namespaceWrites=new Map([['CatalogFieldValueSet',0],['CatalogFieldValueModify',0],['CatalogLinkReplace',1]]);
const referenceWrites=new Set(['CatalogReferenceSet','CatalogReferenceModify']);
const writerAbi=new Map([
 ['CatalogFieldValueSet',['bool','int','string','string','int','string']],
 ['CatalogFieldValueModify',['bool','int','string','string','int','string','int']],
 ['CatalogLinkReplace',['void','int','int','string','string']],
 ['CatalogReferenceSet',['bool','string','int','string']],
 ['CatalogReferenceModify',['bool','string','int','string','int']],
]);

/** Accept finite readonly literal/const/parameter domains only. Unknown writers,
 * mutable inputs, local shadowing and indirect relay references remain refusals.
 * The exact numeric catalog identity comes from a supplied SDK constant.
 */
export function proveCatalogNamespaceNotWritten(asts,{namespace,constantName}){
 assert(typeof namespace==='string'&&namespace&&typeof constantName==='string'&&constantName,'CATALOG_SCOPE_IDENTITY_REQUIRED');
 const functions=new Map(),globals=new Map(),calls=new Map(),nodes=[];
 for(const ast of asts){
  assert(!ast.parseDiagnostics.length,'CATALOG_SCOPE_SOURCE_SYNTAX');
  for(const d of ast.statements){
   const table=d.kind===K.FunctionDeclaration?functions:d.kind===K.VariableDeclaration?globals:undefined;
   if(table){const rows=table.get(d.name.name)??[];rows.push(d);table.set(d.name.name,rows);}
  }
  walk(ast,(n,p,owner)=>{nodes.push({n,p,owner});if(n.kind===K.CallExpression&&n.expression?.kind===K.Identifier){const sites=calls.get(n.expression.name)??[];sites.push({n,owner});calls.set(n.expression.name,sites);}});
 }
 const scalar=(d,type)=>getTypeName(d.type)===type&&!unwrapArrayType(d.type).sizes.length;
 for(const {n,p} of nodes)if(n.kind===K.Identifier&&(namespaceWrites.has(n.name)||referenceWrites.has(n.name)))assert(p?.name===n&&!!p.type||p?.kind===K.CallExpression&&p.expression===n,'CATALOG_SCOPE_INDIRECT_WRITER');
 const relays=[],localProofs=[];
 function directCallIdentity(site,name){
  assert(!globals.has(name),'CATALOG_SCOPE_CALL_GLOBAL_COLLISION');
  assert(!site.owner?.parameters.some(p=>p.name.name===name),'CATALOG_SCOPE_CALL_PARAMETER_SHADOW');
  if(site.owner?.body)walk(site.owner.body,n=>{assert(n.kind!==K.VariableDeclaration||n.name.name!==name,'CATALOG_SCOPE_CALL_LOCAL_SHADOW');});
 }
 function readonly(owner,name){
  walk(owner.body,(n)=>{
   const target=n.kind===K.BinaryExpression&&writeKinds.has(n.operatorToken?.kind)?un(n.left):[K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(n.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(n.operator?.kind??n.operatorToken?.kind)?un(n.operand):undefined;
   assert(target?.kind!==K.Identifier||target.name!==name,'CATALOG_SCOPE_MUTABLE_INPUT:'+owner.name.name+':'+name);
   if(n.kind!==K.CallExpression)return;
   n.arguments.forEach((a,i)=>{
    a=un(a);if(a?.kind!==K.Identifier||a.name!==name)return;
    const callee=un(n.expression),defs=callee?.kind===K.Identifier?functions.get(callee.name):undefined;
    assert(defs?.length&&defs.every(d=>d.parameters.length===n.arguments.length&&d.parameters[i]&&!d.parameters[i].isReference),'CATALOG_SCOPE_REFERENCE_OR_UNKNOWN_CALL');
   });
  });
 }
 function union(groups){const values=new Set(groups.flatMap(v=>[...v]));assert(values.size<=128,'CATALOG_SCOPE_VALUE_BOUND');return values;}
 function domain(expression,owner,type,stack=[]){
  expression=un(expression);assert(expression,'CATALOG_SCOPE_ARGUMENT_MISSING');assert(stack.length<128,'CATALOG_SCOPE_RELAY_DEPTH');
  if(type==='int'){const value=readCanonicalInt32Literal(expression);if(value!==undefined)return new Set([String(value)]);}
  if(type==='string'&&expression.kind===K.StringLiteral){const value=readStringLiteralValue(expression.text)?.value;assert(typeof value==='string'&&/^[\x20-\x7e]*$/u.test(value),'CATALOG_SCOPE_STRING_ENCODING');return new Set([value]);}
  if(type==='string'&&expression.kind===K.BinaryExpression&&expression.operatorToken?.kind===K.PlusToken){
   const left=domain(expression.left,owner,type,stack),right=domain(expression.right,owner,type,stack),values=[];
   for(const a of left)for(const b of right){assert(a.length+b.length<=4096,'CATALOG_SCOPE_STRING_BOUND');values.push(new Set([a+b]));}
   return union(values);
  }
  assert(expression.kind===K.Identifier,'CATALOG_SCOPE_UNKNOWN_ARGUMENT_EXPRESSION');
  const name=expression.name,parameters=owner?.parameters.filter(p=>p.name.name===name)??[],locals=[];
  if(owner?.body)walk(owner.body,n=>{if(n.kind===K.VariableDeclaration&&n.name.name===name)locals.push(n);});
  if(parameters.length||locals.length){
   assert(parameters.length+locals.length===1,'CATALOG_SCOPE_LEXICAL_IDENTITY_AMBIGUOUS');
   const d=parameters[0]??locals[0];assert(scalar(d,type)&&!d.isReference,'CATALOG_SCOPE_INPUT_TYPE');readonly(owner,name);
   if(locals.length){
    assert(owner.body.statements.includes(d)&&d.initializer&&d.end<=expression.pos,'CATALOG_SCOPE_LOCAL_INITIALIZER_REQUIRED');
    const key=owner.name.name+':local:'+name;assert(!stack.includes(key),'CATALOG_SCOPE_LOCAL_CYCLE');
    localProofs.push({owner:owner.name.name,name});return domain(d.initializer,owner,type,[...stack,key]);
   }
   const defs=functions.get(owner.name.name)??[],bodies=defs.filter(d=>d.body),i=owner.parameters.indexOf(d),key=owner.name.name+':'+i;
   assert(bodies.length===1&&bodies[0]===owner&&!globals.has(owner.name.name),'CATALOG_SCOPE_RELAY_OWNER');
   assert(defs.every(f=>getTypeName(f.type)===getTypeName(owner.type)&&f.parameters.length===owner.parameters.length&&f.parameters.every((p,j)=>getTypeName(p.type)===getTypeName(owner.parameters[j].type)&&unwrapArrayType(p.type).sizes.length===unwrapArrayType(owner.parameters[j].type).sizes.length&&!!p.isReference===!!owner.parameters[j].isReference)),'CATALOG_SCOPE_RELAY_ABI');
   assert(!stack.includes(key),'CATALOG_SCOPE_RECURSIVE_RELAY');
   for(const {n,p} of nodes){
    if(n.kind===K.Identifier&&n.name===owner.name.name)assert(p?.kind===K.FunctionDeclaration&&p.name===n||p?.kind===K.CallExpression&&p.expression===n,'CATALOG_SCOPE_INDIRECT_RELAY');
    if(n.kind===K.StringLiteral)assert(readStringLiteralValue(n.text)?.value?.toLowerCase()!==owner.name.name.toLowerCase(),'CATALOG_SCOPE_REFLECTED_RELAY');
   }
   const sites=calls.get(owner.name.name)??[];relays.push({owner:owner.name.name,parameter:i,callSites:sites.length});
   return union(sites.map(site=>{directCallIdentity(site,owner.name.name);assert(site.n.arguments.length===owner.parameters.length,'CATALOG_SCOPE_CALL_ABI');return domain(site.n.arguments[i],site.owner,type,[...stack,key]);}));
  }
  const definitions=globals.get(name)??[];assert(definitions.length&&definitions.every(d=>scalar(d,type)&&d.modifiers?.some(m=>m.kind===K.ConstKeyword)&&d.initializer),'CATALOG_SCOPE_UNKNOWN_OR_MUTABLE_GLOBAL');
  for(const {n} of nodes)if(n.kind===K.BinaryExpression&&writeKinds.has(n.operatorToken?.kind))assert(un(n.left)?.name!==name,'CATALOG_SCOPE_CONSTANT_WRITTEN');
  const key='global:'+name;assert(!stack.includes(key),'CATALOG_SCOPE_CONSTANT_CYCLE');
  return union(definitions.map(d=>domain(d.initializer,undefined,type,[...stack,key])));
 }
 const target=domain({kind:K.Identifier,name:constantName},undefined,'int');assert(target.size===1,'CATALOG_SCOPE_NUMERIC_IDENTITY_AMBIGUOUS');
 const value=[...target][0],writers=[];
 for(const [name,sites] of calls){
  if(!name.startsWith('Catalog')||catalogQueries.has(name))continue;
  assert(namespaceWrites.has(name)||referenceWrites.has(name),'CATALOG_API_EFFECT_UNCLASSIFIED:'+name);
  for(const site of sites){
   directCallIdentity(site,name);
   const defs=functions.get(name)??[],abi=writerAbi.get(name);
   assert(defs.length&&defs.every(d=>!d.body&&d.modifiers?.some(m=>m.kind===K.NativeKeyword)&&getTypeName(d.type)===abi[0]&&d.parameters.length===abi.length-1&&d.parameters.every((p,i)=>scalar(p,abi[i+1])&&!p.isReference)),'CATALOG_SCOPE_NATIVE_ABI_REQUIRED:'+name);
   if(namespaceWrites.has(name)){
    const index=namespaceWrites.get(name),values=domain(site.n.arguments[index],site.owner,'int');
    assert(!values.has(value),'CATALOG_NAMESPACE_MAY_BE_WRITTEN:'+namespace);
    writers.push({name,owner:site.owner?.name.name,namespaces:[...values]});
   }else{
    const values=domain(site.n.arguments[0],site.owner,'string');
    for(const reference of values){const parts=reference.split(','),catalog=parts[0].trim();assert(parts.length>=3&&/^[A-Za-z][A-Za-z0-9]*$/u.test(catalog),'CATALOG_SCOPE_REFERENCE_FORMAT_UNPROVED');assert(catalog.toLowerCase()!==namespace.toLowerCase(),'CATALOG_REFERENCE_MAY_WRITE_NAMESPACE:'+namespace);}
    writers.push({name,owner:site.owner?.name.name,references:[...values]});
   }
  }
 }
 return {kind:'CLOSED_LITERAL_CATALOG_MUTATION_NAMESPACE_EXCLUSION',namespace,constantName,value,writers,relays,localProofs,
  allUnknownWriterInputsRefused:true,permissionToRewriteCode:false,wholeMapAccepted:false};
}

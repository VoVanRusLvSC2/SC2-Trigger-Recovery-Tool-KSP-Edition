import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SyntaxKind as K,tokenToString} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {resolveBoundStructref,resolveBoundTypeAlias} from '../types/bound-type-alias.mjs';
import {indexSourceFunctionDeclarations} from '../model/source-function-declarations.mjs';

const sha=s=>createHash('sha256').update(s).digest('hex'),identifier=s=>typeof s==='string'&&/^[A-Za-z_]\w*$/u.test(s);
const scalar=n=>n?.kind>=K.BoolKeyword&&n.kind<=K.WavetargetKeyword?tokenToString(n.kind):undefined;
const proxies=new WeakMap(),snapshot=e=>JSON.stringify(e);
const ref=e=>({library:e.library,type:e.type,id:e.id});
function document(program,source){
 assert(typeof program?.verifiedInputIdentity==='function','VERIFIED_SOURCE_TYPE_PROGRAM_REQUIRED');
 assert(source?.fileName&&typeof source.text==='string'&&source.sha256===sha(source.text),'SOURCE_TYPE_INPUT_SHA');
 const input=program.verifiedInputIdentity(source.fileName),ast=program.documents.get(source.fileName);
 assert(input?.owned===true&&input.contentSha256===source.sha256&&ast?.text===source.text,'SOURCE_TYPE_OWNED_REVISION_REQUIRED');
 assert.equal(ast.parseDiagnostics.length,0,'SOURCE_TYPE_SYNTAX');program.attachOriginal(ast);return ast;
}
function identity(program,node){
 const row=program.location(node);assert(row?.contentSha256,'SOURCE_TYPE_DECLARATION_IDENTITY');
 const input=program.verifiedInputIdentity(row.sourceFile);assert(input?.owned===true&&input.contentSha256===row.contentSha256,'SOURCE_TYPE_DECLARATION_OWNER');
 return {...row,declarationSha256:sha(program.documents.get(row.sourceFile).text.slice(node.pos,node.end))};
}
function ids(library,allocate,existingIdentities=new Set()){
 assert(identifier(library)&&typeof allocate==='function','SOURCE_TYPE_GUI_OWNER');const used=new Set();
 return(type,key)=>{const id=allocate(type,key),k=JSON.stringify([library,type,id]);
  assert(typeof id==='string'&&/^[0-9A-Fa-f]{8}$/u.test(id)&&!used.has(k)&&!existingIdentities.has(k),'SOURCE_TYPE_GUI_ID_COLLISION');used.add(k);return id;};
}
const proof=()=>({newNativeDescriptions:0,newCustomScriptSections:0,newRuntimeFunctions:0,
 candidateConstructionOnly:true,bindingAuthorized:false,archiveRetentionProved:false,wholeProgramOracleStillRequired:true,wholeMapAccepted:false});

/** A reference-only GUI type, with no emitted type declaration or invented
 * members. Its exact nominal owner stays in the unchanged source include.
 * This is construction metadata, never authority to bypass the GUI/Native gate. */
export function createSourceProvidedNominalProxy({program,source,symbol,library,allocate,existingIdentities}){
 const ast=document(program,source);assert(identifier(symbol),'SOURCE_TYPE_SYMBOL');
 const matches=[...program.documents.values()].flatMap(a=>a.statements.filter(n=>n.name?.name===symbol));
 assert(matches.length===1&&matches[0].kind===K.StructDeclaration&&ast.statements.includes(matches[0]),'SOURCE_TYPE_UNIQUE_NOMINAL');
 const node=matches[0],owner=identity(program,node),prefix=library==='Map'?'gs_':'lib'+library+'_gs_';
 assert(symbol.startsWith(prefix)&&identifier(symbol.slice(prefix.length)),'SOURCE_TYPE_EDITOR_SPELLING_NOT_REPRESENTABLE');
 const name=symbol.slice(prefix.length),id=ids(library,allocate,existingIdentities)('Structure',symbol);
 const structure={library,type:'Structure',id,name,identifier:name,disabled:true,variables:[]};
 const type={type:'struct',typeElement:ref(structure)};
 proxies.set(structure,{program,node,owner,type,snapshot:snapshot(structure)});
 return {structure,type,proof:{kind:'SOURCE_PROVIDED_REFERENCE_ONLY_NOMINAL_GUI_PROXY',symbol,...owner,
  gui:ref(structure),noRuntimeDeclaration:true,memberExpansionAuthorized:false,...proof()}};
}
function nominal(program,node,nominalProxies){
 const matches=nominalProxies.filter(({structure})=>{
  const record=proxies.get(structure);return record?.program===program&&record.node===node;
 });
 assert.equal(matches.length,1,'SOURCE_TYPE_EXACT_GUI_PROXY_REQUIRED');
 const {structure}=matches[0],record=proxies.get(structure);
 assert.equal(snapshot(structure),record.snapshot,'SOURCE_TYPE_PROXY_MUTATED');
 identity(program,node);return {type:{type:'struct',typeElement:ref(structure)},owner:record.owner,gui:ref(structure)};
}

/** Pure invocation template: even structref parameters add no runtime prototype.
 * Each nominal argument resolves through the verified binder to its own proxy. */
export function createSourceProvidedTypedFunctionDescription({program,source,symbol,library,allocate,existingIdentities,nominalProxies=[]}){
 const ast=document(program,source);assert(identifier(symbol),'SOURCE_CALL_SYMBOL');
 const group=indexSourceFunctionDeclarations(program.documents).get(symbol);
 assert.equal(group?.status,'UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES','SOURCE_CALL_UNIQUE_ABI');
 const fn=group.body.node;assert(ast.statements.includes(fn)&&!fn.modifiers?.length,'SOURCE_CALL_ORIGINAL_BODY_REQUIRED');
 const returned=scalar(fn.type);assert(returned,'SOURCE_CALL_SCALAR_RETURN_REQUIRED');
 const abi=fn.parameters.map(p=>{
  assert(!p.modifiers?.length&&!p.initializer&&!p.isReference,'SOURCE_CALL_EXPLICIT_PARAMETER');
  const primitive=scalar(p.type);if(primitive){assert.notEqual(primitive,'void','SOURCE_CALL_VOID_PARAMETER');return {type:{type:primitive},reference:false};}
  const bound=resolveBoundStructref(program,p.type);assert.equal(bound.status,'RESOLVED_STRUCTREF','SOURCE_CALL_STRUCTREF_OR_SCALAR_REQUIRED');
  return {...nominal(program,bound.nominal,nominalProxies),reference:true,aliases:bound.aliases};
 });
 const id=ids(library,allocate,existingIdentities),functionId=id('FunctionDef',symbol);
 const parameters=abi.map((p,i)=>({library,type:'ParamDef',id:id('ParamDef',symbol+':'+i),name:'argument'+i,identifier:'argument'+i,
  paramType:p.type,...(p.reference?{isReference:true}:{})}));
 const role=returned==='void'?'Action':'Call',scriptCode=symbol+'('+parameters.map(p=>'#PARAM('+p.name+')').join(', ')+')'+(returned==='void'?';':'');
 const definition={library,type:'FunctionDef',id:functionId,name:symbol,identifier:symbol,flags:[role,'Operator','NoScriptPrefix'],
  returnType:{type:returned},parameters:parameters.map(ref),...(role==='Action'?{isFuncAction:true}:{isFuncCall:true}),scriptCode};
 return {definition,parameters,proof:{kind:'SOURCE_PROVIDED_TYPED_INLINE_FUNCTION_GUI_DESCRIPTION',symbol,...identity(program,fn),
  abi:{returnType:returned,parameters:abi},gui:ref(definition),exactInvocationTemplate:scriptCode,noRuntimeBodyInGui:true,noRuntimePrototype:true,...proof()}};
}

/** Whole source storage is exposed only as an opaque nominal reference value.
 * No renamed GUI Variable, accessor body, member expansion or initializer is made. */
export function createSourceProvidedNominalStorageDescription({program,source,symbol,library,allocate,existingIdentities,nominalProxies=[]}){
 const ast=document(program,source);assert(identifier(symbol),'SOURCE_STORAGE_SYMBOL');
 const matches=[...program.documents.values()].flatMap(a=>a.statements.filter(n=>n.name?.name===symbol));
 assert(matches.length===1&&matches[0].kind===K.VariableDeclaration&&ast.statements.includes(matches[0]),'SOURCE_STORAGE_UNIQUE_GLOBAL');
 const node=matches[0];assert(!node.modifiers?.length,'SOURCE_STORAGE_MUTABLE_GLOBAL_REQUIRED');
 const bound=resolveBoundTypeAlias(program,node.type);assert(bound.status==='RESOLVED'&&bound.nominal?.kind===K.StructDeclaration,'SOURCE_STORAGE_NOMINAL_REQUIRED');
 const target=nominal(program,bound.nominal,nominalProxies),id=ids(library,allocate,existingIdentities)('FunctionDef',symbol);
 const definition={library,type:'FunctionDef',id,name:symbol,identifier:symbol,flags:['Call','Operator','NoScriptPrefix'],
  isFuncCall:true,returnType:target.type,parameters:[],scriptCode:symbol};
 return {definition,proof:{kind:'SOURCE_PROVIDED_NOMINAL_STORAGE_GUI_DESCRIPTION',symbol,...identity(program,node),
  nominal:target,gui:ref(definition),noRuntimeBodyInGui:true,sourceStorageNotRenamed:true,referenceOnly:true,...proof()}};
}

/** Preserve an authored scalar field's spelling for either local or global
 * aggregate operands. The inline target occurs once, preserving lvalue/evaluation
 * identity; this does not grant a generated accessor body or whole-struct copy. */
export function createSourceProvidedNominalMemberDescription({program,nominalProxy,member,library,allocate,existingIdentities,mode='read',operator='='}){
 assert(identifier(member)&&['read','write'].includes(mode),'SOURCE_MEMBER_ROLE');
 const record=proxies.get(nominalProxy?.structure);assert(record?.program===program,'SOURCE_MEMBER_VERIFIED_PROXY_REQUIRED');
 const target=nominal(program,record.node,[nominalProxy]),matches=record.node.members.filter(n=>n.name?.name===member);
 assert(matches.length===1&&matches[0].kind===K.PropertyDeclaration,'SOURCE_MEMBER_UNIQUE_FIELD');
 const field=matches[0],type=scalar(field.type),write=mode==='write';
 assert(type&&type!=='void','SOURCE_MEMBER_SCALAR_REQUIRED');
 assert(!field.modifiers?.length,'SOURCE_MEMBER_UNRESTRICTED_FIELD_REQUIRED');
 assert(!write||['=','+=','-=','*=','/=','%='].includes(operator),'SOURCE_MEMBER_ASSIGNMENT_OPERATOR');
 if(write&&operator!=='=')assert(['int','byte','fixed','string'].includes(type)&&(type!=='string'||operator==='+=')&&(type!=='fixed'||operator!=='%='),'SOURCE_MEMBER_COMPOUND_TYPE');
 const id=ids(library,allocate,existingIdentities),functionId=id('FunctionDef',record.node.name.name+':'+member+':'+mode+':'+operator);
 const parameters=[{library,type:'ParamDef',id:id('ParamDef','target'),name:'argument0',identifier:'argument0',paramType:target.type,isReference:true}];
 if(write)parameters.push({library,type:'ParamDef',id:id('ParamDef','value'),name:'argument1',identifier:'argument1',paramType:{type}});
 const name=record.node.name.name+'.'+member,role=write?'Action':'Call';
 const scriptCode='#PARAM(argument0).'+member+(write?' '+operator+' #PARAM(argument1);':'');
 const definition={library,type:'FunctionDef',id:functionId,name:(write?'Set ':'')+name,identifier:'SourceMember_'+functionId,
  flags:[role,'Operator','NoScriptPrefix'],returnType:{type:write?'void':type},parameters:parameters.map(ref),
  ...(write?{isFuncAction:true}:{isFuncCall:true}),scriptCode};
 return {definition,parameters,proof:{kind:'SOURCE_PROVIDED_TYPED_INLINE_MEMBER_GUI_DESCRIPTION',member,...identity(program,field),
  owner:target,mode,...(write?{operator}:{}),scalarType:type,gui:ref(definition),exactMemberTemplate:scriptCode,
  sourceFieldNotRenamed:true,targetOccurrences:1,noRuntimeBodyInGui:true,noRuntimePrototype:true,...proof()}};
}

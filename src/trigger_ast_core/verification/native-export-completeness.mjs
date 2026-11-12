import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {GalaxyProgramContext} from '../../trigger_ast_implementation_2026-10-07/source-bug-v1670/verified-input-v1689/galaxy-program-context.identity.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';

const sha=text=>createHash('sha256').update(text).digest('hex');
const ignored=new Set(['parent','pos','end','line','char','syntaxTokens','symbol','locals','flowNode','id','__sourceText','comments']);
const walk=(node,fn)=>{fn(node);forEachChild(node,child=>walk(child,fn));};
const assignments=new Set(['EqualsToken','PlusEqualsToken','MinusEqualsToken','AsteriskEqualsToken','SlashEqualsToken','PercentEqualsToken','AmpersandEqualsToken','BarEqualsToken','CaretEqualsToken','LessThanLessThanEqualsToken','GreaterThanGreaterThanEqualsToken'].map(n=>K[n]).filter(n=>n!==undefined));
function difference(a,b,path='$'){
 if(JSON.stringify(a)===JSON.stringify(b))return;
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return {path,expected:a,actual:b};
 for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const found=difference(a[k],b[k],path+'.'+k);if(found)return found;}
}

function view(text,fileName) {
 const ast=parseImmutableGalaxySyntax(text,fileName);
 if(ast.parseDiagnostics.length)return {ast,errors:ast.parseDiagnostics};
 const input={fileName,text,sourceId:fileName,owned:true,contentSha256:sha(text)};
 const program=new GalaxyProgramContext([input],{files:[input],dependencies:[]},sha);
 const bound=program.documents.get(fileName);program.attachOriginal(bound);
 const functions=new Map(),duplicates=[],declarations=new Map();
 for(const node of bound.statements)if([K.VariableDeclaration,K.StructDeclaration,K.TypeAliasDeclaration].includes(node.kind)){
  const name=node.name?.name;if(!name)continue;if(declarations.has(name))duplicates.push(name);else declarations.set(name,node);
 }
 for(const node of bound.statements)if(node.kind===K.FunctionDeclaration&&node.body){
  const name=node.name.name;if(functions.has(name))duplicates.push(name);else functions.set(name,node);
 }
 const prototypes=new Map();
 for(const node of bound.statements)if(node.kind===K.FunctionDeclaration&&!node.body){
  const binding=program.getBinding(node.name);if(binding.status!=='BOUND')continue;
  const list=prototypes.get(binding.symbolId)??[];list.push(node);prototypes.set(binding.symbolId,list);
 }
 function contract(fn) {
  const lexical=new Map();fn.parameters.forEach((p,i)=>lexical.set(p,`parameter:${i}`));
  const functionBinding=program.getBinding(fn.name);
  for(const declaration of prototypes.get(functionBinding.symbolId)??[]){
   if(declaration.parameters.length!==fn.parameters.length)continue;
   if(JSON.stringify(declaration.parameters.map(p=>declarationShape(p.type)))!==JSON.stringify(fn.parameters.map(p=>declarationShape(p.type))))continue;
   declaration.parameters.forEach((p,i)=>lexical.set(p,`parameter:${i}`));
  }
  let local=0;walk(fn.body,n=>{if(n.kind===K.VariableDeclaration)lexical.set(n,`local:${local++}`);});
  const shape=n=>{
   if(n===null||typeof n!=='object')return n;
   if(Array.isArray(n))return n.map(shape);
   if(n.kind===K.Identifier){const declaration=program.declarationAt(n);return {kind:n.kind,name:lexical.get(declaration)??n.name};}
   if(n.kind===K.NumericLiteral)return {kind:n.kind,token:n.text};
   if(n.kind===K.StringLiteral){const value=readStringLiteralValue(n.text);return {kind:n.kind,bytes:value?.bytes?Buffer.from(value.bytes).toString('hex'):null,opaque:!value,token:value?undefined:n.text};}
   return Object.fromEntries(Object.keys(n).filter(k=>!ignored.has(k)&&n[k]!==undefined).sort().map(k=>[k,shape(n[k])]));
  };
  const operations=[];
  walk(fn.body,n=>{
   let role;
   if(n.kind===K.CallExpression)role='call';
   else if(n.kind===K.BinaryExpression&&assignments.has(n.operatorToken.kind))role='write';
   else if([K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(n.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(n.operator?.kind))role='write';
   else if(n.kind===K.ReturnStatement)role='return';
   else if(n.kind===K.VariableDeclaration&&n.initializer)role='initialize';
   if(role)operations.push({role,shape:shape(n)});
  });
  return {body:shape(fn.body),signature:{type:shape(fn.type),parameters:fn.parameters.map(p=>shape(p.type))},operations};
 }
 const declarationShape=n=>{
  if(n===null||typeof n!=='object')return n;if(Array.isArray(n))return n.map(declarationShape);
  return Object.fromEntries(Object.keys(n).filter(k=>!ignored.has(k)&&n[k]!==undefined).sort().map(k=>[k,declarationShape(n[k])]));
 };
 return {ast,program,functions,declarations,declarationShape,duplicates,contract,errors:[]};
}

/** A necessary coverage gate, never a semantic-equivalence oracle. Callers may
 * supply a component or full source, but must retain that scope in acceptance.
 * Only binder-proven lexical names are canonicalized. Globals, fields, APIs,
 * string-addressed storage and literal values are never guessed or rewritten. */
export function verifyNativeExportCompleteness({expectedSource,exportedSource,expectations=[],scope='supplied-source'}) {
 const obligations=expectations.length?expectations.map((e,i)=>({name:e.owner,text:`void ${e.owner}(){\n${e.statements}\n}`,index:i})): [{text:expectedSource}];
 if(typeof exportedSource!=='string'||obligations.some(e=>typeof e.text!=='string'))throw Error('NATIVE_EXPORT_SOURCE_REQUIRED');
 const actual=view(exportedSource,'native-export.galaxy'),issues=[],records=[];let expectedFunctions=0,expectedDeclarations=0;
 try{
  if(actual.errors.length)issues.push({kind:'EXPORTED_SYNTAX_INVALID',count:actual.errors.length});
  for(const name of actual.duplicates??[])issues.push({kind:'DUPLICATE_EXPORTED_FUNCTION',function:name});
  for(const obligation of obligations){
   const expected=view(obligation.text,`expected-${obligation.index??0}.galaxy`);
   try{
    if(expected.errors.length){issues.push({kind:'EXPECTED_SYNTAX_INVALID',count:expected.errors.length});continue;}
    for(const name of expected.duplicates)issues.push({kind:'DUPLICATE_EXPECTED_FUNCTION',function:name});
    if(!obligation.name)for(const [name,node]of expected.declarations){
     expectedDeclarations++;const other=actual.declarations?.get(name);
     if(!other)issues.push({kind:'MISSING_DECLARATION',name});
     else if(JSON.stringify(expected.declarationShape(node))!==JSON.stringify(actual.declarationShape(other)))issues.push({kind:'DECLARATION_CHANGED',name});
    }
    for(const [name,fn]of expected.functions){
     expectedFunctions++;const target=actual.functions?.get(name);
     if(!target){issues.push({kind:'MISSING_FUNCTION_BODY',function:name});continue;}
     const a=expected.contract(fn),b=actual.contract(target),encode=v=>JSON.stringify(v);
     const wanted=new Map(),got=new Map();
     for(const [list,map]of [[a.operations,wanted],[b.operations,got]])for(const op of list){const key=encode(op);map.set(key,(map.get(key)??0)+1);}
     let missing=0,added=0;
     for(const [key,count]of wanted)missing+=Math.max(0,count-(got.get(key)??0));
     for(const [key,count]of got)added+=Math.max(0,count-(wanted.get(key)??0));
     let cursor=0;for(const op of b.operations)if(cursor<a.operations.length&&encode(op)===encode(a.operations[cursor]))cursor++;
     const fragment=!!obligation.name,ordered=fragment?cursor===a.operations.length:encode(a.operations)===encode(b.operations),body=encode(a.body)===encode(b.body),signature=encode(a.signature)===encode(b.signature);
     records.push({function:name,expectedOperations:a.operations.length,actualOperations:b.operations.length,missing,added,ordered,body,signature,firstDifference:body?undefined:difference(a.body,b.body)});
     if(missing||!fragment&&added)issues.push({kind:'OPERATION_COVERAGE_CHANGED',function:name,missing,added});
     else if(!ordered)issues.push({kind:'OPERATION_ORDER_CHANGED',function:name});
     if(!fragment&&!body)issues.push({kind:'BODY_STRUCTURE_UNPROVEN',function:name});
     if(!obligation.name&&!signature)issues.push({kind:'SIGNATURE_CHANGED',function:name});
    }
   }finally{expected.program?.dispose();}
  }
 }finally{actual.program?.dispose();}
 const failed=issues.some(i=>!['BODY_STRUCTURE_UNPROVEN','SIGNATURE_CHANGED'].includes(i.kind));
 return {kind:'NATIVE_EXPORT_AST_COMPLETENESS',scope,expectedSha256:expectedSource===undefined?null:sha(expectedSource),exportedSha256:sha(exportedSource),
  expectationSha256:expectations.map(e=>({owner:e.owner,sha256:sha(e.statements)})),status:failed?'FAIL':issues.length?'REVIEW':expectedFunctions+expectedDeclarations?'PASS':'REVIEW',
  coveragePassed:expectedFunctions+expectedDeclarations>0&&issues.length===0,expectedFunctions,expectedDeclarations,records,issues,
  lexicalNamesBound:true,sourceChanged:false,benchmarkChanged:false,wholeProgramEquivalent:false,wholeMapAccepted:false};
}

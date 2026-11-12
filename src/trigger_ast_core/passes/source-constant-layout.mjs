// The SDK separates a declaration header from the main script. Preserve the
// source's include/constant order instead of asking the benchmark to ignore a
// crossing of opaque library initializers. No GUI nodes or runtime bodies change.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {assertExactAstShape} from '../verification/exact-ast-shape.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const ignored=new Set(['parent','pos','end','line','char']);
const profiles=new WeakMap();
export const sourceConstantLayout=Symbol('source constant declaration layout');
export function createSourceConstantLayout({source,header='',xml}){
 const token=Object.freeze({kind:'SOURCE_CONSTANT_LAYOUT',sourceSha256:sha(source),headerSha256:sha(header),xmlSha256:sha(xml),persistentCache:false});
 profiles.set(token,{source,header});return token;
}
const parse=(text,name)=>{const ast=parseImmutableGalaxySyntax(text,name);assert.equal(ast.parseDiagnostics.length,0,'CONSTANT_LAYOUT_SYNTAX');return ast;};
const initialized=ast=>ast.statements.filter(n=>n.kind===K.VariableDeclaration&&n.initializer);
const literal=n=>{
 while(n?.kind===K.ParenthesizedExpression)n=n.expression;
 return !!n&&([K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(n.kind)||
  n.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(n.operator?.kind)&&n.operand?.kind===K.NumericLiteral);
};
const closed=n=>n.modifiers?.length===1&&n.modifiers[0].kind===K.ConstKeyword&&literal(n.initializer);
function remove(text,nodes){
 let out='',cursor=0;const inverse=[];
 for(const n of nodes.toSorted((a,b)=>a.pos-b.pos)){
  assert(n.pos>=cursor,'CONSTANT_LAYOUT_OVERLAP');out+=text.slice(cursor,n.pos);
  inverse.push({at:out.length,text:text.slice(n.pos,n.end)});cursor=n.end;
 }
 out+=text.slice(cursor);
 return {text:out,restore:value=>{for(const e of inverse.toReversed())value=value.slice(0,e.at)+e.text+value.slice(e.at);return value;}};
}
export function preserveSourceConstantLayout({source,sourceHeader='',header='',script}){
 const proof={kind:'SOURCE_CLOSED_CONSTANT_LAYOUT',sourceSha256:sha(source),headerBeforeSha256:sha(header),scriptBeforeSha256:sha(script),
  records:[],guiChanged:false,runtimeBodiesChanged:false,newRuntimeFunctions:0,wholeProgramEquivalenceProved:false};
 try{
  assert(!sourceHeader.trim(),'CONSTANT_LAYOUT_SEPARATE_SOURCE_HEADER_UNSUPPORTED');
  const original=parse(source,'source-constant-layout'),head=parse(header,'emitted-constant-header'),main=parse(script,'emitted-constant-main');
  const desired=initialized(original),hoisted=initialized(head),inside=initialized(main);
  if(!hoisted.length)return {header,script,proof:{...proof,skipped:'NO_INITIALIZED_HEADER_DECLARATIONS'}};
  assert(desired.length&&[...desired,...hoisted,...inside].every(closed),'CONSTANT_LAYOUT_NONLITERAL_OR_MUTABLE_INITIALIZER');
  const includes=ast=>ast.statements.filter(n=>n.path);
  const from=includes(original),to=includes(main);
  assert.deepEqual(from.map(n=>n.path.value),to.map(n=>n.path.value),'CONSTANT_LAYOUT_INCLUDE_LIST_CHANGED');
  assert(!from.length||desired.every(n=>n.pos>=from.at(-1).end),'CONSTANT_LAYOUT_SOURCE_INTERLEAVED_INCLUDES');
  const actual=[...hoisted,...inside],byName=new Map(actual.map(n=>[n.name.name,n]));
  assert.equal(byName.size,actual.length,'CONSTANT_LAYOUT_DUPLICATE_EMITTED_CONSTANT');
  assert.equal(new Set(desired.map(n=>n.name.name)).size,desired.length,'CONSTANT_LAYOUT_DUPLICATE_SOURCE_CONSTANT');
  assert.equal(actual.length,desired.length,'CONSTANT_LAYOUT_DECLARATION_SET_CHANGED');
  for(const n of desired){assert(byName.has(n.name.name),'CONSTANT_LAYOUT_DECLARATION_MISSING');assertExactAstShape(n,byName.get(n.name.name),{ignoredFields:ignored,label:'CONSTANT_LAYOUT_DECLARATION_CHANGED'});}
  const h=remove(header,hoisted),m=remove(script,inside);
  const at=to.length?to.at(-1).end:0;
  assert(!inside.some(n=>n.pos<at&&n.end>at),'CONSTANT_LAYOUT_INSERT_OVERLAP');
  const offset=at-inside.filter(n=>n.end<=at).reduce((sum,n)=>sum+n.end-n.pos,0);
  const chunks=new Map([...hoisted.map(n=>[n.name.name,header.slice(n.pos,n.end)]),...inside.map(n=>[n.name.name,script.slice(n.pos,n.end)])]);
  const insertion='\n'+desired.map(n=>chunks.get(n.name.name)).join('\n')+'\n';
  const next=m.text.slice(0,offset)+insertion+m.text.slice(offset);
  parse(h.text,'relocated-constant-header');parse(next,'relocated-constant-main');
  assert.equal(h.restore(h.text),header,'CONSTANT_LAYOUT_HEADER_INVERSE');
  assert.equal(m.restore(next.slice(0,offset)+next.slice(offset+insertion.length)),script,'CONSTANT_LAYOUT_MAIN_INVERSE');
  return {header:h.text,script:next,proof:{...proof,records:desired.map(n=>({name:n.name.name,sourcePosition:n.pos,closedLiteralDeclarationAstExact:true})),
   sourceIncludeListExact:true,onlyExistingConstantDeclarationsMoved:true,allOtherBytesExactByInverse:true,
   headerAfterSha256:sha(h.text),scriptAfterSha256:sha(next)}};
 }catch(error){return {header,script,proof:{...proof,refused:String(error?.message||error)}};}
}
export function applySourceConstantLayout(token,xml,output){
 if(token===undefined)return {output};
 const input=profiles.get(token);assert(input,'UNTRUSTED_SOURCE_CONSTANT_LAYOUT');
 const result=preserveSourceConstantLayout({source:input.source,sourceHeader:input.header,header:output.header??'',script:output.script});
 // Packing may adjust display/formatting metadata. Permission comes from a fresh
 // complete comparison of current emitted constants/includes, never the old XML
 // hash. A new value/global/include therefore refuses even with a live token.
 return {output:{...output,header:result.header,script:result.script},proof:{...result.proof,
  observedGuiSha256:token.xmlSha256,currentGuiSha256:sha(xml),currentDeclarationsRevalidated:!result.proof.refused}};
}

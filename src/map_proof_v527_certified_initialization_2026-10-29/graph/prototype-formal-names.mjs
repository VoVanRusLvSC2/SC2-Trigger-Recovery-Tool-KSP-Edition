// Prototype parameter names have no body bindings. Align only those names with
// the unique definition in the SAME program, after proving exact positional ABI.
// Types, modifiers, counts, declaration order and all executable bytes remain.
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const ignored=new Set(['parent','pos','end','line','char','syntaxTokens','symbol','locals','flowNode']);
function shape(n){if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.map(shape);
 return Object.fromEntries(Object.keys(n).filter(k=>!ignored.has(k)).sort().map(k=>[k,shape(n[k])]));}
const sha=s=>createHash('sha256').update(s).digest('hex');
const signature=fn=>shape(Object.fromEntries(Object.entries(fn).filter(([k])=>!['body','name','parameters'].includes(k)).concat([
 ['parameters',Array.from(fn.parameters,p=>Object.fromEntries(Object.entries(p).filter(([k])=>k!=='name')))]])));
function inventory(text){
 const ast=parseImmutableGalaxySyntax(text,'prototype-formal-names');assert.equal(ast.parseDiagnostics.length,0,'PROTOTYPE_FORMAL_SYNTAX');
 const out=new Map();for(const n of ast.statements)if(n.kind===K.FunctionDeclaration){
  const row=out.get(n.name.name)??{bodies:[],prototypes:[]};row[n.body?'bodies':'prototypes'].push(n);out.set(n.name.name,row);
 }return out;
}
function valid(row){
 if(row.bodies.length!==1)return false;
 const fn=row.bodies[0],names=new Set();
 for(const declaration of [fn,...row.prototypes]){
  if(!isDeepStrictEqual(signature(declaration),signature(fn)))return false;
  const formals=Array.from(declaration.parameters);
  if(formals.some(p=>p.name?.kind!==K.Identifier||p.initializer!=null||p.defaultValue!=null)||
   new Set(formals.map(p=>p.name.name)).size!==formals.length)return false;
  formals.forEach(p=>names.add(p.name.name));
 }
 let dependent=false;
 function visit(n){if(!n)return;if(n.kind===K.Identifier&&names.has(n.name))dependent=true;forEachChild(n,visit);}
 for(const declaration of [fn,...row.prototypes]){
  visit(declaration.type);for(const p of declaration.parameters)visit(p.type);
 }
 return !dependent;
}
function align(text,inventory,names){
 const edits=[],records=[];
 for(const name of names){
  const row=inventory.get(name),definition=row.bodies[0],changes=[];
  for(const p of row.prototypes)for(let i=0;i<p.parameters.length;i++){
   const n=p.parameters[i].name,actual=definition.parameters[i].name.name;if(n.name===actual)continue;
   const start=n.end-n.name.length;assert(start>=n.pos&&text.slice(start,n.end)===n.name,'PROTOTYPE_FORMAL_SPAN');
   edits.push({start,end:n.end,text:actual,before:n.name});changes.push({position:i,before:n.name,after:actual});
  }
  if(changes.length)records.push({function:name,prototypes:row.prototypes.length,changes,bodyChanged:false,abiExact:true});
 }
 let out='',cursor=0;const inverse=[];
 for(const e of edits.sort((a,b)=>a.start-b.start)){
  assert(e.start>=cursor,'PROTOTYPE_FORMAL_OVERLAP');out+=text.slice(cursor,e.start);
  inverse.push({start:out.length,end:out.length+e.text.length,text:e.before});out+=e.text;cursor=e.end;
 }out+=text.slice(cursor);inventoryCheck(out);
 let restored=out;for(const e of inverse.toReversed())restored=restored.slice(0,e.start)+e.text+restored.slice(e.end);
 assert.equal(restored,text,'PROTOTYPE_FORMAL_INVERSE');
 return {text:out,records,allOtherBytesExactByInverse:true,beforeSha256:sha(text),afterSha256:sha(out)};
}
function inventoryCheck(text){const a=parseImmutableGalaxySyntax(text,'prototype-formal-result');assert.equal(a.parseDiagnostics.length,0);}
export function normalizePrototypeFormalNamesPair(before,after){
 const a=inventory(before),b=inventory(after),eligible=[],refused=[];
 for(const [name,row]of a){
  const other=b.get(name);if(!row.prototypes.length&&!other?.prototypes.length)continue;
  if(!other||row.prototypes.length!==other.prototypes.length||!valid(row)||!valid(other)){
   refused.push({function:name,reason:'COUNT_UNIQUE_BODY_ABI_OR_INDEPENDENT_TYPES_UNPROVEN'});continue;
  }eligible.push(name);
 }
 const left=align(before,a,eligible),right=align(after,b,eligible);
 return {before:left.text,after:right.text,records:[...left.records.map(r=>({...r,side:'before'})),...right.records.map(r=>({...r,side:'after'}))],
  refused,proof:{kind:'POSITIONAL_PROTOTYPE_FORMAL_NAMES_ONLY',before:left,after:right,
   sourceOrCandidateWritten:false,bodyBytesChanged:false,prototypeCountsAndOrderPreserved:true,wholeProgramEquivalenceProved:false}};
}

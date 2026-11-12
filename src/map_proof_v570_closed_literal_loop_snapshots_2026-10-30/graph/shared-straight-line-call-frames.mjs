// Inline only call sites of unchanged, void(), storage-free source helpers.
// Keep both original helper definitions. This permits no name deletion,
// renamed callback, reordered effect, parameter substitution or proof union.
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {Parser,Printer,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const printer=new Printer(),sha=s=>createHash('sha256').update(s).digest('hex');
const walk=(n,f)=>{f(n);forEachChild(n,c=>walk(c,f));};
const plain=f=>f?.kind===K.FunctionDeclaration&&f.body&&f.type.kind===K.VoidKeyword&&!f.parameters.length&&!f.modifiers?.length;
const call=s=>s?.kind===K.ExpressionStatement&&s.expression.kind===K.CallExpression&&s.expression.expression.kind===K.Identifier?s.expression:undefined;
const syntaxOnly=new Set(['parent','symbol','locals','flowNode']);
function functions(ast){
 const groups=new Map();for(const n of ast.statements)if(n.name?.name){const a=groups.get(n.name.name)??[];a.push(n);groups.set(n.name.name,a);}return groups;
}
export function normalizeSharedStraightLineCallFrames(before,after,{externalSources=[]}={}){
 const proof={kind:'UNCHANGED_SHARED_VOID_ZERO_CALLSITE_EXPANSION',records:{before:[],after:[]},rejectedHelpers:[],helperDefinitionsRetained:true,newRuntimeFunctions:0,sourceOrExportChanged:false,wholeProgramOracleStillRequired:true};
 const asts=[before,after].map((t,i)=>parseImmutableGalaxySyntax(t,'shared-call-side-'+i));
 if(asts.some(a=>a.parseDiagnostics.length))return {before,after,proof:{...proof,refused:'SHARED_CALL_SYNTAX'}};
 // Validate the complete supplied closure. A helper frame has no addressable
 // storage: it has neither locals nor formals. User callees retain their own
 // frames. A direct lexical-scope native in the substituted body is excluded.
 const closure=[...asts,...externalSources.map((f,i)=>new Parser().parseFile(f.fileName??'shared-external-'+i,f.text))];
 for(const a of closure)if(a.parseDiagnostics.length)return {before,after,proof:{...proof,refused:'SHARED_CALL_EXTERNAL_SYNTAX'}};
 const groups=asts.map(functions),helpers=new Map();
 for(const [name,left]of groups[0]){
  const right=groups[1].get(name),a=left.find(n=>n.body),b=right?.find(n=>n.body);
  if(!right||!plain(a)||!plain(b)||left.filter(n=>n.body).length!==1||right.filter(n=>n.body).length!==1||
   ![...left,...right].every(n=>n.kind===K.FunctionDeclaration&&n.type.kind===K.VoidKeyword&&!n.parameters.length&&!n.modifiers?.length)||
   !a.body.statements.length||!a.body.statements.every(s=>!!call(s))||printer.printNode(a)!==printer.printNode(b))continue;
  if(a.body.statements.some(s=>call(s).expression.name==='UnitRefFromVariable')){proof.rejectedHelpers.push({name,reason:'SHARED_CALL_DIRECT_LEXICAL_STORAGE_OBSERVER'});continue;}
  if(closure.slice(2).some(tree=>tree.statements.some(n=>n.name?.name===name&&(n.kind!==K.FunctionDeclaration||n.body||n.type.kind!==K.VoidKeyword||n.parameters.length||n.modifiers?.length)))){proof.rejectedHelpers.push({name,reason:'SHARED_CALL_FOREIGN_DECLARATION_CONFLICT'});continue;}
  helpers.set(name,a);
 }
 const project=(ast,side)=>{
  const copy=(value,allowed)=>{
   if(!value||typeof value!=='object')return value;
   if(Array.isArray(value))return value.map(x=>copy(x,allowed));
   const out=Object.fromEntries(Object.entries(value).filter(([k])=>!syntaxOnly.has(k)&&!(value.kind===K.Block&&k==='statements')).map(([k,v])=>[k,copy(v,allowed)]));
   if(value.kind===K.Block){out.statements=[];for(const s of value.statements){const c=call(s),target=c&&!c.arguments.length&&allowed.get(c.expression.name);
     if(target){out.statements.push(...target.body.statements.map(n=>copy(n,new Map())));proof.records[side].push({caller:allowed.caller,callee:target.name.name,bodySha256:sha(printer.printNode(target)),position:s.pos,effectCount:target.body.statements.length});}
     else out.statements.push(copy(s,allowed));}}
   return out;
  };
  const statements=ast.statements.map(fn=>{
   if(fn.kind!==K.FunctionDeclaration||!fn.body||helpers.has(fn.name.name))return fn;
   const allowed=new Map(helpers);allowed.caller=fn.name.name;
   for(const p of fn.parameters)allowed.delete(p.name.name);
   walk(fn.body,n=>{if(n.kind===K.VariableDeclaration)allowed.delete(n.name.name);});
   return copy(fn,allowed);
  });
  return printer.printFile({...ast,statements});
 };
 const text=[project(asts[0],'before'),project(asts[1],'after')];
 proof.boundary='Typed Galaxy call semantics without debugger/profiler stack observations; substituted helper frames have no locals/formals, direct UnitRefFromVariable consumers are excluded, other user-callee frames remain unchanged.';
 proof.identicalHelpers=[...helpers].map(([name,fn])=>({name,sha256:sha(printer.printNode(fn))}));
 return {before:text[0],after:text[1],proof};
}

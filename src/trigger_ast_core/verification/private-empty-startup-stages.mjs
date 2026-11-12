import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {proveProtocolNameAbsenceWithStringShapes} from '../analysis/protocol-name-string-shapes.mjs';
import {Printer,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const printer=new Printer(),sha=t=>createHash('sha256').update(t).digest('hex');
const plain=f=>f?.kind===K.FunctionDeclaration&&f.type.kind===K.VoidKeyword&&!f.parameters.length&&!f.modifiers?.length;
const direct=s=>s?.kind===K.ExpressionStatement&&s.expression.kind===K.CallExpression&&s.expression.expression.kind===K.Identifier&&!s.expression.arguments.length?s.expression:undefined;
const walk=(n,fn,p)=>{fn(n,p);forEachChild(n,c=>walk(c,fn,n));};
export function normalizePrivateEmptyStartupStages(before,after,externalSources=[]){
 const asts=[before,after].map((t,i)=>parseImmutableGalaxySyntax(t,'empty-stage-side-'+i));
 const external=externalSources.map((f,i)=>parseImmutableGalaxySyntax(f.text,f.fileName??'empty-stage-external-'+i));
 const proof={kind:'PRIVATE_EMPTY_ENTRY_STAGE_REMOVAL',before:[],after:[],refused:[],wholeProgramOracleStillRequired:true,sourceOrExportChanged:false};
 if([...asts,...external].some(a=>a.parseDiagnostics.length))return {before,after,proof:{...proof,refused:['EMPTY_STAGE_SOURCE_SYNTAX']}};
 const names=new Set();
 for(const ast of asts){const roots=ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name==='InitMap'&&n.body);
  if(roots.length!==1||!plain(roots[0]))continue;
  for(const s of roots[0].body.statements){const c=direct(s);if(c&&c.expression.name!=='InitMap')names.add(c.expression.name);}}
 const allowed=[];
 for(const name of names){
  const selections=[];let valid=true;
  for(const ast of asts){
   const defs=ast.statements.filter(n=>n.name?.name===name);
   if(!defs.length){selections.push(undefined);continue;}
   const bodies=defs.filter(n=>n.body),roots=ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name==='InitMap'&&n.body),root=roots[0];
   if(roots.length!==1||!plain(root)||bodies.length!==1||!defs.every(plain)||bodies[0].body.statements.length){valid=false;break;}
   const calls=root.body.statements.filter(s=>direct(s)?.expression.name===name);if(calls.length!==1){valid=false;break;}
   const allowedNodes=new Set(defs.map(n=>n.name));allowedNodes.add(direct(calls[0]).expression);
   for(const tree of [ast,...external])walk(tree,(n,p)=>{
    if(n.kind===K.Identifier&&n.name===name&&!allowedNodes.has(n)&&!(p?.kind===K.FunctionDeclaration&&p.name===n&&!p.body&&plain(p)))valid=false;
   });
   selections.push({defs,root,call:calls[0]});
  }
  if(!valid||selections.every(s=>!s))continue;
  try{
   const protocols=asts.map(ast=>proveProtocolNameAbsenceWithStringShapes([ast,...external],new Set([name])));
   allowed.push({name,selections,protocols});
  }catch(error){proof.refused.push({name,reason:error.message});}
 }
 const text=asts.map((ast,i)=>{
  const removed=new Set(allowed.flatMap(r=>r.selections[i]?.defs??[])),calls=new Set(allowed.flatMap(r=>r.selections[i]?[r.selections[i].call]:[]));
  for(const r of allowed)if(r.selections[i])proof[i?'after':'before'].push({name:r.name,definitionSha256:sha(printer.printNode(r.selections[i].defs.find(n=>n.body))),protocol:r.protocols[i]});
  if(!removed.size)return i?after:before;
  return printer.printFile({...ast,statements:ast.statements.filter(n=>!removed.has(n)).map(n=>n.kind===K.FunctionDeclaration&&n.name.name==='InitMap'&&n.body?{...n,body:{...n.body,statements:n.body.statements.filter(s=>!calls.has(s))}}:n)});
 });
 return {before:text[0],after:text[1],proof};
}

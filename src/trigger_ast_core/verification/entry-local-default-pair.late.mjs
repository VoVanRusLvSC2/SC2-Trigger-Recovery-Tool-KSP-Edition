/** Proof views only. A fresh scalar local already has its language default.
 * Reconcile only an asymmetric first-use store in the straight-line entry
 * prefix. Never erase a parameter, global, aggregate or later runtime reset. */
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=t=>createHash('sha256').update(t).digest('hex');
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const walk=(n,fn)=>{if(n){fn(n);forEachChild(n,c=>walk(c,fn));}};
const zero=n=>n?.kind===K.NumericLiteral&&/^(?:0+|0[xX]0+|0+\.0*|\.0+)$/u.test(n.text??'');
function defaultValue(type,value){
 value=un(value);
 if(type.kind===K.IntKeyword||type.kind===K.ByteKeyword)return zero(value)&&!/[.]/u.test(value.text);
 if(type.kind===K.FixedKeyword)return zero(value);
 if(type.kind===K.BoolKeyword)return value?.kind===K.FalseKeyword;
 // No Unit is the null value, not UnitGroupEmpty or any allocating constructor.
 if([K.UnitKeyword,K.PointKeyword,K.RegionKeyword].includes(type.kind))return value?.kind===K.NullKeyword;
 return false;
}
const assignment=s=>s?.kind===K.ExpressionStatement&&s.expression?.kind===K.BinaryExpression&&s.expression.operatorToken.kind===K.EqualsToken?s.expression:undefined;
function entries(ast){
 const functions=new Map();
 for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
  if(functions.has(fn.name.name)){functions.set(fn.name.name,null);continue;}
  const declarations=new Map();
  walk(fn,n=>{if([K.VariableDeclaration,K.Parameter,K.ParameterDeclaration].includes(n.kind)&&n.name?.name){const a=declarations.get(n.name.name)??[];a.push(n);declarations.set(n.name.name,a);}});
  const locals=new Map(),candidates=new Map(),seen=new Set();
  for(const declaration of fn.body.statements.filter(n=>n.kind===K.VariableDeclaration)){
   if(declarations.get(declaration.name.name)?.length===1&&!declaration.initializer&&!declaration.modifiers?.length)locals.set(declaration.name.name,declaration);
  }
  for(const statement of fn.body.statements){
   if(statement.kind===K.VariableDeclaration){if(statement.initializer)walk(statement.initializer,n=>{if(n.kind===K.Identifier)seen.add(n.name);});continue;}
   if(statement.kind!==K.ExpressionStatement)break;
   const a=assignment(statement),name=a?.left.kind===K.Identifier?a.left.name:undefined,local=locals.get(name);
   if(local&&!seen.has(name)&&defaultValue(local.type,a.right))candidates.set(name,{local,statement});
   // Any earlier reference also excludes reference-taking/capture through calls.
   walk(statement,n=>{if(n.kind===K.Identifier)seen.add(n.name);});
  }
  functions.set(fn.name.name,{fn,locals,candidates});
 }
 return functions;
}
const ignored=new Set(['parent','pos','end','line','char','syntaxTokens','comments','symbol','locals','flowNode','__sourceText']);
function shape(value,dropped){
 if(!value||typeof value!=='object')return value;
 if(Array.isArray(value))return value.filter(n=>!dropped?.has(n)).map(n=>shape(n,dropped));
 return Object.fromEntries(Object.keys(value).filter(k=>!ignored.has(k)&&value[k]!==undefined).sort().map(k=>[k,shape(value[k],dropped)]));
}
export function normalizeEntryLocalDefaultPair(before,after){
 const texts=[before,after],asts=texts.map((t,i)=>parseImmutableGalaxySyntax(t,'entry-default-'+i+'.galaxy'));
 for(const ast of asts)assert.equal(ast.parseDiagnostics.length,0,'ENTRY_DEFAULT_SYNTAX');
 const views=asts.map(entries),records=[],edits=[[],[]],dropped=[new Set(),new Set()];
 for(let side=0;side<2;side++)for(const [name,view]of views[side]){
  const other=views[1-side].get(name);if(!view||!other)continue;
  for(const [variable,candidate]of view.candidates){
   const opposite=other.locals.get(variable);
   if(!opposite||other.candidates.has(variable)||!isDeepStrictEqual(shape(candidate.local.type),shape(opposite.type)))continue;
   const {statement,local}=candidate,semicolons=(statement.syntaxTokens??[]).filter(t=>t.kind===K.SemicolonToken);
   assert.equal(semicolons.length,1,'ENTRY_DEFAULT_STATEMENT_END');
   const end=semicolons[0].pos+1;assert.equal(texts[side][end-1],';');
   edits[side].push({start:statement.pos,end});dropped[side].add(statement);
   records.push({side:side?'after':'before',function:name,variable,carrierKind:local.type.kind,position:statement.pos,
    uniqueFreshLocal:true,firstExecutableReference:true,straightLineEntryPrefix:true,oppositeSameLocalCarrier:true,
    parametersGlobalsAggregatesAndLaterResetsExcluded:true});
  }
 }
 const outputs=texts.map((text,side)=>{
  const ordered=edits[side].sort((a,b)=>a.start-b.start);for(let i=1;i<ordered.length;i++)assert(ordered[i-1].end<=ordered[i].start,'ENTRY_DEFAULT_OVERLAP');
  for(const edit of [...ordered].reverse())text=text.slice(0,edit.start)+text.slice(edit.end);
  const check=parseImmutableGalaxySyntax(text,'entry-default-result.galaxy');assert.equal(check.parseDiagnostics.length,0);
  assert(isDeepStrictEqual(shape(check.statements),shape(asts[side].statements,dropped[side])),'ENTRY_DEFAULT_OTHER_AST_CHANGED');return text;
 });
 return {before:outputs[0],after:outputs[1],proof:{kind:'FRESH_LOCAL_LANGUAGE_DEFAULT_ENTRY_STORE',records,
  inputSha256:texts.map(sha),viewSha256:outputs.map(sha),sourceOrExportChanged:false,runtimeLoopsAndBranchesUnchanged:true,
  originalOracleStillRequired:true,wholeMapAccepted:false}};
}

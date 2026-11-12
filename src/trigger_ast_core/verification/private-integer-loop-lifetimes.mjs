// Alpha-convert closed integer loop lifetimes, not a function's mutable index
// indiscriminately. Every use must belong to a reset+while pair and the loop
// must have exactly its own final increment as the only write to that index.
import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {Parser,Printer,SyntaxKind as K,forEachChild,isAssignmentOperator} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const skip=new Set(['parent','pos','end','line','char','syntaxTokens','comments','symbol','locals','flowNode']);
const shape=n=>!n||typeof n!=='object'?n:Array.isArray(n)?n.map(shape):Object.fromEntries(Object.entries(n).filter(([k])=>!skip.has(k)).map(([k,v])=>[k,shape(v)]));
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
function walk(n,fn,p){if(!n)return;fn(n,p);forEachChild(n,c=>walk(c,fn,n));}
const numeric=(n,value)=>{n=unwrap(n);return n?.kind===K.NumericLiteral&&Number(n.value)===value;};
const assignment=s=>{const b=s?.kind===K.ExpressionStatement?s.expression:undefined;return b?.kind===K.BinaryExpression&&b.operatorToken.kind===K.EqualsToken?b:undefined;};
function localReference(n,p){return n.kind===K.Identifier&&!(p?.kind===K.PropertyAccessExpression&&p.name===n||p?.kind===K.VariableDeclaration&&(p.name===n||p.type===n)||p?.kind===K.Parameter&&(p.name===n||p.type===n)||p?.kind===K.TypeReference||p?.kind===K.FunctionDeclaration&&p.name===n);}
const parse=(text,name)=>{const a=new Parser().parseFile(name,text);assert.equal(a.parseDiagnostics.length,0,'PRIVATE_LOOP_SYNTAX');return a;};

function normalize(ast,prefix){
 const records=[],refused=[];
 for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
  const locals=fn.body.statements.filter(n=>n.kind===K.VariableDeclaration),pairs=[],references=new Map();
  walk(fn.body,(n,p)=>{if(localReference(n,p)){const list=references.get(n.name)??[];list.push(n);references.set(n.name,list);}});
  function discover(block){
   if(block.kind===K.Block)for(let i=0;i+1<block.statements.length;i++){
    const init=assignment(block.statements[i]),loop=block.statements[i+1],condition=unwrap(loop.expression);
    if(!init||init.left.kind!==K.Identifier||!numeric(init.right,0)||loop.kind!==K.WhileStatement||loop.statement?.kind!==K.Block)continue;
    const name=init.left.name,definitions=locals.filter(n=>n.name.name===name),local=definitions[0];
    if(definitions.length!==1||local.type.kind!==K.IntKeyword||local.initializer||local.modifiers?.length||fn.parameters.some(p=>p.name.name===name))continue;
    if(condition?.kind!==K.BinaryExpression||![K.LessThanToken,K.LessThanEqualsToken].includes(condition.operatorToken.kind)||unwrap(condition.left)?.kind!==K.Identifier||unwrap(condition.left).name!==name||unwrap(condition.right)?.kind!==K.NumericLiteral)continue;
    const step=assignment(loop.statement.statements.at(-1)),sum=unwrap(step?.right);
    if(!step||step.left.kind!==K.Identifier||step.left.name!==name||sum?.kind!==K.BinaryExpression||sum.operatorToken.kind!==K.PlusToken||unwrap(sum.left)?.kind!==K.Identifier||unwrap(sum.left).name!==name||!numeric(sum.right,1))continue;
    const owned=new Set();walk(init,n=>owned.add(n));walk(loop,n=>owned.add(n));let extraWrite=false;
    walk(loop,(n,p)=>{
     if(n.kind===K.BinaryExpression&&isAssignmentOperator(n.operatorToken.kind)&&unwrap(n.left)?.kind===K.Identifier&&unwrap(n.left).name===name&&n!==step)extraWrite=true;
     if(n.kind===K.CallExpression&&n.expression?.kind===K.Identifier&&n.expression.name===name)extraWrite=true;
    });
    if(!extraWrite)pairs.push({name,local,init,loop,owned,refs:(references.get(name)??[]).filter(n=>owned.has(n)),bound:Number(unwrap(condition.right).value)});
   }
   forEachChild(block,discover);
  }
  discover(fn.body);
  const candidates=new Set(pairs.map(p=>p.name)),accepted=new Set();
  for(const name of candidates){const group=pairs.filter(p=>p.name===name),refs=references.get(name)??[];
   if(!refs.length||refs.some(n=>group.filter(p=>p.owned.has(n)).length!==1)){refused.push({function:fn.name.name,name,reason:'REFERENCE_OUTSIDE_OR_OVERLAPPING_CLOSED_LIFETIMES'});continue;}accepted.add(name);
  }
  const selected=pairs.filter(p=>accepted.has(p.name)).sort((a,b)=>a.init.pos-b.init.pos),declarations=[];
  for(const [i,pair]of selected.entries()){
   const name=prefix+i;for(const ref of pair.refs)ref.name=name;
   declarations.push(parse('int '+name+';','new-loop-local').statements[0]);
   records.push({function:fn.name.name,from:pair.name,to:name,bound:pair.bound,allUsesInClosedLifetime:true,onlyFinalIncrementWritesIndex:true,iterationAndStoreStatementsRetained:true});
  }
  let at=0;while(fn.body.statements[at]?.kind===K.VariableDeclaration)at++;
  fn.body.statements=[...fn.body.statements.slice(0,at).filter(n=>!accepted.has(n.name.name)),...declarations,...fn.body.statements.slice(at)];
 }
 const text=new Printer().printFile(ast),check=parse(text,'private-loop-view');assert(isDeepStrictEqual(shape(check.statements),shape(ast.statements)),'PRIVATE_LOOP_OTHER_AST_CHANGED');
 return {text,records,refused};
}
export function normalizePrivateIntegerLoopLifetimes(before,after){
 const asts=[parse(before,'private-loop-before'),parse(after,'private-loop-after')],names=new Set();
 for(const ast of asts)walk(ast,n=>{if(n.kind===K.Identifier)names.add(n.name);});
 let prefix='proofPrivateArrayIndex';while([...names].some(n=>n.startsWith(prefix)))prefix+='X';
 const views=asts.map(ast=>normalize(ast,prefix)),[{text:a,...ap},{text:b,...bp}]=views;
 return {before:a,after:b,proof:{kind:'CLOSED_PRIMITIVE_INTEGER_LOOP_LIFETIME_ALPHA',before:ap,after:bp,prefix,sourceOrCandidateChanged:false,noLoopBodyOrGlobalEffectRemoved:true,wholeProgramOracleStillRequired:true}};
}

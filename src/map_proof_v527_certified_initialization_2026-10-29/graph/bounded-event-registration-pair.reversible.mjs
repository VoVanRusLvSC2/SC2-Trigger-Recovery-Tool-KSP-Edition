// Independent comparison interpreter for constructor registration traces. It
// does not import the recovery planner and cannot authorize GUI reconstruction.
// Only closed local-int For loops and exact loaded native Events are admitted.
import assert from 'node:assert/strict';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.mjs';
import {Printer,SyntaxKind as K,forEachChild,isAssignmentOperator} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {getTypeName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
import {readCanonicalInt32Literal} from '../types/inclusive-literal-int-comparison.mjs';
const printer=new Printer(),un=n=>n?.kind===K.ParenthesizedExpression?un(n.expression):n;
const parse=(text,name)=>{const a=parseImmutableGalaxySyntax(text,name);assert.equal(a.parseDiagnostics.length,0,'EVENT_TRACE_SYNTAX');return a;};
function walk(n,fn,parent){if(!n)return;fn(n,parent);forEachChild(n,c=>walk(c,fn,n));}
const statements=n=>n?.kind===K.Block?[...n.statements]:n?[n]:[];
function interpreter(ast,external,events){
 const declarations=new Map(),variables=new Map();
 for(const input of [ast,...external])for(const n of input.statements){const table=n.kind===K.FunctionDeclaration?declarations:n.kind===K.VariableDeclaration?variables:undefined;if(table){const list=table.get(n.name.name)??[];list.push(n);table.set(n.name.name,list);}}
 const native=(name,returnType,parameters)=>{
  const ds=declarations.get(name)??[];
  assert(ds.length&&!variables.has(name)&&ds.every(d=>!d.body&&d.modifiers?.length===1&&d.modifiers[0].kind===K.NativeKeyword&&getTypeName(d.type)===returnType&&JSON.stringify(d.parameters.map(p=>getTypeName(p.type)))===JSON.stringify(parameters)),'EVENT_TRACE_NATIVE_ABI:'+name);
 };
 return function trace(fn){
  assert(getTypeName(fn.type)==='void'&&!fn.parameters.length&&fn.name.name.endsWith('_Init'),'EVENT_TRACE_CONSTRUCTOR');
  assert.equal((declarations.get(fn.name.name)??[]).filter(f=>f.body).length,1,'EVENT_TRACE_FUNCTION_OWNER');
  const ss=[...fn.body.statements],locals=new Map();
  while(ss[0]?.kind===K.VariableDeclaration){const d=ss.shift();assert(!locals.has(d.name.name)&&getTypeName(d.type)==='int'&&!d.modifiers?.length&&!d.initializer,'EVENT_TRACE_LOCAL');locals.set(d.name.name,d);}
  const handle=fn.name.name.slice(0,-5),global=variables.get(handle);
  assert(global?.length===1&&getTypeName(global[0].type)==='trigger'&&!locals.has(handle),'EVENT_TRACE_HANDLE');
  const create=ss.shift(),assign=create?.expression,call=un(assign?.right);
  assert(assign?.kind===K.BinaryExpression&&assign.operatorToken?.kind===K.EqualsToken&&un(assign.left)?.name===handle&&call?.kind===K.CallExpression&&call.expression?.name==='TriggerCreate'&&call.arguments.length===1&&call.arguments[0]?.value===handle+'_Func','EVENT_TRACE_CREATE');
  native('TriggerCreate','trigger',['string']);assert(!locals.has('TriggerCreate'),'EVENT_TRACE_API_SHADOW');
  const output=[create],environment=new Map(),loopNodes=[],used=new Set();let steps=0;
  const number=n=>{n=un(n);if(n?.kind===K.Identifier){assert(environment.has(n.name),'EVENT_TRACE_UNCLOSED_INT');return environment.get(n.name);}const value=readCanonicalInt32Literal(n);assert(value!==undefined,'EVENT_TRACE_INT_LITERAL');return value;};
  const condition=n=>{n=un(n);assert(n?.kind===K.BinaryExpression,'EVENT_TRACE_CONDITION');const a=number(n.left),b=number(n.right);switch(n.operatorToken.kind){case K.LessThanToken:return a<b;case K.LessThanEqualsToken:return a<=b;case K.GreaterThanToken:return a>b;case K.GreaterThanEqualsToken:return a>=b;default:throw Error('EVENT_TRACE_RELATION');}};
  const assignCounter=(n,initial)=>{
   n=un(n);assert(n?.kind===K.BinaryExpression&&n.left?.kind===K.Identifier&&locals.has(n.left.name),'EVENT_TRACE_COUNTER_ASSIGNMENT');
   const op=n.operatorToken.kind;assert(initial?op===K.EqualsToken:[K.PlusEqualsToken,K.MinusEqualsToken].includes(op),'EVENT_TRACE_ASSIGNMENT_KIND');
   const delta=readCanonicalInt32Literal(un(n.right));assert(delta!==undefined,'EVENT_TRACE_STEP_LITERAL');
   const value=initial?delta:number(n.left)+(op===K.PlusEqualsToken?delta:-delta);
   assert(value>=-2147483648n&&value<=2147483647n,'EVENT_TRACE_INT32_OVERFLOW');environment.set(n.left.name,value);return n.left.name;
  };
  const substitute=n=>{
   if(n?.kind===K.Identifier&&environment.has(n.name))return parse('int v='+environment.get(n.name)+';','counter.galaxy').statements[0].initializer;
   if(!n||typeof n!=='object')return n;
   if(Array.isArray(n))return n.map(substitute);
   return Object.fromEntries(Object.entries(n).filter(([k])=>!['parent','syntaxTokens'].includes(k)).map(([k,v])=>[k,substitute(v)]));
  };
  const emit=s=>{
   const c=un(s?.expression),name=c?.expression?.name;
   assert(s?.kind===K.ExpressionStatement&&c?.kind===K.CallExpression&&c.expression.kind===K.Identifier&&un(c.arguments[0])?.name===handle&&!locals.has(name),'EVENT_TRACE_REGISTRATION');
   const effect=events.get(name);
   if(name==='TriggerEnable'){native(name,'void',['trigger','bool']);assert(c.arguments.length===2&&[K.TrueKeyword,K.FalseKeyword].includes(un(c.arguments[1])?.kind),'EVENT_TRACE_ENABLE');}
   else{assert(effect?.returnType==='void'&&effect.parameterTypes[0]==='trigger','EVENT_TRACE_UNKNOWN_EVENT:'+name);native(name,effect.returnType,effect.parameterTypes);assert.equal(c.arguments.length,effect.parameterTypes.length,'EVENT_TRACE_ARGUMENTS');}
   // Substituting a loop-local value may not erase a reference argument.
   // Validate every enclosing call which contains that value, not just the
   // outer event. Unknown functions and shadowed/ambiguous ABI refuse.
   walk(c,n=>{
    if(n.kind!==K.CallExpression)return;
    for(const [index,arg] of n.arguments.entries()){
     let readsCounter=false;walk(arg,v=>{if(v.kind===K.Identifier&&locals.has(v.name))readsCounter=true;});
     if(!readsCounter)continue;
     const name=un(n.expression)?.name,rows=declarations.get(name)??[];
     assert(n.expression.kind===K.Identifier&&!locals.has(name)&&!variables.has(name)&&rows.length&&
      rows.every(fn=>!fn.body&&fn.modifiers?.length===1&&fn.modifiers[0].kind===K.NativeKeyword&&
       fn.parameters.length===n.arguments.length&&!fn.parameters[index].isReference&&
       JSON.stringify(fn.parameters.map(p=>[getTypeName(p.type),!!p.isReference]))===
       JSON.stringify(rows[0].parameters.map(p=>[getTypeName(p.type),!!p.isReference]))&&
       getTypeName(fn.type)===getTypeName(rows[0].type)), 'EVENT_TRACE_COUNTER_CALL_ABI');
     if(un(arg)?.kind===K.Identifier&&locals.has(un(arg).name))
      assert(rows.every(fn=>getTypeName(fn.parameters[index].type)==='int'), 'EVENT_TRACE_COUNTER_ARGUMENT_TYPE');
    }
   });
   walk(c,(n,parent)=>{
    if(n.kind===K.BinaryExpression&&isAssignmentOperator(n.operatorToken?.kind))assert(!locals.has(un(n.left)?.name),'EVENT_TRACE_BODY_WRITE');
    if([K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(n.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(n.operator?.kind))assert(!locals.has(un(n.operand)?.name),'EVENT_TRACE_BODY_WRITE');
    if(n.kind===K.Identifier&&locals.has(n.name))assert(environment.has(n.name)&&!(parent?.kind===K.CallExpression&&parent.expression===n)&&!(parent?.kind===K.PropertyAccessExpression&&parent.name===n),'EVENT_TRACE_LOCAL_ESCAPE');
   });
   assert(output.length<4097,'EVENT_TRACE_EVENT_BOUND');output.push(substitute(s));
  };
  for(const s of ss){
   if(s.kind!==K.ForStatement){assert.equal(environment.size,0);emit(s);continue;}
   const counter=assignCounter(s.initializer,true),cond=un(s.condition),step=un(s.incrementor);
   assert(cond?.left?.kind===K.Identifier&&cond.left.name===counter&&readCanonicalInt32Literal(un(cond.right))!==undefined,'EVENT_TRACE_BOUND');
   assert(step?.left?.name===counter,'EVENT_TRACE_INCREMENT_OWNER');
   const amount=readCanonicalInt32Literal(un(step.right));assert(amount!==undefined,'EVENT_TRACE_STEP_LITERAL');
   const delta=step.operatorToken?.kind===K.MinusEqualsToken?-amount:step.operatorToken?.kind===K.PlusEqualsToken?amount:0n;
   const ascending=[K.LessThanToken,K.LessThanEqualsToken].includes(cond.operatorToken?.kind);assert(ascending?delta>0n:delta<0n,'EVENT_TRACE_DIRECTION');
   const actions=statements(s.statement);assert(actions.length>0,'EVENT_TRACE_EMPTY_LOOP');
   // Validate the zero-iteration body as well; dead source cannot conceal a
   // non-registration statement or an escaping/ref-like counter expression.
   const length=output.length;actions.forEach(emit);output.length=length;
   while(condition(s.condition)){assert(++steps<=4096,'EVENT_TRACE_ITERATION_BOUND');actions.forEach(emit);assignCounter(s.incrementor,false);}
   environment.clear();used.add(counter);loopNodes.push(s);
  }
  assert(locals.size===used.size,'EVENT_TRACE_UNUSED_LOCALS');
  walk(fn.body,n=>{if(n.kind===K.Identifier&&locals.has(n.name)&&locals.get(n.name).name!==n)assert(loopNodes.some(l=>l.initializer.left.name===n.name&&n.pos>=l.pos&&n.end<=l.end),'EVENT_TRACE_ESCAPING_COUNTER');});
  return {output,lines:output.map(n=>printer.printNode(n)),loops:loopNodes.length,events:output.length-1};
 };
}
export function normalizeBoundedEventRegistrationPair(source,target,{externalSources=[],nativeEvents=[]}={}){
 const a=parse(source,'events-source.galaxy');
 const candidates=a.statements.filter(fn=>fn.kind===K.FunctionDeclaration&&fn.body?.statements.some(n=>n.kind===K.ForStatement)&&fn.name.name.endsWith('_Init'));
 if(!candidates.length)return {before:source,after:target,records:[],refused:[],sourceOrCandidateChanged:false,wholeProgramEquivalent:false,onlyComparisonRepresentationChanged:true};
 const b=parse(target,'events-target.galaxy'),external=externalSources.map((f,i)=>parse(typeof f==='string'?f:f.text,'dependency-'+i+'.galaxy'));
 const events=new Map(nativeEvents.map(e=>[e.name,e.signature]));
 const left=interpreter(a,external,events),right=interpreter(b,external,events),records=[],refused=[];
 const editsA=[],editsB=[];
 for(const fn of candidates){
  try{
   const matches=b.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name===fn.name.name&&n.body);assert.equal(matches.length,1,'EVENT_TRACE_TARGET_FUNCTION');
   const x=left(fn),y=right(matches[0]);assert.deepEqual(x.lines,y.lines,'EVENT_TRACE_ORDER_OR_ARGUMENT_DIFFERENCE');
   for(const [input,owner,trace,edits] of [[source,fn,x,editsA],[target,matches[0],y,editsB]]){
    const body=owner.body,close=body.syntaxTokens?.filter(token=>token.kind===K.CloseBraceToken).at(-1);
    assert(close&&input[close.pos]==='}'&&input[body.pos]==='{','EVENT_TRACE_BODY_TOKEN_RANGE');
    const end=close.pos+1;
    edits.push({start:body.pos,end,before:input.slice(body.pos,end),
     replacement:'{\n'+trace.lines.join('\n')+'\n}',role:'exact-ordered-registration-trace',function:owner.name.name});
   }
   records.push({function:fn.name.name,sourceLoops:x.loops,targetLoops:y.loops,events:x.events,exactOrderedRegistrationTrace:true,counterScopeClosed:true});
  }catch(error){refused.push({function:fn.name.name,reason:String(error.message)});}
 }
 const before=applyReversibleSourceEdits(source,editsA),after=applyReversibleSourceEdits(target,editsB);
 assert.equal(parse(before.text,'event-trace-source-result').parseDiagnostics.length,0);
 assert.equal(parse(after.text,'event-trace-target-result').parseDiagnostics.length,0);
 return {before:before.text,after:after.text,records,refused,proof:{before:before.proof,after:after.proof},
  sourceOrCandidateChanged:false,wholeProgramEquivalent:false,onlyComparisonRepresentationChanged:true};
}

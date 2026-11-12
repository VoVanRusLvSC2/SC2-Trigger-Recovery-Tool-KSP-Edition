// Recover finite event registrations as ordinary GUI Events. The authored AST
// remains intact; only the constructor's GUI input view is expanded. No native
// declaration is synthesized. Unknown bounds, writes and escaping counters fail.
import {Parser,SyntaxKind as K,forEachChild,isAssignmentOperator} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {getTypeName} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/06d3b5115b52-6da1ac5f5fd9-60762c25dea4-g2t-core.js';
import {readCanonicalInt32Literal} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/eb718f8c41bf-inclusive-literal-int-comparison.mjs';
import assert from 'node:assert/strict';
const un=n=>n?.kind===K.ParenthesizedExpression?un(n.expression):n;
const body=n=>n?.kind===K.Block?[...n.statements]:n?[n]:[];
function walk(n,visit,parent){if(!n)return;visit(n,parent);forEachChild(n,c=>walk(c,visit,n));}
export function createBoundedEventInitializerModel(sourceStatements,declarationSources,isGuiEvent){
 const declarations=new Map(),globals=new Map(),bodies=new Map();
 for(const statements of [sourceStatements,...declarationSources.map(a=>a.statements)])for(const n of statements){
  if(n.kind===K.VariableDeclaration){const group=globals.get(n.name.name)??[];group.push(n);globals.set(n.name.name,group);}
  if(n.kind===K.FunctionDeclaration){const table=n.body?bodies:declarations,list=table.get(n.name.name)??[];list.push(n);table.set(n.name.name,list);}
 }
 const native=name=>{
  const ds=declarations.get(name)??[];
  if(!ds.length||bodies.has(name)||globals.has(name))return;
  const key=d=>JSON.stringify([getTypeName(d.type),d.parameters.map(p=>getTypeName(p.type))]);
  if(!ds.every(d=>d.modifiers?.length===1&&d.modifiers[0].kind===K.NativeKeyword&&key(d)===key(ds[0])))return;
  return ds[0];
 };
 const create=native('TriggerCreate');
 const createValid=create&&getTypeName(create.type)==='trigger'&&create.parameters.length===1&&getTypeName(create.parameters[0].type)==='string';
 return function plan(fn,{handle,callback}){
  if(!fn.body?.statements.some(s=>s.kind===K.ForStatement))return;
  try{
   assert(createValid,'EVENT_LOOP_CREATE_ABI');
   assert(bodies.get(fn.name.name)?.length===1&&getTypeName(fn.type)==='void'&&!fn.parameters.length,'EVENT_LOOP_FUNCTION_OWNER');
   assert.equal(fn.name.name,handle+'_Init','EVENT_LOOP_CONSTRUCTOR_NAME');
   assert(globals.get(handle)?.length===1&&getTypeName(globals.get(handle)[0].type)==='trigger','EVENT_LOOP_HANDLE_OWNER');
   const ss=[...fn.body.statements],locals=[];while(ss[0]?.kind===K.VariableDeclaration)locals.push(ss.shift());
   const assignment=ss[0]?.expression,call=un(assignment?.right);
   assert(assignment?.kind===K.BinaryExpression&&assignment.operatorToken?.kind===K.EqualsToken&&un(assignment.left)?.name===handle&&call?.kind===K.CallExpression&&call.expression?.name==='TriggerCreate'&&call.arguments.length===1&&call.arguments[0]?.value===callback,'EVENT_LOOP_CREATE_SHAPE');
   const localNames=new Set(locals.map(n=>n.name.name));assert(localNames.size===locals.length&&!localNames.has(handle),'EVENT_LOOP_LOCAL_OWNER');
   const counters=new Set(),loops=[],sourceEvents=[],output=[ss[0]];let expanded=0;
   const event=s=>{
    const e=un(s?.expression),name=e?.expression?.name,decl=name&&native(name);
    assert(s?.kind===K.ExpressionStatement&&e?.kind===K.CallExpression&&decl&&!localNames.has(name)&&un(e.arguments[0])?.name===handle,'EVENT_LOOP_EVENT_TARGET_OR_ABI');
    assert(getTypeName(decl.type)==='void'&&e.arguments.length===decl.parameters.length&&getTypeName(decl.parameters[0]?.type)==='trigger','EVENT_LOOP_EVENT_SIGNATURE');
    assert(name==='TriggerEnable'?e.arguments.length===2&&getTypeName(decl.parameters[1]?.type)==='bool'&&[K.TrueKeyword,K.FalseKeyword].includes(un(e.arguments[1])?.kind):isGuiEvent(name,e.arguments.length-1,e),'EVENT_LOOP_GUI_EVENT_MISSING');
    assert(!localNames.has('TriggerCreate'),'EVENT_LOOP_LOCAL_API_SHADOW');
    if(name!=='TriggerEnable')sourceEvents.push(e);
    return s;
   };
   for(const statement of ss.slice(1)){
    if(statement.kind!==K.ForStatement){output.push(event(statement));continue;}
    const init=un(statement.initializer),condition=un(statement.condition),increment=un(statement.incrementor),counter=un(init?.left)?.name;
    assert(init?.kind===K.BinaryExpression&&init.operatorToken?.kind===K.EqualsToken&&counter,'EVENT_LOOP_INIT');
    const local=locals.filter(n=>n.name.name===counter);assert(local.length===1&&getTypeName(local[0].type)==='int'&&!local[0].initializer&&!local[0].modifiers?.length,'EVENT_LOOP_COUNTER_TYPE');
    assert(condition?.kind===K.BinaryExpression&&un(condition.left)?.name===counter,'EVENT_LOOP_CONDITION');
    assert(increment?.kind===K.BinaryExpression&&un(increment.left)?.name===counter&&[K.PlusEqualsToken,K.MinusEqualsToken].includes(increment.operatorToken?.kind),'EVENT_LOOP_STEP');
    const values=[init.right,condition.right,increment.right].map(readCanonicalInt32Literal);assert(values.every(v=>v!==undefined),'EVENT_LOOP_LITERAL_RANGE');
    const [start,bound,amount]=values,delta=increment.operatorToken.kind===K.MinusEqualsToken?-amount:amount,op=condition.operatorToken.kind;
    assert([K.LessThanToken,K.LessThanEqualsToken,K.GreaterThanToken,K.GreaterThanEqualsToken].includes(op),'EVENT_LOOP_COMPARISON');
    const ascending=[K.LessThanToken,K.LessThanEqualsToken].includes(op);assert(ascending?delta>0n:delta<0n,'EVENT_LOOP_DIRECTION');
    const events=body(statement.statement);assert(events.length>0,'EVENT_LOOP_EMPTY_BODY');events.forEach(event);
    walk(statement.statement,(n,parent)=>{
     assert(!(n.kind===K.BinaryExpression&&isAssignmentOperator(n.operatorToken?.kind)&&un(n.left)?.name===counter),'EVENT_LOOP_COUNTER_WRITE');
     assert(!([K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(n.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(n.operator?.kind)&&un(n.operand)?.name===counter),'EVENT_LOOP_COUNTER_WRITE');
     if(n.kind===K.Identifier&&n.name===counter)assert(!(parent?.kind===K.CallExpression&&parent.expression===n)&&!(parent?.kind===K.PropertyAccessExpression&&parent.name===n),'EVENT_LOOP_COUNTER_NOT_VALUE');
    });
    const continues=value=>op===K.LessThanToken?value<bound:op===K.LessThanEqualsToken?value<=bound:op===K.GreaterThanToken?value>bound:value>=bound;
    let iterations=0;
    for(let value=start;continues(value);value+=delta){
     assert(++iterations<=4096&&expanded+events.length<=4096,'EVENT_LOOP_EXPANSION_BOUND');
     const parsed=new Parser().parseFile('event-counter.galaxy','int value='+value+';');assert.equal(parsed.parseDiagnostics.length,0);const literal=parsed.statements[0].initializer;
     const replace=n=>{
      if(!n||typeof n!=='object')return n;
      if(n.kind===K.Identifier&&n.name===counter)return literal;
      if(Array.isArray(n)){const next=n.map(replace);return next.every((v,i)=>v===n[i])?n:next;}
      const entries=Object.entries(n).filter(([key])=>!['parent','syntaxTokens'].includes(key));
      const next=entries.map(([key,v])=>[key,replace(v)]);
      return next.every(([key,v])=>v===n[key])?n:Object.fromEntries(next);
     };
     for(const event of events){output.push(replace(event));expanded++;}
     assert(value+delta>=-2147483648n&&value+delta<=2147483647n,'EVENT_LOOP_INT32_OVERFLOW');
    }
    counters.add(counter);loops.push({statement,counter,start:String(start),bound:String(bound),step:String(delta),iterations,eventStatements:events.length});
   }
   assert(locals.length===counters.size&&locals.every(l=>counters.has(l.name.name)),'EVENT_LOOP_EXTRA_LOCALS');
   walk(fn.body,n=>{
    if(n.kind!==K.Identifier||!counters.has(n.name))return;
    if(locals.some(l=>l.name===n))return;
    assert(loops.some(l=>l.counter===n.name&&n.pos>=l.statement.pos&&n.end<=l.statement.end),'EVENT_LOOP_COUNTER_ESCAPES');
   });
   return {statements:output,sourceEvents,proof:{kind:'BOUNDED_NATIVE_GUI_EVENT_EXPANSION',function:fn.name.name,handle,callback,
    loops:loops.map(({statement,...r})=>r),expandedEvents:expanded,preservesRegistrationOrder:true,authoredAstChanged:false,newNativeDefinitions:0,newRuntimeFunctions:0}};
  }catch(error){return {refused:String(error.message),function:fn.name.name};}
 };
}

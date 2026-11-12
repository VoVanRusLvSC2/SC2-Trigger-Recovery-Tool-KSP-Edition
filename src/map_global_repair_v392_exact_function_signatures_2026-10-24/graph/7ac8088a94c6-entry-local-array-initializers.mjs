import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';

const base=n=>n?.kind===K.Identifier?n.name:
 [K.ParenthesizedExpression,K.ElementAccessExpression,K.PropertyAccessExpression].includes(n?.kind)?base(n.expression):undefined;
const assignment=n=>n?.kind===K.BinaryExpression&&n.operatorToken.kind===K.EqualsToken;
const counterUpdate=(n,counters)=>n?.kind===K.BinaryExpression&&[K.PlusEqualsToken,K.MinusEqualsToken].includes(n.operatorToken.kind)&&
 n.left.kind===K.Identifier&&counters.has(n.left.name);
const branches=new Set([K.IfStatement,K.SwitchStatement,K.ReturnStatement,K.BreakStatement,K.ContinueStatement,K.DoStatement]);
const calls=n=>{const pending=[n];while(pending.length){const item=pending.pop();if(item.kind===K.CallExpression)return true;forEachChild(item,c=>{pending.push(c);});}return false;};

// The GUI emitter initializes one local array per fill loop. A loop containing
// actions, branches, unrelated scalar stores, global stores or multiple arrays
// cannot be that metadata initializer. Unknown expressions retain the previous
// all-writes policy; they never authorize omission.
function loopRegion(node,locals){
 const counters=new Set(),arrays=new Set(),pending=[node];let unknown=false,action=false;
 const collectIdentifiers=n=>{if(!n)return;const stack=[n];while(stack.length){const x=stack.pop();if(x.kind===K.Identifier&&locals.has(x.name))counters.add(x.name);forEachChild(x,c=>{stack.push(c);});}};
 const discover=[node];while(discover.length){const x=discover.pop();if([K.ForStatement,K.WhileStatement].includes(x.kind)){
   collectIdentifiers(x.condition??x.expression);collectIdentifiers(x.incrementor);collectIdentifiers(x.initializer);
  }forEachChild(x,c=>{discover.push(c);});}
 while(pending.length){
  const x=pending.pop();
  if(branches.has(x.kind))action=true;
  if(x.kind===K.CallExpression)unknown=true;
  if(x.kind===K.VariableDeclaration&&!counters.has(x.name.name))action=true;
  if(x.kind===K.ExpressionStatement&&!assignment(x.expression)&&!counterUpdate(x.expression,counters)&&
     !([K.PostfixUnaryExpression,K.PrefixUnaryExpression].includes(x.expression?.kind)&&counters.has(base(x.expression.operand))))action=true;
  if(assignment(x)){
   const name=base(x.left);if(!locals.has(name))action=true;
   else if(x.left.kind===K.ElementAccessExpression)arrays.add(name);
   else if(x.left.kind!==K.Identifier||!counters.has(name))action=true;
  }
  forEachChild(x,c=>{pending.push(c);});
 }
 if(action||arrays.size>1)return 'action';
 if(unknown||arrays.size===0)return 'unknown';
 return 'entry';
}

export function entryLocalArrayWrites(fn,{collectDefaultWrites,allWrites}){
 const locals=new Set(fn.body.statements.filter(n=>n.kind===K.VariableDeclaration).map(n=>n.name.name));
 const writes=new Set();
 for(const statement of fn.body.statements){
  if(statement.kind===K.VariableDeclaration){
   if(calls(statement))return {writes:allWrites,qualification:'CONSERVATIVE_ALL_WRITES',reason:'EFFECTFUL_LOCAL_DECLARATION'};
  }else if(statement.kind===K.ExpressionStatement){
   const value=statement.expression;
   if(!assignment(value)||!locals.has(base(value.left)))break;
   if(calls(value))return {writes:allWrites,qualification:'CONSERVATIVE_ALL_WRITES',reason:'EFFECTFUL_ENTRY_ASSIGNMENT'};
  }else if([K.ForStatement,K.WhileStatement].includes(statement.kind)){
   const region=loopRegion(statement,locals);
   if(region==='action')break;
   if(region==='unknown')return {writes:allWrites,qualification:'CONSERVATIVE_ALL_WRITES',reason:'UNCLASSIFIED_ENTRY_LOOP'};
  }else if(branches.has(statement.kind))break;
  else return {writes:allWrites,qualification:'CONSERVATIVE_ALL_WRITES',reason:'UNCLASSIFIED_ENTRY_STATEMENT'};
  collectDefaultWrites(statement,writes);
 }
 return {writes,qualification:'LOCAL_INITIALIZER_PREFIX',runtimeActionsChanged:false};
}

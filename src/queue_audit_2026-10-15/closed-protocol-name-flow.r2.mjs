// Finite string-flow proof for private startup names. Unknown values refuse.
// Read-only string parameters relay constraints to every direct caller. All
// observer inputs are solved together, including indirect-name exclusions for
// each relay function; unseeded relays have no call path in the supplied Galaxy
// program. Native observer behavior is an explicit core-API contract.
import assert from 'node:assert/strict';
import {SyntaxKind as K,forEachChild} from '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName,unwrapArrayType} from '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
function walk(n,fn,parent,owner){if(!n)return;if(n.kind===K.FunctionDeclaration)owner=n;fn(n,parent,owner);forEachChild(n,c=>walk(c,fn,n,owner));}
const writes=new Set(['EqualsToken','PlusEqualsToken','MinusEqualsToken','AsteriskEqualsToken','SlashEqualsToken','PercentEqualsToken','LessThanLessThanEqualsToken','GreaterThanGreaterThanEqualsToken','AmpersandEqualsToken','BarEqualsToken','CaretEqualsToken'].map(n=>K[n]).filter(k=>k!==undefined));
export function proveClosedProtocolNameAbsence(asts,privateNames){
 const functions=new Map(),globals=new Map(),calls=new Map(),allNodes=[],observers=new Map([['TriggerCreate',[0]],['TriggerFind',[0]],['MovieAddTriggerFunction',[0]]]);
 for(const ast of asts){
  for(const f of ast.statements){if(f.kind===K.FunctionDeclaration){const fs=functions.get(f.name.name)??[];fs.push(f);functions.set(f.name.name,fs);if(!f.body&&f.modifiers?.some(m=>m.kind===K.NativeKeyword)){const indices=f.parameters.flatMap((p,i)=>getTypeName(p.type)==='string'&&/function/iu.test(p.name?.name??'')?[i]:[]);if(indices.length)observers.set(f.name.name,[...new Set([...(observers.get(f.name.name)??[]),...indices])]);}}
   if(f.kind===K.VariableDeclaration){const gs=globals.get(f.name.name)??[];gs.push(f);globals.set(f.name.name,gs);}}
  walk(ast,(n,parent,owner)=>{allNodes.push({n,parent,owner});if(n.kind===K.CallExpression&&n.expression?.kind===K.Identifier){const list=calls.get(n.expression.name)??[];list.push({n,owner});calls.set(n.expression.name,list);}});
 }
 const equations=[],relays=new Map(),forbidden=new Set(privateNames),sinks=[];
 function node(kind,children=[],literal){assert(equations.length<2000,'PROTOCOL_FLOW_NODE_BOUND');const n={kind,children,values:new Set(literal===undefined?[]:[literal])};equations.push(n);return n;}
 function expression(expr,owner,stack=[]){
  expr=unwrap(expr);assert(expr,'PROTOCOL_FLOW_ARGUMENT_ABSENT');
  if(expr.kind===K.StringLiteral){assert(/^[\x20-\x7e]*$/u.test(expr.value)&&!expr.value.includes('\\'),'PROTOCOL_FLOW_STRING_ENCODING');return node('literal',[],expr.value);}
  if(expr.kind===K.BinaryExpression&&expr.operatorToken?.kind===K.PlusToken)return node('concat',[expression(expr.left,owner,stack),expression(expr.right,owner,stack)]);
  assert(expr.kind===K.Identifier,'PROTOCOL_FLOW_UNKNOWN_STRING_EXPRESSION');
  const index=owner?.parameters.findIndex(p=>p.name?.name===expr.name)??-1;
  if(index<0){
   if(owner)walk(owner.body,n=>{assert(n.kind!==K.VariableDeclaration||n.name?.name!==expr.name,'PROTOCOL_FLOW_LOCAL_SHADOWS_GLOBAL');});
   const ds=globals.get(expr.name)??[],d=ds[0];assert(ds.length===1&&d.modifiers?.some(m=>m.kind===K.ConstKeyword)&&getTypeName(d.type)==='string'&&d.initializer,'PROTOCOL_FLOW_UNKNOWN_OR_MUTABLE_STRING');
   for(const {n}of allNodes)if(n.kind===K.BinaryExpression&&writes.has(n.operatorToken?.kind))assert(unwrap(n.left)?.name!==expr.name,'PROTOCOL_FLOW_CONSTANT_WRITTEN');
   assert(!stack.includes(expr.name),'PROTOCOL_FLOW_CONSTANT_CYCLE');return expression(d.initializer,undefined,[...stack,expr.name]);
  }
  const name=owner.name.name,key=name+':'+index;if(relays.has(key))return relays.get(key).node;
  const defs=functions.get(name)??[],bodyDefs=defs.filter(f=>f.body),param=owner.parameters[index];
  assert(bodyDefs.length===1&&bodyDefs[0]===owner&&!globals.has(name),'PROTOCOL_FLOW_RELAY_OWNER');
  assert(getTypeName(owner.type)==='void'&&getTypeName(param.type)==='string'&&!unwrapArrayType(param.type).sizes.length&&!param.initializer&&!param.isReference,'PROTOCOL_FLOW_RELAY_SIGNATURE');
  assert(defs.every(f=>!f.modifiers?.length&&getTypeName(f.type)==='void'&&f.parameters.length===owner.parameters.length&&f.parameters.every((p,i)=>getTypeName(p.type)===getTypeName(owner.parameters[i].type))),'PROTOCOL_FLOW_RELAY_PROTOTYPE');
  assert(owner.parameters.filter(p=>p.name?.name===expr.name).length===1,'PROTOCOL_FLOW_PARAMETER_COLLISION');
  walk(owner.body,n=>{assert(n.kind!==K.VariableDeclaration||n.name?.name!==expr.name,'PROTOCOL_FLOW_PARAMETER_SHADOW');if(n.kind===K.BinaryExpression&&writes.has(n.operatorToken?.kind))assert(unwrap(n.left)?.name!==expr.name,'PROTOCOL_FLOW_PARAMETER_WRITE');});
  for(const {n,parent}of allNodes){if(n.kind===K.Identifier&&n.name===name)assert(parent?.kind===K.FunctionDeclaration&&parent.name===n||parent?.kind===K.CallExpression&&parent.expression===n,'PROTOCOL_FLOW_INDIRECT_RELAY_REFERENCE');if(n.kind===K.StringLiteral)assert(!n.value.includes(name),'PROTOCOL_FLOW_REFLECTED_RELAY');}
  forbidden.add(name);const value=node('union'),sites=calls.get(name)??[];relays.set(key,{name,parameter:index,node:value,callSites:sites.length});
  for(const site of sites){assert.equal(site.n.arguments.length,owner.parameters.length,'PROTOCOL_FLOW_RELAY_ARGUMENT_COUNT');value.children.push(expression(site.n.arguments[index],site.owner));}
  return value;
 }
 for(const [name,indices]of observers)for(const call of calls.get(name)??[])for(const index of indices)sinks.push({name,index,value:expression(call.n.arguments[index],call.owner)});
 let changed=true,iterations=0;
 while(changed){assert(++iterations<=2000,'PROTOCOL_FLOW_FIXPOINT_BOUND');changed=false;for(const e of equations){
  const values=e.kind==='union'?e.children.flatMap(n=>[...n.values]):e.kind==='concat'?[...e.children[0].values].flatMap(a=>[...e.children[1].values].map(b=>a+b)):[];
  for(const value of values){assert(value.length<=4096,'PROTOCOL_FLOW_STRING_BOUND');if(!e.values.has(value)){assert(e.values.size<128,'PROTOCOL_FLOW_VALUE_BOUND');e.values.add(value);changed=true;}}
 }}
 for(const sink of sinks)for(const value of sink.value.values)for(const name of forbidden)assert(!value.toLowerCase().includes(name.toLowerCase()),'PROTOCOL_FLOW_NAME_OBSERVED:'+name);
 return {kind:'CLOSED_GALAXY_PROTOCOL_NAME_FLOW',privateNames:[...privateNames],relayFunctions:[...relays.values()].map(({name,parameter,callSites,node})=>({name,parameter,callSites,possibleValues:[...node.values]})),observerCalls:sinks.length,iterations,allUnknownStringInputsRefused:true,entryBoundary:'Supplied Galaxy program and explicit core function-name consumers; not an audit of arbitrary external engine entry mechanisms.',wholeMapAcceptance:false};
}

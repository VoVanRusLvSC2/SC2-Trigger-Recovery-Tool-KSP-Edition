// Sound over-approximation of strings reaching the existing protocol-name
// consumers. Unknown strings stay arbitrary; fixed concatenated affixes can
// still exclude a private identifier. Cycles over-approximate to "may match".
import assert from 'node:assert/strict';
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {getTypeName,unwrapArrayType} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/06d3b5115b52-6da1ac5f5fd9-60762c25dea4-g2t-core.js';
import {readStringLiteralValue} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/c08bba33eae3-string-literal-value.mjs';
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
function walk(n,f,p,owner){if(!n)return;if(n.kind===K.FunctionDeclaration)owner=n;f(n,p,owner);forEachChild(n,c=>walk(c,f,n,owner));}
const writes=new Set(['EqualsToken','PlusEqualsToken','MinusEqualsToken','AsteriskEqualsToken','SlashEqualsToken','PercentEqualsToken','LessThanLessThanEqualsToken','GreaterThanGreaterThanEqualsToken','AmpersandEqualsToken','BarEqualsToken','CaretEqualsToken'].map(k=>K[k]));
const literal=n=>{const d=readStringLiteralValue(n.text);return d&&!d.needsPreset?d.value:undefined;};

export function proveProtocolNameAbsenceWithStringShapes(asts,privateNames) {
  const functions=new Map(),globals=new Map(),calls=new Map(),nodes=[],observers=new Map([['TriggerCreate',[0]],['TriggerFind',[0]],['MovieAddTriggerFunction',[0]]]);
  for(const ast of asts) {
    for(const n of ast.statements) {
      if(n.kind===K.FunctionDeclaration){const a=functions.get(n.name.name)??[];a.push(n);functions.set(n.name.name,a);
        if(!n.body&&n.modifiers?.some(m=>m.kind===K.NativeKeyword)){const indices=n.parameters.flatMap((p,i)=>getTypeName(p.type)==='string'&&/function/iu.test(p.name?.name??'')?[i]:[]);if(indices.length)observers.set(n.name.name,[...new Set([...(observers.get(n.name.name)??[]),...indices])]);}}
      if(n.kind===K.VariableDeclaration){const a=globals.get(n.name.name)??[];a.push(n);globals.set(n.name.name,a);}
    }
    walk(ast,(n,parent,owner)=>{nodes.push({n,parent,owner});if(n.kind===K.CallExpression&&n.expression.kind===K.Identifier){const a=calls.get(n.expression.name)??[];a.push({n,owner});calls.set(n.expression.name,a);}});
  }
  const grammar=[],relays=new Map(),forbidden=new Set(privateNames),unknownReasons=new Set();
  const node=(kind,children=[],value)=>{assert(grammar.length<2000,'PROTOCOL_SHAPE_NODE_BOUND');const n={id:grammar.length,kind,children,value};grammar.push(n);return n;};
  const any=node('unknown');
  const unknown=reason=>{unknownReasons.add(reason);return any;};
  function readonlyRelay(owner,index) {
    const defs=functions.get(owner.name.name)??[],param=owner.parameters[index];
    if(defs.filter(f=>f.body).length!==1||globals.has(owner.name.name)||getTypeName(owner.type)!=='void'||getTypeName(param.type)!=='string'||unwrapArrayType(param.type).sizes.length||param.initializer||param.isReference)return false;
    if(!defs.every(f=>!f.modifiers?.length&&getTypeName(f.type)==='void'&&f.parameters.length===owner.parameters.length&&f.parameters.every((p,i)=>getTypeName(p.type)===getTypeName(owner.parameters[i].type))))return false;
    if(owner.parameters.filter(p=>p.name.name===param.name.name).length!==1)return false;
    let valid=true;
    walk(owner.body,n=>{if(n.kind===K.VariableDeclaration&&n.name.name===param.name.name)valid=false;if(n.kind===K.BinaryExpression&&writes.has(n.operatorToken.kind)&&unwrap(n.left)?.name===param.name.name)valid=false;});
    for(const {n,parent}of nodes){if(n.kind===K.Identifier&&n.name===owner.name.name&&!(parent?.kind===K.FunctionDeclaration&&parent.name===n||parent?.kind===K.CallExpression&&parent.expression===n))valid=false;
      if(n.kind===K.StringLiteral){const value=literal(n);if(value?.toLowerCase()===owner.name.name.toLowerCase())valid=false;}}
    return valid;
  }
  function expression(input,owner,stack=[]) {
    const n=unwrap(input);if(!n)return unknown('MISSING_ARGUMENT');
    if(n.kind===K.StringLiteral){const value=literal(n);return value===undefined?unknown('OPAQUE_LITERAL'):node('literal',[],value.toLowerCase());}
    if(n.kind===K.BinaryExpression&&n.operatorToken.kind===K.PlusToken)return node('concat',[expression(n.left,owner,stack),expression(n.right,owner,stack)]);
    if(n.kind!==K.Identifier)return unknown('UNMODELLED_STRING_EXPRESSION');
    const index=owner?.parameters.findIndex(p=>p.name.name===n.name)??-1;
    if(index>=0) {
      const key=owner.name.name+':'+index;if(relays.has(key))return relays.get(key).node;
      if(!readonlyRelay(owner,index))return unknown('NON_READONLY_RELAY_PARAMETER');
      const value=node('union'),sites=calls.get(owner.name.name)??[];
      forbidden.add(owner.name.name);relays.set(key,{name:owner.name.name,parameter:index,callSites:sites.length,node:value});
      for(const site of sites){assert.equal(site.n.arguments.length,owner.parameters.length,'PROTOCOL_SHAPE_RELAY_ARITY');value.children.push(expression(site.n.arguments[index],site.owner,stack));}
      return value;
    }
    let local=false;if(owner)walk(owner.body,x=>{if(x.kind===K.VariableDeclaration&&x.name.name===n.name)local=true;});
    if(local)return unknown('LOCAL_STRING_VALUE');
    const ds=globals.get(n.name)??[],d=ds[0];
    if(ds.length!==1||!d.modifiers?.some(m=>m.kind===K.ConstKeyword)||getTypeName(d.type)!=='string'||unwrapArrayType(d.type).sizes.length||!d.initializer||stack.includes(n.name))return unknown('NON_CONSTANT_STRING_VALUE');
    if(nodes.some(({n:x})=>x.kind===K.BinaryExpression&&writes.has(x.operatorToken.kind)&&unwrap(x.left)?.name===n.name))return unknown('WRITTEN_STRING_CONSTANT');
    return expression(d.initializer,undefined,[...stack,n.name]);
  }
  const sinks=[];
  for(const [name,indices]of observers)for(const site of calls.get(name)??[])for(const index of indices)sinks.push({name,index,node:expression(site.n.arguments[index],site.owner)});
  let checks=0,cycles=0;
  function mayMatch(n,word,memo,active) {
    assert(++checks<2000000,'PROTOCOL_SHAPE_MATCH_BOUND');
    const key=n.id+'\0'+word;if(memo.has(key))return memo.get(key);
    if(active.has(key)){cycles++;return true;}
    active.add(key);let value;
    if(n.kind==='unknown')value=true;
    else if(n.kind==='literal')value=n.value===word;
    else if(n.kind==='union')value=n.children.some(c=>mayMatch(c,word,memo,active));
    else {
      const [a,b]=n.children;
      const splits=b.kind==='literal'?[word.length-b.value.length]:a.kind==='literal'?[a.value.length]:Array.from({length:word.length+1},(_,i)=>i);
      value=splits.some(i=>i>=0&&i<=word.length&&mayMatch(b,word.slice(i),memo,active)&&mayMatch(a,word.slice(0,i),memo,active));
    }
    active.delete(key);memo.set(key,value);return value;
  }
  for(const name of forbidden) {
    assert(/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)&&name.length<=256,'PROTOCOL_SHAPE_IDENTIFIER_BOUND');
    const memo=new Map();for(const sink of sinks)assert(!mayMatch(sink.node,name.toLowerCase(),memo,new Set()),'PROTOCOL_FLOW_NAME_POSSIBLE:'+name);
  }
  return {kind:'CLOSED_PROTOCOL_NAMES_WITH_CONCATENATION_CONSTRAINTS',privateNames:[...privateNames],protectedRelayNames:[...forbidden].filter(n=>!privateNames.has?.(n)&&![...privateNames].includes(n)),
    relayFunctions:[...relays.values()].map(({node,...r})=>r),observerCalls:sinks.length,grammarNodes:grammar.length,matchingChecks:checks,cyclesOverapproximated:cycles,
    unknownReasons:[...unknownReasons],unknownStringsRemainArbitrary:true,allObservedNamesExcluded:true,
    allUnknownStringInputsRefused:unknownReasons.size===0,entryBoundary:'Complete supplied sources and the existing explicit native name-consumer contract; other engine entry mechanisms remain separate.',wholeMapAcceptance:false};
}

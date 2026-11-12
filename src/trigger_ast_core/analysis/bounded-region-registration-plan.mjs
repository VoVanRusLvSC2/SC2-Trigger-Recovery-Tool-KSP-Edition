// Analysis only. Produces a resource-backed proposal, never a code rewrite or
// acceptance. Folding lookup guards additionally needs an independent engine
// contract for preplaced-name lookup, absent values and registration ordering.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K,forEachChild,isAssignmentOperator} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
import {readCanonicalInt32Literal} from '../types/inclusive-literal-int-comparison.mjs';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const un=n=>n?.kind===K.ParenthesizedExpression?un(n.expression):n;
const statements=n=>n?.kind===K.Block?[...n.statements]:n?[n]:[];
function walk(n,visit){if(!n)return;visit(n);forEachChild(n,c=>walk(c,visit));}
export function analyzeBoundedRegionRegistration({source,regionXml,declarations=[],nativeEvents=[]}){
 const parse=(text,name)=>{const a=new Parser().parseFile(name,text);assert.equal(a.parseDiagnostics.length,0,'REGION_PLAN_SOURCE_SYNTAX');return a;};
 const ast=parse(source,'map.galaxy'),all=[ast,...declarations.map((d,i)=>parse(typeof d==='string'?d:d.text,`dependency-${i}.galaxy`))];
 const functions=new Map(),globals=new Map();
 for(const a of all)for(const n of a.statements){const table=n.kind===K.FunctionDeclaration?functions:n.kind===K.VariableDeclaration?globals:undefined;if(table){const xs=table.get(n.name.name)??[];xs.push(n);table.set(n.name.name,xs);}}
 function native(name,signature){const ds=functions.get(name)??[];return !globals.has(name)&&ds.length>0&&ds.every(d=>!d.body&&d.modifiers?.length===1&&d.modifiers[0].kind===K.NativeKeyword&&getTypeName(d.type)===signature[0]&&JSON.stringify(d.parameters.map(p=>getTypeName(p.type)))===JSON.stringify(signature[1]));}
 const root=xmlTree(regionXml);assert.equal(root.tag,'Regions','REGION_PLAN_COMPONENT_ROOT');
 const names=new Map(),ids=new Set();
 for(const row of root.children){assert.equal(row.tag,'region','REGION_PLAN_UNKNOWN_ROOT_ENTRY');assert(row.attributes.id&&!ids.has(row.attributes.id),'REGION_PLAN_DUPLICATE_ID');ids.add(row.attributes.id);
  const ns=row.children.filter(c=>c.tag==='name');assert.equal(ns.length,1,'REGION_PLAN_NAME_NOT_UNIQUE');const name=ns[0].attributes.value;assert.equal(typeof name,'string');
  const xs=names.get(name)??[];xs.push(row.attributes.id);names.set(name,xs);
 }
 const folded=new Map();for(const [name,values]of names){const key=name.toLowerCase(),xs=folded.get(key)??[];xs.push(...values);folded.set(key,xs);}
 const result={kind:'BOUNDED_REGION_EVENT_REGISTRATION_PROPOSAL',sourceSha256:sha(source),regionsSha256:sha(regionXml),regionEntries:ids.size,records:[],refused:[],sourceOrCandidateChanged:false,wholeMapAccepted:false,engineLookupContractProved:false,caseFoldingIsDiagnosticOnly:true,codeRewriteAuthorized:false};
 if(!native('TriggerCreate',['trigger',['string']])||!native('RegionFromName',['region',['string']])||!native('IntToString',['string',['int']]))return {...result,abiRefusal:'REGION_PLAN_NATIVE_ABI_NOT_CLOSED'};
 const events=new Map(nativeEvents.map(e=>[e.name,e]));
 for(const fn of ast.statements){
  if(fn.kind!==K.FunctionDeclaration||!fn.body||fn.parameters.length||getTypeName(fn.type)!=='void')continue;
  const ss=[...fn.body.statements],locals=[];while(ss[0]?.kind===K.VariableDeclaration)locals.push(ss.shift());
  const create=ss[0]?.expression,call=un(create?.right),handle=un(create?.left)?.name;
  if(create?.kind!==K.BinaryExpression||create.operatorToken?.kind!==K.EqualsToken||call?.kind!==K.CallExpression||call.expression?.name!=='TriggerCreate'||call.arguments.length!==1||fn.name.name!==handle+'_Init')continue;
  const loops=ss.filter(s=>s.kind===K.ForStatement);if(!loops.length)continue;
  try{
   assert.equal((functions.get(fn.name.name)??[]).filter(f=>f.body).length,1,'REGION_PLAN_FUNCTION_OWNER');
   assert.equal(globals.get(handle)?.length,1,'REGION_PLAN_HANDLE_OWNER');assert.equal(getTypeName(globals.get(handle)[0].type),'trigger','REGION_PLAN_HANDLE_TYPE');
   assert(!locals.some(l=>l.name.name===handle),'REGION_PLAN_LOCAL_HANDLE_SHADOW');
   const proposed=[];
   for(const loop of loops){
    const init=un(loop.initializer),cond=un(loop.condition),step=un(loop.incrementor),counter=un(init?.left)?.name;
    assert(init?.kind===K.BinaryExpression&&init.operatorToken?.kind===K.EqualsToken&&counter,'REGION_PLAN_COUNTER_INIT');
    const ls=locals.filter(l=>l.name.name===counter);assert(ls.length===1&&!ls[0].initializer&&!ls[0].modifiers?.length&&getTypeName(ls[0].type)==='int','REGION_PLAN_COUNTER_OWNER');
    assert(cond?.kind===K.BinaryExpression&&un(cond.left)?.name===counter,'REGION_PLAN_COUNTER_CONDITION');
    assert(step?.kind===K.BinaryExpression&&un(step.left)?.name===counter&&[K.PlusEqualsToken,K.MinusEqualsToken].includes(step.operatorToken?.kind),'REGION_PLAN_COUNTER_STEP');
    const literals=[init.right,cond.right,step.right].map(n=>readCanonicalInt32Literal(un(n)));
    assert(literals.every(n=>n!==undefined),'REGION_PLAN_NONLITERAL_RANGE');
    const [start,bound,rawStep]=literals.map(Number);
    const delta=step.operatorToken.kind===K.MinusEqualsToken?-rawStep:rawStep;assert(delta!==0,'REGION_PLAN_ZERO_STEP');
    const cmp=cond.operatorToken.kind;assert([K.LessThanToken,K.LessThanEqualsToken,K.GreaterThanToken,K.GreaterThanEqualsToken].includes(cmp),'REGION_PLAN_COMPARISON');
    assert([K.LessThanToken,K.LessThanEqualsToken].includes(cmp)?delta>0:delta<0,'REGION_PLAN_RANGE_DIRECTION');
    const body=statements(loop.statement);assert(body.length===1&&body[0].kind===K.IfStatement&&!body[0].elseStatement,'REGION_PLAN_BODY_NOT_SINGLE_GUARD');
    const guard=un(body[0].expression);assert(guard?.kind===K.BinaryExpression&&guard.operatorToken?.kind===K.ExclamationEqualsToken&&un(guard.right)?.kind===K.NullKeyword,'REGION_PLAN_GUARD');
    const lookup=un(guard.left);assert(lookup?.kind===K.CallExpression&&lookup.expression?.name==='RegionFromName'&&lookup.arguments.length===1,'REGION_PLAN_LOOKUP');
    const actions=statements(body[0].thenStatement);assert(actions.length===1,'REGION_PLAN_GUARDED_ACTIONS');const event=un(actions[0].expression),effect=event?.expression?.name&&events.get(event.expression.name);
    assert(event?.kind===K.CallExpression&&effect?.signature?.returnType==='void'&&native(effect.name,['void',effect.signature.parameterTypes])&&event.arguments.length===effect.signature.parameterTypes.length&&un(event.arguments[0])?.name===handle,'REGION_PLAN_EVENT_ABI_OR_TARGET');
    assert(!locals.some(l=>['TriggerCreate','RegionFromName','IntToString',effect.name].includes(l.name.name)),'REGION_PLAN_LOCAL_API_SHADOW');
    const regions=effect.signature.parameterTypes.flatMap((t,i)=>t==='region'?[i]:[]);assert(regions.length===1,'REGION_PLAN_EVENT_REGION_ARITY');
    const eventRegion=un(event.arguments[regions[0]]);assert(eventRegion?.kind===K.CallExpression&&eventRegion.expression?.name==='RegionFromName'&&eventRegion.arguments.length===1,'REGION_PLAN_EVENT_REGION');
    let otherUse=false;walk(fn.body,n=>{if(n.kind===K.Identifier&&n.name===counter&&n!==ls[0].name&&!(n.pos>=loop.pos&&n.end<=loop.end))otherUse=true;});assert(!otherUse,'REGION_PLAN_COUNTER_ESCAPES');
    let counterWrite=false;walk(loop.statement,n=>{
     if(n.kind===K.BinaryExpression&&isAssignmentOperator(n.operatorToken?.kind)&&un(n.left)?.name===counter)counterWrite=true;
     if([K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(n.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(n.operator?.kind)&&un(n.operand)?.name===counter)counterWrite=true;
    });assert(!counterWrite,'REGION_PLAN_BODY_WRITES_COUNTER');
    function stringExpression(n){n=un(n);if(n?.kind===K.StringLiteral){const r=readStringLiteralValue(n.text);assert(r&&!r.needsPreset,'REGION_PLAN_OPAQUE_STRING');return ()=>r.value;}
     if(n?.kind===K.BinaryExpression&&n.operatorToken?.kind===K.PlusToken){const left=stringExpression(n.left),right=stringExpression(n.right);return value=>left(value)+right(value);}
     if(n?.kind===K.CallExpression&&n.expression?.name==='IntToString'&&n.arguments.length===1&&un(n.arguments[0])?.name===counter)return value=>String(value);
     throw Error('REGION_PLAN_NONCLOSED_STRING');
    }
    const guardName=stringExpression(lookup.arguments[0]),eventName=stringExpression(eventRegion.arguments[0]);
    const values=[];let value=start;
    const continues=v=>cmp===K.LessThanToken?v<bound:cmp===K.LessThanEqualsToken?v<=bound:cmp===K.GreaterThanToken?v>bound:v>=bound;
    while(continues(value)){assert(values.length<4096,'REGION_PLAN_RANGE_BOUND');const name=guardName(value);assert.equal(name,eventName(value),'REGION_PLAN_DIFFERENT_LOOKUPS');const exact=names.get(name)??[],fold=folded.get(name.toLowerCase())??[];
     values.push({counter:value,name,presence:exact.length===1&&fold.length===1?'EXACT_NAME_PRESENT':fold.length===0?'NO_CASEFOLDED_NAME':'AMBIGUOUS_NAME',regionId:exact.length===1&&fold.length===1?exact[0]:undefined});
     value+=delta;assert(Number.isSafeInteger(value)&&value>=-2147483648&&value<=2147483647,'REGION_PLAN_INT32_OVERFLOW');
    }
    proposed.push({start:loop.pos,end:loop.end,counter,from:start,bound,step:delta,event:effect.name,iterations:values,registrationOrderIsIterationOrder:true});
   }
   result.records.push({function:fn.name.name,handle,loops:proposed,requiresIndependentLookupAndAbsentValueContract:true});
  }catch(error){result.refused.push({function:fn.name.name,reason:String(error.message)});}
 }
 return result;
}

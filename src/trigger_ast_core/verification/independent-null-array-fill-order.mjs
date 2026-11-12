import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {openVerifiedSourceBindingProgram} from '../model/verified-source-binding-program.lexical-parameters.mjs';
import {startupNativeContracts,startupNativeEffectEvidence} from '../model/startup-native-effect-contracts.sound.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K,Printer,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const printer=new Printer(),un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const walk=(n,f)=>{f(n);forEachChild(n,c=>walk(c,f));},num=n=>un(n)?.kind===K.NumericLiteral&&/^\d+$/u.test(un(n).text)?Number(un(n).text):undefined;
const store=n=>n?.kind===K.ExpressionStatement&&n.expression?.kind===K.BinaryExpression&&n.expression.operatorToken?.kind===K.EqualsToken?n.expression:undefined;
const ignored=new Set(['parent','pos','end','line','char','syntaxTokens','comments','symbol','locals','flowNode','__sourceText']);
const shape=v=>!v||typeof v!=='object'?v:Array.isArray(v)?v.map(shape):Object.fromEntries(Object.entries(v).filter(([k,x])=>!ignored.has(k)&&x!==undefined).map(([k,x])=>[k,shape(x)]));

/** Preserve a complete bounded null fill, moving it only across unrelated
 * literal stores or exact non-callback/no-yield native constructors/queries.
 * Engine calls/handles are never evaluated, removed or reordered. The counter
 * must be private and unobserved outside this one loop. Unknown effects refuse. */
export function canonicalIndependentNullArrayFillOrder(source,context={}){
 const bound=openVerifiedSourceBindingProgram(source,context),records=[],refused=[];
 if(bound.reason)return{text:source,proof:{kind:'INDEPENDENT_COMPLETE_NULL_ARRAY_FILL_ORDER',records,reason:bound.reason}};
 const {program,ast}=bound,replacements=new Map(),allFunctions=new Map();
 try{
  for(const doc of program.documents.values())for(const n of doc.statements)if(n.kind===K.FunctionDeclaration){const ds=allFunctions.get(n.name.name)??[];ds.push(n);allFunctions.set(n.name.name,ds);}
  const declaration=n=>program.getBinding(n).status==='BOUND'?program.declarationAt(n):undefined;
  const same=(a,b)=>!!a?.name&&!!b?.name&&program.getBinding(a.name).status==='BOUND'&&program.getBinding(a.name).symbolId===program.getBinding(b.name).symbolId;
  const constant=(n,seen=new Set())=>{
   n=un(n);if([K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(n?.kind))return true;
   if(n?.kind!==K.Identifier)return false;const d=declaration(n);
   if(d?.kind!==K.VariableDeclaration||!d.modifiers?.some(m=>m.kind===K.ConstKeyword)||!d.initializer||seen.has(d))return false;
   return constant(d.initializer,new Set([...seen,d]));
  };
  const safeCall=n=>{
   n=un(n);if(n?.kind!==K.CallExpression||n.expression.kind!==K.Identifier||n.arguments.length)return false;
   const ds=allFunctions.get(n.expression.name)??[],contract=startupNativeContracts[n.expression.name];
   if(!contract||contract[1].length||!declaration(n.expression)||!ds.length)return false;
   return ds.every(d=>!d.body&&d.modifiers?.length===1&&d.modifiers[0].kind===K.NativeKeyword&&
    printer.printNode(d.type)===contract[0]&&d.parameters.length===0);
  };
  for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
   const body=fn.body.statements;let prefix=0;while(body[prefix]?.kind===K.VariableDeclaration)prefix++;
   const tail=body.slice(prefix),loops=tail.filter(n=>n.kind===K.ForStatement);
   if(loops.length!==1||tail.at(-1)===loops[0])continue;
   const loop=loops[0],init=un(loop.initializer),condition=un(loop.condition),step=un(loop.incrementor);
   const stores=loop.statement?.kind===K.Block?loop.statement.statements:[loop.statement],a=stores.length===1?store(stores[0]):undefined;
   if(init?.kind!==K.BinaryExpression||init.operatorToken?.kind!==K.EqualsToken||init.left.kind!==K.Identifier||num(init.right)!==0||
    condition?.kind!==K.BinaryExpression||un(condition.left)?.kind!==K.Identifier||num(condition.right)===undefined||
    step?.kind!==K.BinaryExpression||step.operatorToken?.kind!==K.PlusEqualsToken||step.left.kind!==K.Identifier||num(step.right)!==1||
    a?.left?.kind!==K.ElementAccessExpression||a.left.expression.kind!==K.Identifier||un(a.right)?.kind!==K.NullKeyword||a.left.argumentExpression.kind!==K.Identifier)continue;
   const counter=body.slice(0,prefix).find(n=>same(n,declaration(init.left))),array=ast.statements.find(n=>n.kind===K.VariableDeclaration&&same(n,declaration(a.left.expression))),size=array?.type?.kind===K.ArrayType?num(array.type.size):undefined;
   if(!counter||counter.kind!==K.VariableDeclaration||counter.type.kind!==K.IntKeyword||counter.initializer||counter.modifiers?.length||!body.slice(0,prefix).includes(counter)||
    !array||!ast.statements.includes(array)||array.type.elementType.kind!==K.StringKeyword||array.modifiers?.length||array.initializer||!Number.isSafeInteger(size)||size<1||size>65536||
    ![condition.left,step.left,a.left.argumentExpression].every(n=>same(declaration(un(n)),counter))||
    !(condition.operatorToken.kind===K.LessThanToken&&num(condition.right)===size||condition.operatorToken.kind===K.LessThanEqualsToken&&num(condition.right)===size-1))continue;
   const reason=message=>refused.push({function:fn.name.name,array:array.name.name,reason:message});
   let escaped=false;walk(fn.body,n=>{if(n.kind===K.Identifier&&same(declaration(n),counter)&&n!==counter.name&&!(n.pos>=loop.pos&&n.end<=loop.end))escaped=true;});
   if(escaped){reason('COUNTER_USED_OUTSIDE_COMPLETE_FILL');continue;}
   const others=tail.filter(n=>n!==loop);let blocked=false;
   for(const n of others){const assignment=store(n),target=assignment?.left?.kind===K.Identifier?declaration(assignment.left):undefined;
    if(!target||target.kind!==K.VariableDeclaration||!ast.statements.some(n=>n.kind===K.VariableDeclaration&&same(n,target))||same(target,array)||target.modifiers?.length||target.type.kind===K.ArrayType||
     !(constant(assignment.right)||safeCall(assignment.right))){blocked=true;break;}
   }
   if(blocked){reason('UNKNOWN_EFFECT_OR_DEPENDENT_STORE');continue;}
   replacements.set(fn,{...fn,body:{...fn.body,statements:[...body.slice(0,prefix),...others,loop]}});
   records.push({function:fn.name.name,array:array.name.name,counter:counter.name.name,size,fullFillRetained:true,
    nativeCallsInSameOrder:others.filter(n=>un(store(n).right).kind===K.CallExpression).map(n=>un(store(n).right).expression.name),
    counterPrivateToLoop:true,noCallbackOrYieldAcrossFill:true,defaultsAssumed:false});
  }
  const expected=ast.statements.map(n=>replacements.get(n)??n),text=printer.printFile({...ast,statements:expected}),next=parse(text,'independent-fill-view');
  assert.equal(next.parseDiagnostics.length,0);assert(isDeepStrictEqual(shape(next.statements),shape(expected)),'ARRAY_FILL_UNPLANNED_AST_CHANGE');
  return{text,proof:{kind:'INDEPENDENT_COMPLETE_NULL_ARRAY_FILL_ORDER',records,refused,nativeEffectEvidence:startupNativeEffectEvidence,
   sourceOrExportChanged:false,defaultsAssumed:false,entireFillAndEngineCallOrderRetained:true,wholeProgramOracleStillRequired:true,passGranted:false}};
 }finally{bound.dispose();}
}

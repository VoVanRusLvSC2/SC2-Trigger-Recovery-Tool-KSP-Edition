// Eliminate a private integer capture only after proving its complete lifetime.
// No default values, loop semantics, engine calls or source names are guessed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openVerifiedSourceBindingProgram} from '../model/verified-source-binding-program.lexical-parameters.mjs';
import {evaluateClosedInt32} from '../model/closed-int32-expression.mjs';
import {inspectNamedStorageObservers} from '../analysis/named-storage-observers.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {expressionGroupingShape as shape} from './expression-grouping-proof.typedef-terminators.mjs';
import {projectedExpressionGroupingShape} from './projected-expression-grouping-shape.mjs';
import {SyntaxKind as K,Printer,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer(),un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const writes=new Set(['EqualsToken','PlusEqualsToken','MinusEqualsToken','AsteriskEqualsToken','SlashEqualsToken','PercentEqualsToken','LessThanLessThanEqualsToken','GreaterThanGreaterThanEqualsToken','AmpersandEqualsToken','BarEqualsToken','CaretEqualsToken'].map(k=>K[k]));
function walk(n,f,seen=new WeakSet()){if(!n||seen.has(n))return;seen.add(n);f(n);forEachChild(n,c=>walk(c,f,seen));if(n.kind===K.ArrayType&&n.size)walk(n.size,f,seen);}
function written(ref){let n=ref;while(n.parent?.kind===K.ParenthesizedExpression)n=n.parent;const p=n.parent;
 if(p?.kind===K.BinaryExpression&&un(p.left)===ref&&writes.has(p.operatorToken.kind))return p;
 if([K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(p?.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(p.operator?.kind??p.operator))return p;
}

export function canonicalClosedLiteralLoopSnapshots(source,context={}){
 const proof={kind:'CLOSED_LITERAL_INTEGER_LOOP_SNAPSHOTS',sourceSha256:sha(source),records:[],refused:[],sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false};
 const bound=openVerifiedSourceBindingProgram(source,context);if(bound.reason)return {text:source,proof:{...proof,reason:bound.reason,viewSha256:sha(source)}};
 const {program,ast,referenceFacts}=bound,removed=new Set(),replaced=new Map(),edits=[],selected=[];
 try{
  for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
   const declarations=[],loops=[];walk(fn.body,n=>{if(n.kind===K.VariableDeclaration)declarations.push(n);if(n.kind===K.ForStatement)loops.push(n);});
   if(new Set([...fn.parameters,...declarations].map(n=>n.name.name)).size!==fn.parameters.length+declarations.length)continue;
   for(const local of fn.body.statements.filter(n=>n.kind===K.VariableDeclaration&&n.type.kind===K.IntKeyword&&!n.isReference)){
    const constant=local.modifiers?.length===1&&local.modifiers[0].kind===K.ConstKeyword;
    if(!constant&&(local.initializer||local.modifiers?.length))continue;
    const binding=program.getBinding(local.name);if(binding.status!=='BOUND')continue;
    const refs=[];walk(fn.body,n=>{if(n.kind===K.Identifier&&n!==local.name&&!(n.parent?.kind===K.PropertyAccessExpression&&n.parent.name===n)&&program.getBinding(n).symbolId===binding.symbolId)refs.push(n);});
    if(!refs.length)continue;
    const stores=refs.filter(written);let store,literal=constant?local.initializer:undefined;
    if(constant){if(stores.length)continue;}
    else{
     if(stores.length!==1)continue;const expr=written(stores[0]);
     if(expr.kind!==K.BinaryExpression||expr.operatorToken.kind!==K.EqualsToken||un(expr.left)!==stores[0]||expr.parent?.kind!==K.ExpressionStatement)continue;
     store=expr.parent;literal=expr.right;
    }
    const value=literal&&evaluateClosedInt32(literal);if(value===undefined)continue;
    const reads=refs.filter(n=>!stores.includes(n));if(!reads.length)continue;
    const containing=loops.filter(loop=>reads.every(n=>n.pos>=loop.pos&&n.end<=loop.end));
    const inner=containing.filter(loop=>!containing.some(other=>other!==loop&&other.pos>=loop.pos&&other.end<=loop.end));if(inner.length!==1)continue;
    const loop=inner[0];let failure;
    if(constant){if(local.end>loop.pos)failure='CONSTANT_DECLARATION_DOES_NOT_DOMINATE_LOOP';}
    else{
     const block=loop.parent;if(block?.kind!==K.Block||store.parent!==block)failure='RESET_AND_LOOP_ARE_NOT_SIBLINGS';
     else{let at=block.statements.indexOf(loop)-1;while(block.statements[at]?.kind===K.EmptyStatement)at--;if(block.statements[at]!==store)failure='RESET_NOT_IMMEDIATELY_BEFORE_LOOP';}
    }
    const calls=[];for(const ref of reads){const fact=referenceFacts(ref,fn.body);if(fact.reason)failure=fact.reason;calls.push(...fact.facts??[]);}
    if(failure){proof.refused.push({function:fn.name.name,name:local.name.name,reason:failure});continue;}
    const text=value.toString(),node=parse('void Snapshot(){int v='+text+';}','snapshot-literal').statements[0].body.statements[0].initializer;
    selected.push({fn,local,store,reads,loop,value:text,node,calls,symbolId:binding.symbolId});
   }
  }
  if(selected.length){
   const observed=inspectNamedStorageObservers(source,[...new Set(selected.flatMap(r=>[r.fn.name.name,r.local.name.name]))],{externalSources:[...(context.ownedSources??[]),...(context.externalSources??[])]});
   for(const row of selected){
    const names=new Set([row.fn.name.name,row.local.name.name].map(n=>n.toLowerCase()));
    if(observed.unknownObserverInput||observed.observedNames.some(n=>names.has(n.toLowerCase()))){proof.refused.push({function:row.fn.name.name,name:row.local.name.name,reason:'NAMED_STORAGE_OBSERVER'});continue;}
    removed.add(row.local);if(row.store)removed.add(row.store);
    for(const ref of row.reads){assert.equal(source.slice(ref.pos,ref.end),ref.name,'SNAPSHOT_REFERENCE_RANGE');replaced.set(ref,row.node);edits.push({start:ref.pos,end:ref.end,before:ref.name,replacement:'('+printer.printNode(row.node)+')'});}
    proof.records.push({function:row.fn.name.name,name:row.local.name.name,symbolId:row.symbolId,value:row.value,type:'int',sourceConstant:!row.store,
     declaration:{start:row.local.pos,end:row.local.end},reset:row.store&&{start:row.store.pos,end:row.store.end},loop:{start:row.loop.pos,end:row.loop.end},reads:row.reads.map(r=>({start:r.pos,end:r.end})),
     allReferencesExhausted:true,resetDominatesAllReads:true,noEscapingReference:true,byValueCalls:row.calls,noDefaultValueAssumption:true,loopOperationsUnchanged:true});
   }
   proof.storageObservers=observed;
  }
  for(const n of removed)edits.push({start:n.pos,end:n.end,before:source.slice(n.pos,n.end),replacement:''});
  const applied=applyReversibleSourceEdits(source,edits),output=parse(applied.text,'closed-literal-snapshot-view');assert.equal(output.parseDiagnostics.length,0);
  const expected=projectedExpressionGroupingShape(ast,n=>{if(replaced.has(n))return replaced.get(n);return n.kind===K.Block?{...n,statements:n.statements.filter(s=>!removed.has(s))}:n;});
  assert.deepEqual(shape(output),expected,'LITERAL_SNAPSHOT_CHANGED_UNPLANNED_AST');
  return {text:applied.text,proof:{...proof,viewSha256:sha(applied.text),closure:bound.closure,edits:applied.proof.edits,byteInverseVerified:applied.proof.byteInverseVerified,exactPlannedStructureVerified:true,persistentCache:false}};
 }finally{bound.dispose();}
}

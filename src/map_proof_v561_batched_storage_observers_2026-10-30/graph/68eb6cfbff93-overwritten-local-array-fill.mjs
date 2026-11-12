import assert from 'node:assert/strict';
import {openVerifiedSourceBindingProgram} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/verified-source-binding-program.lexical-parameters.mjs';
import {evaluateClosedInt32} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/closed-int32-expression.mjs';
import {isPassiveFixedIntrinsicArrayDeclaration,isIntrinsicScalarType} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/passive-function-entry-storage.mjs';
import {inspectNamedStorageObservers} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/analysis/named-storage-observers.mjs';
import {applyReversibleSourceEdits} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/reversible-source-edits.linear.mjs';
import {parseImmutableGalaxySyntax as parse} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const walk=(n,fn)=>{if(!n)return;fn(n);forEachChild(n,c=>walk(c,fn));};
const numeric=n=>n<0n?{kind:K.PrefixUnaryExpression,operator:{kind:K.MinusToken},operand:{kind:K.NumericLiteral,text:String(-n)}}:{kind:K.NumericLiteral,text:String(n)};
const fail=reason=>{throw Error(reason);};
const assignments=new Set(['EqualsToken','PlusEqualsToken','MinusEqualsToken','AsteriskEqualsToken','SlashEqualsToken','PercentEqualsToken','LessThanLessThanEqualsToken','GreaterThanGreaterThanEqualsToken','AmpersandEqualsToken','BarEqualsToken','CaretEqualsToken'].map(name=>K[name]));

// A bounded must-write analysis of private fixed arrays. The removed null fill
// is never used as a default: every subsequently read cell must first receive
// an ordinary assignment on every path. Unknown loops/indices/escapes refuse.
// Only comparison views change, and the complete program oracle is still due.
export function canonicalOverwrittenLocalInitializations(source,context={}){
 const bound=openVerifiedSourceBindingProgram(source,context),records=[],refused=[],edits=[];
 if(bound.reason)return {text:source,proof:{kind:'OVERWRITTEN_PRIVATE_ARRAY_FILL',records,reason:bound.reason}};
 const {program,ast}=bound;
 // Batch one exact observer query for the union of candidate names. The ABI,
 // unknown-input veto and case-folded per-function decision stay unchanged.
 let storageObservers;
 const storageObservation=()=>{
  if(storageObservers)return storageObservers;
  const names=new Set();
  for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
   names.add(fn.name.name);walk(fn.body,n=>{if(n.kind===K.VariableDeclaration)names.add(n.name.name);});
  }
  storageObservers=inspectNamedStorageObservers(source,[...names],{externalSources:[...(context.ownedSources??[]),...(context.externalSources??[])]});
  return storageObservers;
 };
 try{
  for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
   const body=fn.body.statements,locals=[];walk(fn.body,n=>{if(n.kind===K.VariableDeclaration)locals.push(n);});
   if(new Set([...fn.parameters,...locals].map(n=>n.name.name)).size!==fn.parameters.length+locals.length)continue;
   const localIds=new Map(locals.map(n=>[n.name.name,program.getBinding(n.name).symbolId]));
   let escapedLocal=false;walk(fn.body,n=>{if(n.kind===K.Identifier&&localIds.has(n.name)&&n!==locals.find(d=>d.name.name===n.name)?.name&&bound.referenceFacts(n,fn).reason)escapedLocal=true;});
   if(escapedLocal)continue;
   for(const array of body.filter(n=>n.kind===K.VariableDeclaration&&!n.initializer&&!n.modifiers?.length&&(isIntrinsicScalarType(n.type)||isPassiveFixedIntrinsicArrayDeclaration(n)&&n.type.elementType.kind!==K.ArrayType))){
    const scalar=isIntrinsicScalarType(array.type),size=scalar?1n:evaluateClosedInt32(array.type.size);if(size===undefined||size>4096n)continue;
    const symbol=program.getBinding(array.name);if(symbol.status!=='BOUND')continue;
    const isArray=n=>n?.kind===K.Identifier&&program.getBinding(n).symbolId===symbol.symbolId;
    const refs=[];walk(fn.body,n=>{if(isArray(n)&&n!==array.name)refs.push(n);});
    if(refs.some(n=>!scalar&&(n.parent?.kind!==K.ElementAccessExpression||n.parent.expression!==n)||bound.referenceFacts(n,fn).reason))continue;
    const literal=n=>[K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(un(n)?.kind)||evaluateClosedInt32(n)!==undefined;
    const fill=scalar?body.find(n=>n.kind===K.ExpressionStatement&&un(n.expression)?.kind===K.BinaryExpression&&un(n.expression).operatorToken.kind===K.EqualsToken&&isArray(un(n.expression).left)&&literal(un(n.expression).right)):body.find(n=>n.kind===K.ForStatement&&n.statement?.kind===K.Block&&n.statement.statements.length===1&&
     n.statement.statements[0].kind===K.ExpressionStatement&&un(n.statement.statements[0].expression)?.kind===K.BinaryExpression&&
     un(n.statement.statements[0].expression).operatorToken.kind===K.EqualsToken&&
     un(n.statement.statements[0].expression).left.kind===K.ElementAccessExpression&&isArray(un(n.statement.statements[0].expression).left.expression)&&
     un(un(n.statement.statements[0].expression).right)?.kind===K.NullKeyword);
    if(!fill)continue;
    const counter=scalar?undefined:un(fill.initializer)?.left;
    if(!scalar&&(counter?.kind!==K.Identifier||!localIds.has(counter.name)))continue;
    const counterDecl=scalar?undefined:locals.find(n=>n.name.name===counter.name);
    if(!scalar&&(!body.includes(counterDecl)||counterDecl.type.kind!==K.IntKeyword||counterDecl.initializer||counterDecl.modifiers?.length))continue;
    const counterRefs=[];if(!scalar)walk(fn.body,n=>{if(n.kind===K.Identifier&&program.getBinding(n).symbolId===localIds.get(counter.name)&&n!==counterDecl.name)counterRefs.push(n);});
    if(counterRefs.some(n=>n.pos<fill.pos||n.end>fill.end))continue;
    if(refs.some(n=>n.pos<fill.pos))continue;
    const observed=storageObservation(),requested=new Set([fn.name.name,...localIds.keys()].map(name=>name.toLowerCase()));
    if(observed.unknownObserverInput||observed.observedNames.some(name=>requested.has(name.toLowerCase())))continue;
    const state={env:new Map(),written:new Set(),reads:0,steps:0};
    function value(expr,s){
     expr=un(expr);if(!expr)return;
     if(expr.kind===K.Identifier)return s.env.get(localIds.get(expr.name));
     if(expr.kind===K.TrueKeyword)return true;if(expr.kind===K.FalseKeyword)return false;
     if(expr.kind===K.PrefixUnaryExpression){const a=value(expr.operand,s);if(expr.operator.kind===K.ExclamationToken)return typeof a==='boolean'?!a:undefined;
      return typeof a==='bigint'?evaluateClosedInt32({...expr,operand:numeric(a)}):undefined;}
     if(expr.kind!==K.BinaryExpression)return evaluateClosedInt32(expr);
     const a=value(expr.left,s),b=value(expr.right,s),op=expr.operatorToken.kind;
     if(op===K.AmpersandAmpersandToken){if(a===false||b===false)return false;return a===true&&b===true?true:undefined;}
     if(op===K.BarBarToken){if(a===true||b===true)return true;return a===false&&b===false?false:undefined;}
     if(a===undefined||b===undefined)return;
     if(op===K.EqualsEqualsToken)return a===b;if(op===K.ExclamationEqualsToken)return a!==b;
     if(typeof a!=='bigint'||typeof b!=='bigint')return;
     if(op===K.LessThanToken)return a<b;if(op===K.LessThanEqualsToken)return a<=b;
     if(op===K.GreaterThanToken)return a>b;if(op===K.GreaterThanEqualsToken)return a>=b;
     return evaluateClosedInt32({...expr,left:numeric(a),right:numeric(b)});
    }
    function index(access,s){const i=value(access.argumentExpression,s);if(typeof i!=='bigint'||i<0n||i>=size)fail('ARRAY_INDEX_NOT_CLOSED_IN_BOUNDS');return Number(i);}
    function expression(expr,s,fillMode=false,allowWrite=false){
     expr=un(expr);if(!expr)return;
     if(scalar&&isArray(expr)){if(!s.written.has(0))fail('SCALAR_READ_BEFORE_OVERWRITE');s.reads++;return;}
     if(expr.kind===K.BinaryExpression&&assignments.has(expr.operatorToken.kind)&&!allowWrite)fail('ARRAY_FLOW_NESTED_WRITE');
     if([K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(expr.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(expr.operator?.kind))fail('ARRAY_FLOW_INCREMENT_NOT_MODELLED');
     if(expr.kind===K.BinaryExpression&&[K.AmpersandAmpersandToken,K.BarBarToken].includes(expr.operatorToken.kind)){
      let conditionalWrite=false;walk(expr.right,n=>{if(n.kind===K.BinaryExpression&&assignments.has(n.operatorToken.kind))conditionalWrite=true;});
      if(conditionalWrite)fail('ARRAY_FLOW_SHORT_CIRCUIT_WRITE');
     }
     if(expr.kind===K.BinaryExpression&&assignments.has(expr.operatorToken.kind)&&![K.EqualsToken,K.PlusEqualsToken,K.MinusEqualsToken].includes(expr.operatorToken.kind))fail('ARRAY_FLOW_COMPOUND_WRITE_NOT_MODELLED');
     if(expr.kind===K.BinaryExpression&&[K.EqualsToken,K.PlusEqualsToken,K.MinusEqualsToken].includes(expr.operatorToken.kind)){
      const lhs=un(expr.left);expression(expr.right,s,fillMode);
      if(scalar&&isArray(lhs)){
       if(expr.operatorToken.kind!==K.EqualsToken&&!s.written.has(0))fail('SCALAR_READ_BEFORE_OVERWRITE');
       if(expr.operatorToken.kind!==K.EqualsToken)s.env.delete(symbol.symbolId);else s.env.set(symbol.symbolId,value(expr.right,s));s.written.add(0);return;
      }
      if(lhs.kind===K.ElementAccessExpression&&isArray(lhs.expression)){
       const cell=index(lhs,s);if(expr.operatorToken.kind!==K.EqualsToken&&!s.written.has(cell))fail('ARRAY_READ_BEFORE_OVERWRITE');
       if(fillMode)assert.equal(un(expr.right).kind,K.NullKeyword);s.written.add(cell);return;
      }
      if(lhs.kind===K.Identifier&&localIds.has(lhs.name)){
       let v=value(expr.right,s),id=localIds.get(lhs.name);
       if(expr.operatorToken.kind!==K.EqualsToken){const old=s.env.get(id);v=typeof old==='bigint'&&typeof v==='bigint'?evaluateClosedInt32({kind:K.BinaryExpression,left:numeric(old),right:numeric(v),operatorToken:{kind:expr.operatorToken.kind===K.PlusEqualsToken?K.PlusToken:K.MinusToken}}):undefined;}
       s.env.set(id,v);return;
      }
      expression(lhs,s,fillMode);return;
     }
     if(expr.kind===K.ElementAccessExpression&&isArray(expr.expression)){
      if(!s.written.has(index(expr,s)))fail('ARRAY_READ_BEFORE_OVERWRITE');s.reads++;return;
     }
     forEachChild(expr,c=>expression(c,s,fillMode));
    }
    const copy=s=>({...s,env:new Map(s.env),written:new Set(s.written)});
    function statement(n,s,fillMode=false){
     if(++s.steps>32768)fail('ARRAY_FLOW_STEP_BOUND');if(!n)return 'next';
     if(n.kind===K.Block){for(const item of n.statements){const flow=statement(item,s,fillMode);if(flow!=='next')return flow;}return 'next';}
     if(n.kind===K.VariableDeclaration){expression(n.initializer,s);if(localIds.has(n.name.name))s.env.set(localIds.get(n.name.name),value(n.initializer,s));return 'next';}
     if(n.kind===K.ExpressionStatement){expression(n.expression,s,fillMode,true);return 'next';}
     if(n.kind===K.ReturnStatement){expression(n.expression,s);return 'return';}
     if(n.kind===K.BreakStatement)return 'break';if(n.kind===K.ContinueStatement)return 'continue';
     if(n.kind===K.IfStatement){expression(n.expression,s);const v=value(n.expression,s);if(v===true||v===false)return statement(v?n.thenStatement:n.elseStatement,s,fillMode);
      const a=copy(s),b=copy(s),fa=statement(n.thenStatement,a,fillMode),fb=statement(n.elseStatement,b,fillMode);
      if(fa!==fb)fail('ARRAY_FLOW_UNEQUAL_DYNAMIC_TRANSFER');s.written=new Set([...a.written].filter(i=>b.written.has(i)));
      s.env=new Map([...a.env].map(([id,v])=>[id,v===b.env.get(id)?v:undefined]));s.reads=Math.max(a.reads,b.reads);s.steps=Math.max(a.steps,b.steps);return fa;
     }
     if([K.ForStatement,K.WhileStatement].includes(n.kind)){
      if(n.kind===K.ForStatement)expression(n.initializer,s,fillMode,true);
      const condition=n.kind===K.ForStatement?n.condition:n.expression;
      for(let iteration=0;iteration<=4096;iteration++){
       expression(condition,s,fillMode);const v=value(condition,s);if(v===false)return 'next';if(v!==true)fail('ARRAY_FLOW_DYNAMIC_LOOP');if(iteration===4096)fail('ARRAY_FLOW_ITERATION_BOUND');
       const flow=statement(n.statement,s,fillMode);if(flow==='return')return flow;if(flow==='break')return 'next';
       if(n.kind===K.ForStatement)expression(n.incrementor,s,fillMode,true);
      }
     }
     // Refuse unmodelled control rather than assuming its path is harmless.
     fail('ARRAY_FLOW_UNSUPPORTED_CONTROL');
    }
    try{
     if(!scalar){const probe=copy(state);statement(fill,probe,true);assert.equal(probe.written.size,Number(size),'ARRAY_FILL_NOT_COMPLETE');}
     for(const n of body.slice(0,body.indexOf(fill)))statement(n,state);
     for(const n of body.slice(body.indexOf(fill)+1)){const flow=statement(n,state);if(flow==='return')break;assert.equal(flow,'next');}
     for(const n of [fill,...(counterDecl?[counterDecl]:[])]){
      let end=n.end;if(n===counterDecl){const semis=(n.syntaxTokens??[]).filter(t=>t.kind===K.SemicolonToken);assert.equal(semis.length,1);end=semis[0].pos+1;}
      edits.push({start:n.pos,end,before:source.slice(n.pos,end),replacement:''});
     }
     records.push({function:fn.name.name,variable:array.name.name,storage:scalar?'scalar':'fixed-array',cells:Number(size),observedReads:state.reads,steps:state.steps,defaultsAssumed:false,counterUnusedOutsideFill:!scalar});
    }catch(error){refused.push({function:fn.name.name,array:array.name.name,reason:error.message});}
   }
  }
  const applied=applyReversibleSourceEdits(source,edits);
  assert.equal(parse(applied.text,'overwritten-array-proof-view').parseDiagnostics.length,0,'ARRAY_FILL_VIEW_SYNTAX');
  return {text:applied.text,proof:{kind:'OVERWRITTEN_PRIVATE_ARRAY_FILL',records,refused,edits:applied.proof,observerAnalysis:storageObservers?{queries:1,proof:storageObservers}:undefined,defaultsAssumed:false,sourceOrExportChanged:false,wholeProgramOracleStillRequired:true,passGranted:false}};
 }finally{bound.dispose();}
}
export const canonicalOverwrittenLocalArrayFill=canonicalOverwrittenLocalInitializations;

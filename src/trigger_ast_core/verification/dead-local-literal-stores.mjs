import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import {openVerifiedSourceBindingProgram} from '../model/verified-source-binding-program.lexical-parameters.mjs';
import {isIntrinsicScalarType} from '../model/passive-function-entry-storage.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {inspectNamedStorageObservers} from '../analysis/named-storage-observers.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const walk=(n,f)=>{f(n);forEachChild(n,c=>walk(c,f));};
const literal=n=>{n=un(n);return [K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(n?.kind)||
 n?.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(n.operator?.kind)&&n.operand?.kind===K.NumericLiteral;};
const assignment=n=>n?.kind===K.BinaryExpression&&n.operatorToken?.kind===K.EqualsToken&&n.left?.kind===K.Identifier?n:undefined;
const ignored=new Set(['parent','pos','end','line','char','syntaxTokens','comments','symbol','locals','flowNode','__sourceText']);
const shape=v=>!v||typeof v!=='object'?v:Array.isArray(v)?v.map(shape):Object.fromEntries(Object.entries(v).filter(([k,x])=>!ignored.has(k)&&x!==undefined).map(([k,x])=>[k,shape(x)]));

/** Dead literal stores to private scalar cells. No VM-default assumption:
 * remove a store only if no read/escape can precede a dominating overwrite, or
 * the cell is never used again. No calls, array stores or globals are removed.
 * This produces only a proof view; the entire unchanged oracle must still pass. */
export function canonicalDeadLocalLiteralStores(source,context={}){
 const bound=openVerifiedSourceBindingProgram(source,context),records=[],refused=[];
 if(bound.reason)return{text:source,proof:{kind:'BOUND_DEAD_LOCAL_LITERAL_STORES',reason:bound.reason,records}};
 const {program,ast}=bound,dropped=new Set(),names=new Set(),edits=[];
 try{
  for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
   const all=[];walk(fn.body,n=>{if(n.kind===K.VariableDeclaration)all.push(n);});
   const occupied=[...fn.parameters,...all].map(n=>n.name.name);
   if(new Set(occupied).size!==occupied.length){refused.push({function:fn.name.name,reason:'AMBIGUOUS_LOCAL_SCOPE'});continue;}
   const body=fn.body.statements,locals=new Map();
   for(const n of body){if(n.kind!==K.VariableDeclaration)break;
    if(n.initializer||n.modifiers?.length||!isIntrinsicScalarType(n.type))continue;
    const b=program.getBinding(n.name);if(b.status==='BOUND')locals.set(b.symbolId,{node:n,refs:[]});
   }
   walk(fn.body,n=>{
    if(n.kind!==K.Identifier||n.parent?.kind===K.PropertyAccessExpression&&n.parent.name===n)return;
    const b=program.getBinding(n),local=locals.get(b.symbolId);if(local&&n!==local.node.name)local.refs.push(n);
   });
   for(const local of locals.values()){
    const refs=local.refs.sort((a,b)=>a.pos-b.pos);
    const escapes=refs.map(ref=>bound.referenceFacts(ref,fn)).find(r=>r.reason);
    if(escapes){refused.push({function:fn.name.name,variable:local.node.name.name,reason:escapes.reason});continue;}
    for(const statement of body){
     const a=statement.kind===K.ExpressionStatement?assignment(statement.expression):undefined;
     if(!a||!literal(a.right)||program.getBinding(a.left).symbolId!==program.getBinding(local.node.name).symbolId)continue;
     const next=refs.find(n=>n.pos>a.left.pos);
     let reason='NO_SUBSEQUENT_REFERENCE';
     if(next){
      const write=assignment(next.parent);
      if(!write||write.left!==next)continue;
      const top=body.find(n=>n.pos<=write.pos&&n.end>=write.end);
      if(!(top?.kind===K.ExpressionStatement&&top.expression===write||top?.kind===K.ForStatement&&top.initializer===write))continue;
      let reads=false;walk(write.right,n=>{if(n.kind===K.Identifier&&program.getBinding(n).symbolId===program.getBinding(local.node.name).symbolId)reads=true;});
      if(reads)continue;reason='NEXT_REFERENCE_IS_DOMINATING_PLAIN_OVERWRITE';
     }
     dropped.add(statement);names.add(fn.name.name);names.add(local.node.name.name);
     records.push({function:fn.name.name,variable:local.node.name.name,start:statement.pos,reason,
      privateBoundScalar:true,initializerEffectsAbsent:true,defaultsAssumed:false,callAndControlOrderPreserved:true});
    }
    if(refs.every(ref=>body.some(s=>dropped.has(s)&&s.expression?.left===ref))){
     dropped.add(local.node);names.add(fn.name.name);names.add(local.node.name.name);
     records.push({function:fn.name.name,variable:local.node.name.name,start:local.node.pos,reason:'UNREFERENCED_PASSIVE_LOCAL_STORAGE'});
    }
   }
  }
  const observers=inspectNamedStorageObservers(source,[...names],{externalSources:[...(context.ownedSources??[]),...(context.externalSources??[])]});
  assert(!observers.unknownObserverInput&&!observers.observedNames.length,'DEAD_LOCAL_NAMED_STORAGE_OBSERVER');
  for(const node of dropped){
   const ends=(node.syntaxTokens??[]).filter(t=>t.kind===K.SemicolonToken);
   assert.equal(ends.length,1,'DEAD_LOCAL_STATEMENT_BOUNDARY');const end=ends[0].pos+1;
   assert.equal(source[end-1],';');edits.push({start:node.pos,end,before:source.slice(node.pos,end),replacement:''});
  }
  const applied=applyReversibleSourceEdits(source,edits),next=parse(applied.text,'dead-local-proof-view');assert.equal(next.parseDiagnostics.length,0);
  const expected=ast.statements.map(fn=>fn.kind===K.FunctionDeclaration&&fn.body?{...fn,body:{...fn.body,statements:fn.body.statements.filter(s=>!dropped.has(s))}}:fn);
  assert(isDeepStrictEqual(shape(next.statements),shape(expected)),'DEAD_LOCAL_UNPLANNED_AST_CHANGE');
  return{text:applied.text,proof:{kind:'BOUND_DEAD_LOCAL_LITERAL_STORES',records,refused,observers,edits:applied.proof,
   sourceOrExportChanged:false,defaultsAssumed:false,wholeProgramOracleStillRequired:true,passGranted:false}};
 }finally{bound.dispose();}
}

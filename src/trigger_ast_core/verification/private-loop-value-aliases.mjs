import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openVerifiedSourceBindingProgram} from '../model/verified-source-binding-program.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {readCanonicalInt32Literal} from '../types/inclusive-literal-int-comparison.mjs';
import {expressionGroupingShape as shape} from './expression-grouping-proof.typedef-terminators.mjs';
import {SyntaxKind as K,forEachChild,isAssignmentOperator} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const groups=new Set([K.UnitgroupKeyword,K.PlayergroupKeyword]),loops=new Set([K.WhileStatement,K.ForStatement,K.DoStatement]);
function walk(n,f){f(n);forEachChild(n,c=>walk(c,f));}
const inside=(n,a,b)=>n.pos>=a&&n.end<=b;
const assignment=s=>{const e=un(s.kind===K.ExpressionStatement?s.expression:undefined);return e?.kind===K.BinaryExpression&&e.operatorToken.kind===K.EqualsToken&&un(e.left)?.kind===K.Identifier?e:undefined;};
function directWrite(ref){let n=ref;while(n.parent?.kind===K.ParenthesizedExpression)n=n.parent;const p=n.parent;
  return p?.kind===K.BinaryExpression&&isAssignmentOperator(p.operatorToken.kind)&&un(p.left)===ref||
    [K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(p?.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(p.operator?.kind);
}

// A loop's private group snapshot may be read through its stable LOCAL source
// cell: all target uses follow the copy, the source cannot be reassigned or
// exposed by reference, and target writes are forbidden. Only a bare local
// read/store and passive declaration disappear; group operations remain exact.
export function canonicalPrivateLoopValueAliases(source,context={}){
  const proof={kind:'PRIVATE_LOOP_STABLE_LOCAL_VALUE_ALIASES',sourceSha256:sha(source),records:[],refused:[],duplicateIntegerStores:[],
    sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false};
  const bound=openVerifiedSourceBindingProgram(source,context);
  if(bound.reason)return {text:source,proof:{...proof,reason:bound.reason,viewSha256:sha(source)}};
  const {program,ast,referenceFacts}=bound;
  try{
    const removed=new Set(),renamed=new Map(),edits=[];
    for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
      const declarations=[];walk(fn.body,n=>{if(n.kind===K.VariableDeclaration)declarations.push(n);});
      if(new Set([...fn.parameters,...declarations].map(n=>n.name.name)).size!==fn.parameters.length+declarations.length)continue;
      const entry=[];for(const s of fn.body.statements){if(s.kind!==K.VariableDeclaration)break;entry.push(s);}
      const locals=new Map(),byName=new Map();
      for(const n of [...fn.parameters,...entry]){
        const b=program.getBinding(n.name);if(b.status!=='BOUND')continue;
        const row={node:n,symbolId:b.symbolId,refs:[]};locals.set(b.symbolId,row);byName.set(n.name.name,row);
      }
      walk(fn.body,n=>{
        if(n.kind!==K.Identifier||n.parent?.kind===K.PropertyAccessExpression&&n.parent.name===n)return;
        const b=program.getBinding(n),spelling=byName.get(n.name);
        if(spelling&&n!==spelling.node.name&&b.status!=='BOUND')spelling.failure='UNRESOLVED_SAME_SPELLING_REFERENCE';
        const row=locals.get(b.symbolId);if(row&&n!==row.node.name)row.refs.push(n);
      });
      const candidates=[];
      walk(fn.body,block=>{
        if(block.kind!==K.Block)return;
        for(let i=0;i<block.statements.length;i++)if(loops.has(block.statements[i].kind)){
          const loop=block.statements[i];
          for(let j=i-1;j>=0;j--){
            const statement=block.statements[j],copy=assignment(statement);if(!copy)break;
            const lhs=un(copy.left),rhs=un(copy.right);if(rhs?.kind!==K.Identifier)continue;
            const target=locals.get(program.getBinding(lhs).symbolId),origin=locals.get(program.getBinding(rhs).symbolId);
            if(!target||!origin||target===origin||!entry.includes(target.node)||target.node.initializer||target.node.modifiers?.length||target.node.isReference||
              origin.node.isReference||!groups.has(target.node.type.kind)||origin.node.type.kind!==target.node.type.kind)continue;
            candidates.push({statement,copy,loop,lhs,rhs,target,origin});
          }
        }
      });
      const accepted=new Map(),counts=new Map();for(const c of candidates)counts.set(c.target.symbolId,(counts.get(c.target.symbolId)??0)+1);
      for(const c of candidates){
        let failure=c.target.failure??c.origin.failure;
        if(counts.get(c.target.symbolId)!==1)failure='MULTIPLE_ALIAS_DEFINITIONS';
        if(c.target.refs.some(n=>!inside(n,c.copy.pos,c.loop.end)||n!==c.lhs&&directWrite(n)))failure='ALIAS_NOT_CLOSED_OR_TARGET_REASSIGNED';
        if(c.origin.refs.some(n=>inside(n,c.copy.end,c.loop.end)&&directWrite(n)))failure='SOURCE_REASSIGNED_DURING_ALIAS_LIFETIME';
        const facts=[];
        for(const n of [...c.target.refs,...c.origin.refs]){const r=referenceFacts(n,fn.body);if(r.reason){failure=r.reason;break;}facts.push(...r.facts);}
        if(failure){proof.refused.push({function:fn.name.name,target:c.target.node.name.name,source:c.origin.node.name.name,reason:failure});continue;}
        accepted.set(c.target.symbolId,{...c,facts});
      }
      const ultimate=row=>{const seen=new Set();while(accepted.has(row.symbolId)){
        assert(!seen.has(row.symbolId),'PRIVATE_ALIAS_CYCLE');seen.add(row.symbolId);row=accepted.get(row.symbolId).origin;}return row;};
      for(const c of accepted.values()){
        const origin=ultimate(c.origin);removed.add(c.statement);removed.add(c.target.node);
        for(const n of c.target.refs)if(n!==c.lhs)renamed.set(n,origin.node.name.name);
        proof.records.push({function:fn.name.name,target:c.target.node.name.name,source:c.origin.node.name.name,ultimateSource:origin.node.name.name,
          targetSymbolId:c.target.symbolId,sourceSymbolId:c.origin.symbolId,copyStart:c.statement.pos,copyEnd:c.statement.end,loopEnd:c.loop.end,
          sourceNotReassigned:true,allTargetReferencesDominated:true,byValueCalls:c.facts,onlyPrivateReadCopyAndPassiveDeclarationRemoved:true});
      }
      // Removing a pure capture can expose two identical literal stores in a
      // row. For an ordinary private int, the second has no observable effect.
      // Calls, global/member/array stores and nonliteral RHS are never removed.
      walk(fn.body,block=>{
        if(block.kind!==K.Block)return;let previous;
        for(const s of block.statements.filter(n=>!removed.has(n))){
          const e=assignment(s),lhs=un(e?.left),row=lhs&&locals.get(program.getBinding(lhs).symbolId),value=e&&readCanonicalInt32Literal(un(e.right));
          const valid=row&&row.node.type.kind===K.IntKeyword&&!row.node.isReference&&!row.node.modifiers?.length&&value!==undefined;
          if(valid&&previous?.symbolId===row.symbolId&&previous.value===value){
            removed.add(s);proof.duplicateIntegerStores.push({function:fn.name.name,symbolId:row.symbolId,value:String(value),start:s.pos,end:s.end,previousStart:previous.statement.pos});
          }else previous=valid?{symbolId:row.symbolId,value,statement:s}:undefined;
        }
      });
    }
    const removedRanges=[...removed].map(n=>({start:n.pos,end:n.end}));
    for(const n of removed)edits.push({start:n.pos,end:n.end,before:source.slice(n.pos,n.end),replacement:''});
    for(const [n,name]of renamed)if(!removedRanges.some(r=>inside(n,r.start,r.end)))edits.push({start:n.pos,end:n.pos+n.name.length,before:n.name,replacement:name});
    const applied=applyReversibleSourceEdits(source,edits),output=parse(applied.text,'private-loop-alias-view');assert.equal(output.parseDiagnostics.length,0);
    function project(n){
      if(renamed.has(n))return {...n,name:renamed.get(n)};
      if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.filter(x=>!removed.has(x)).map(project);
      return Object.fromEntries(Object.entries(n).filter(([k])=>k!=='parent').map(([k,v])=>[k,project(v)]));
    }
    assert.deepEqual(shape(output),shape(project(ast)),'PRIVATE_ALIAS_CHANGED_UNPLANNED_STRUCTURE');
    return {text:applied.text,proof:{...proof,viewSha256:sha(applied.text),closure:bound.closure,
      edits:applied.proof.edits,byteInverseVerified:applied.proof.byteInverseVerified,exactPlannedStructureVerified:true,
      nativeCallsAndGroupMutationsRetained:true,newNative:0,newCustomScript:0,newRuntimeOperations:0,persistentCache:false}};
  }finally{bound.dispose();}
}

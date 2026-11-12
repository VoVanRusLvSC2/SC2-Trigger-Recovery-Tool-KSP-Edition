import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {expressionGroupingShape as shape} from './expression-grouping-proof.typedef-terminators.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=text=>createHash('sha256').update(text).digest('hex');
const metadata=new Set(['parent','pos','end','line','char','commentsLineMap','parseDiagnostics','bindDiagnostics','additionalSyntacticDiagnostics','fileName','syntaxTokens','lineMap','__sourceText']);
function returns(node){
  if(node?.kind===K.ReturnStatement)return true;
  if(node?.kind===K.Block){const statements=node.statements;
    return statements.length>0&&statements.slice(0,-1).every(s=>[K.ExpressionStatement,K.VariableDeclaration,K.EmptyStatement].includes(s.kind))&&returns(statements.at(-1));}
  return node?.kind===K.IfStatement&&returns(node.thenStatement)&&returns(node.elseStatement);
}

// Comparison view only. If a taken branch always returns, its else-if can be
// the next statement: neither execution can reach that statement after taking
// the earlier branch. Predicate order and all calls, stores and returns remain.
// Never detach a chain that is an unbraced child of another control statement.
export function canonicalTerminatingElseChains(source){
  const ast=parse(source,'terminating-else-source');assert.equal(ast.parseDiagnostics.length,0);
  const selected=new Set(),edits=[];
  function visit(node,statementInBlock=false){
    if(node.kind===K.Block){for(const statement of node.statements)visit(statement,true);return;}
    if(node.kind===K.IfStatement){
      visit(node.thenStatement);let detached=false;
      if(statementInBlock&&node.elseStatement?.kind===K.IfStatement&&returns(node.thenStatement)){
        const start=node.thenStatement.end,end=node.elseStatement.pos,before=source.slice(start,end);
        // Comments or unfamiliar token boundaries are retained conservatively.
        if(/^\s*else\s*$/u.test(before)){
          edits.push({start,end,before,replacement:before.replace('else','    '),
            predicateEvaluationOrderPreserved:true,takenBranchAlwaysReturns:true});
          selected.add(node);detached=true;
        }
      }
      if(node.elseStatement)visit(node.elseStatement,detached);return;
    }
    forEachChild(node,child=>visit(child));
  }
  visit(ast);edits.sort((a,b)=>a.start-b.start);
  for(let i=0;i<edits.length;i++){
    assert.equal(edits[i].before.length,edits[i].replacement.length);
    assert(!i||edits[i-1].end<=edits[i].start,'ELSE_CHAIN_OVERLAPPING_EDIT');
  }
  let text=source;
  for(const edit of edits.toReversed())text=text.slice(0,edit.start)+edit.replacement+text.slice(edit.end);
  let inverse=text;
  for(const edit of edits.toReversed())inverse=inverse.slice(0,edit.start)+edit.before+inverse.slice(edit.end);
  assert.equal(inverse,source,'ELSE_CHAIN_NOT_REVERSIBLE');
  function project(node){
    if(!node||typeof node!=='object')return node;
    if(Array.isArray(node))return node.map(project);
    const result=Object.fromEntries(Object.entries(node).filter(([key,value])=>!metadata.has(key)&&value!==undefined&&!(node.kind===K.Block&&key==='statements')).map(([key,value])=>[key,project(value)]));
    if(node.kind===K.Block){
      const statements=[];
      function append(statement){
        if(selected.has(statement)){
          statements.push(project({...statement,elseStatement:undefined}));append(statement.elseStatement);
        }else statements.push(project(statement));
      }
      for(const statement of node.statements)append(statement);
      result.statements=statements;
    }
    return result;
  }
  const reparsed=parse(text,'terminating-else-view');assert.equal(reparsed.parseDiagnostics.length,0);
  assert.deepEqual(shape(reparsed),shape(project(ast)),'ELSE_CHAIN_REPARSE_NOT_EXACT_PLANNED_STRUCTURE');
  return {text,proof:{kind:'RETURN_TERMINATED_ELSE_IF_CHAINS',sourceSha256:sha(source),viewSha256:sha(text),edits,
    changed:edits.length>0,onlyKeywordReplacedWithWhitespace:true,exactPlannedStructureVerified:true,
    allPredicatesCallsStoresReturnsAndOrderRetained:true,sourceOrExportChanged:false,wholeMapAccepted:false}};
}

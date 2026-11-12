import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lexical-parameters.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.mjs';
import {expressionGroupingShape} from './expression-grouping-proof.typedef-terminators.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K,Printer,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=text=>createHash('sha256').update(text).digest('hex'),printer=new Printer();
const un=node=>{while(node?.kind===K.ParenthesizedExpression)node=node.expression;return node;};
const loops=new Set([K.ForStatement,K.WhileStatement,K.DoStatement]);
const walk=(node,visit)=>{visit(node);forEachChild(node,child=>{walk(child,visit);});};

// A syntactic schedule proof, before private counter lifetime splitting.
// x=...;while(test){body;step;} equals for(x=...;test;step){body}
// only when no continue can skip the original step. All expressions remain
// in order, the initializer has no declaration, and storage scope is unchanged.
export function canonicalPrivateWhileCounterSyntax(source) {
  const input={fileName:'private-while.galaxy',text:source,owned:true,contentSha256:sha(source)};
  const program=new GalaxyProgramContext([input],{files:[input]},sha,{checks:'binding'});
  const edits=[],records=[],refused=[];
  try {
    const ast=program.documents.get(input.fileName);program.attachOriginal(ast);assert(!ast.parseDiagnostics.length);
    const select=block=>{
      if(block.kind!==K.Block)return;
      for(let index=1;index<block.statements.length;index++){
        const previous=block.statements[index-1],loop=block.statements[index];
        const init=un(previous.expression),condition=un(loop.expression),last=loop.statement?.statements?.at(-1),step=un(last?.expression);
        if(previous.kind!==K.ExpressionStatement||loop.kind!==K.WhileStatement||loop.statement?.kind!==K.Block||
          init?.kind!==K.BinaryExpression||init.operatorToken.kind!==K.EqualsToken||un(init.left)?.kind!==K.Identifier||
          condition?.kind!==K.BinaryExpression||![K.LessThanToken,K.LessThanEqualsToken].includes(condition.operatorToken.kind)||
          last?.kind!==K.ExpressionStatement||step?.kind!==K.BinaryExpression||step.operatorToken.kind!==K.PlusEqualsToken)continue;
        const local=program.declarationAt(un(init.left)),binding=program.getBinding(un(init.left));
        if(binding.status!=='BOUND'||local?.kind!==K.VariableDeclaration||local.parent?.kind!==K.Block||
          local.parent.parent?.kind!==K.FunctionDeclaration||local.type.kind!==K.IntKeyword||local.initializer||local.modifiers?.length)continue;
        const same=node=>un(node)?.kind===K.Identifier&&program.getBinding(un(node)).symbolId===binding.symbolId;
        if(!same(condition.left)||!same(step.left))continue;
        let unsafe;
        const control=(node,depth=0)=>{
          if(node.kind===K.ContinueStatement&&depth===0)unsafe='OUTER_CONTINUE_SKIPS_STEP';
          if([K.ContinueStatement,K.BreakStatement].includes(node.kind)&&(node.label||node.identifier))unsafe='LABELLED_TRANSFER';
          const next=depth+Number(loops.has(node.kind));forEachChild(node,child=>{control(child,next);});
        };control(loop.statement);
        if(unsafe){refused.push({start:loop.pos,reason:unsafe});continue;}
        const close=loop.statement.syntaxTokens?.filter(t=>t.kind===K.CloseBraceToken).at(-1);
        const initEnd=previous.syntaxTokens?.filter(t=>t.kind===K.SemicolonToken).at(-1);
        const stepEnd=last.syntaxTokens?.filter(t=>t.kind===K.SemicolonToken).at(-1);
        assert(close&&initEnd&&stepEnd&&source[close.pos]==='}'&&source[stepEnd.pos]===';');
        const body=source.slice(loop.statement.pos+1,last.pos)+source.slice(stepEnd.pos+1,close.pos);
        const replacement=source.slice(initEnd.pos+1,loop.pos)+'for('+printer.printNode(init)+';'+printer.printNode(condition)+';'+printer.printNode(step)+'){'+body+'}';
        const check=parse('void schedule(){'+replacement+'}','while-counter-proof'),loopOut=check.statements[0]?.body?.statements[0];
        assert(!check.parseDiagnostics.length&&loopOut?.kind===K.ForStatement);
        assert.deepEqual(expressionGroupingShape(loopOut.initializer),expressionGroupingShape(init));
        assert.deepEqual(expressionGroupingShape(loopOut.condition),expressionGroupingShape(condition));
        assert.deepEqual(expressionGroupingShape(loopOut.incrementor),expressionGroupingShape(step));
        assert.deepEqual(expressionGroupingShape(loopOut.statement.statements),expressionGroupingShape(loop.statement.statements.slice(0,-1)));
        const end=close.pos+1;
        edits.push({start:previous.pos,end,before:source.slice(previous.pos,end),replacement,role:'while-with-unskippable-tail-step'});
        records.push({start:previous.pos,end,symbolId:binding.symbolId,initializerOnce:true,conditionAndStepOrderPreserved:true,noOuterContinue:true});
      }
    };
    // Select innermost nonoverlapping ranges; an outer loop with a nested
    // selected loop stays untouched in this invocation, never double-edited.
    const blocks=[];walk(ast,n=>{if(n.kind===K.Block)blocks.push(n);});
    for(const block of blocks.toReversed()){
      const size=edits.length;select(block);
      for(let index=edits.length-1;index>=size;index--)if(edits.slice(0,size).some(e=>e.start<edits[index].end&&edits[index].start<e.end)){
        const removed=edits.splice(index,1)[0];records.splice(records.findIndex(r=>r.start===removed.start&&r.end===removed.end),1);
      }
    }
    const result=applyReversibleSourceEdits(source,edits);assert(!parse(result.text).parseDiagnostics.length);
    return {...result,proof:{...result.proof,kind:'WHILE_COUNTER_EXACT_STATEMENT_SCHEDULE',records,refused,
      sourceOrExportChanged:false,wholeMapAccepted:false}};
  } finally {program.dispose();}
}

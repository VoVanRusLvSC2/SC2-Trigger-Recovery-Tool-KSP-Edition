import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openVerifiedSourceBindingProgram} from '../model/verified-source-binding-program.lexical-parameters.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.collections.mjs';
import {isIntrinsicScalarType} from '../model/passive-function-entry-storage.mjs';
import {expressionGroupingShape as shape} from './expression-grouping-proof.typedef-terminators.mjs';
import {projectedExpressionGroupingShape} from './projected-expression-grouping-shape.mjs';
import {SyntaxKind as K,Printer,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const walk=(n,f)=>{f(n);forEachChild(n,c=>walk(c,f));};
const literal=n=>{n=un(n);return [K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(n?.kind)||
  n?.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(n.operator?.kind)&&n.operand?.kind===K.NumericLiteral;};

// A closed literal capture join is private storage, not a new runtime effect.
// Move the following exact by-value call into the already selected branch.
// Conditions and calls execute once in their original order; nonliteral RHS,
// escaping cells, aliases, unmatched branches and unknown ABI all refuse.
export function canonicalBranchLiteralCallCaptures(source,context={}){
  const proof={kind:'CLOSED_BRANCH_LITERAL_CALL_CAPTURES',sourceSha256:sha(source),records:[],refused:[],
    sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false};
  const bound=openVerifiedSourceBindingProgram(source,context);
  if(bound.reason)return {text:source,proof:{...proof,reason:bound.reason,viewSha256:sha(source)}};
  const {program,ast,referenceFacts}=bound,removed=new Set(),replaced=new Map(),edits=[];
  try{
    for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
      const declarations=[];for(const s of fn.body.statements){if(s.kind!==K.VariableDeclaration)break;declarations.push(s);}
      const locals=new Map();for(const n of declarations)if(isIntrinsicScalarType(n.type)&&!n.initializer&&!n.isReference&&!n.modifiers?.length){
        const b=program.getBinding(n.name);if(b.status==='BOUND')locals.set(b.symbolId,{node:n,refs:[]});
      }
      walk(fn.body,n=>{if(n.kind===K.Identifier&&!(n.parent?.kind===K.PropertyAccessExpression&&n.parent.name===n)){
        const row=locals.get(program.getBinding(n).symbolId);if(row&&n!==row.node.name)row.refs.push(n);
      }});
      const branch=block=>{
        if(block?.kind!==K.Block||!block.statements.length)return;
        const stores=new Map();for(const s of block.statements){
          const e=un(s.kind===K.ExpressionStatement?s.expression:undefined),lhs=un(e?.left);
          const id=lhs?.kind===K.Identifier?program.getBinding(lhs).symbolId:undefined;
          if(e?.kind!==K.BinaryExpression||e.operatorToken?.kind!==K.EqualsToken||!literal(e.right)||!locals.has(id)||stores.has(id))return;
          stores.set(id,{lhs,rhs:e.right});
        }return stores;
      };
      walk(fn.body,block=>{
        if(block.kind!==K.Block)return;
        for(let i=0;i+1<block.statements.length;i++){
          const node=block.statements[i],statement=block.statements[i+1],call=un(statement.kind===K.ExpressionStatement?statement.expression:undefined);
          if(node.kind!==K.IfStatement||call?.kind!==K.CallExpression||call.expression.kind!==K.Identifier)continue;
          const left=branch(node.thenStatement),right=branch(node.elseStatement);
          if(!left||!right||left.size!==right.size||[...left.keys()].some(id=>!right.has(id)))continue;
          const args=new Map();for(const arg of call.arguments){const ref=un(arg);if(ref.kind!==K.Identifier)continue;
            const id=program.getBinding(ref).symbolId;if(left.has(id)){const rows=args.get(id)??[];rows.push(ref);args.set(id,rows);}}
          let failure;if(args.size!==left.size)failure='CAPTURE_NOT_DIRECT_CALL_ARGUMENT';
          for(const id of left.keys()){
            const row=locals.get(id),allowed=new Set([left.get(id).lhs,right.get(id).lhs,...(args.get(id)??[])]);
            if(removed.has(row.node)||row.refs.some(n=>!allowed.has(n)))failure='CAPTURE_CELL_ESCAPES_JOIN';
            for(const ref of args.get(id)??[]){const fact=referenceFacts(ref,fn.body);
              if(fact.reason||fact.facts.length!==1||fact.facts[0].type!==printer.printNode(row.node.type))failure='CALL_ABI_OR_BY_VALUE_TYPE_UNPROVEN';}
          }
          if(failure){proof.refused.push({function:fn.name.name,start:node.pos,reason:failure});continue;}
          const argumentsFor=stores=>call.arguments.map(arg=>{const ref=un(arg),id=ref.kind===K.Identifier?program.getBinding(ref).symbolId:undefined;return stores.get(id)?.rhs??arg;});
          const make=stores=>({kind:K.Block,statements:[{...statement,expression:{...call,arguments:argumentsFor(stores)}}]});
          const replacement={...node,thenStatement:make(left),elseStatement:make(right)};
          replaced.set(node,replacement);removed.add(statement);
          for(const id of left.keys())removed.add(locals.get(id).node);
          edits.push({start:node.pos,end:node.end,before:source.slice(node.pos,node.end),replacement:printer.printNode(replacement)});
          proof.records.push({function:fn.name.name,start:node.pos,end:statement.end,callee:call.expression.name,
            capturedSymbolIds:[...left.keys()],onlyClosedLiteralStores:true,allReferencesClosed:true,callAbiAndValueTypesExact:true,
            conditionEvaluatedOnce:true,callEvaluatedOnce:true,otherArgumentsAndTheirOrderRetained:true});
        }
      });
    }
    for(const n of removed)edits.push({start:n.pos,end:n.end,before:source.slice(n.pos,n.end),replacement:''});
    const applied=applyReversibleSourceEdits(source,edits),output=parse(applied.text,'branch-literal-call-view');assert.equal(output.parseDiagnostics.length,0);
    const expected=projectedExpressionGroupingShape(ast,n=>{
      const node=replaced.get(n)??n;
      return node.kind===K.Block?{...node,statements:node.statements.filter(s=>!removed.has(s))}:node;
    });
    assert.deepEqual(shape(output),expected,'BRANCH_CAPTURE_CHANGED_UNPLANNED_AST');
    return {text:applied.text,proof:{...proof,viewSha256:sha(applied.text),edits:applied.proof.edits,
      byteInverseVerified:applied.proof.byteInverseVerified,allOtherAstExact:true,wholeProgramOracleStillRequired:true}};
  }finally{bound.dispose();}
}

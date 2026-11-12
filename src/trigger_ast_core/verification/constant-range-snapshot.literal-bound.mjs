// Comparison-only view of a closed constant range capture. Never changes a
// map, GUI tree or the underlying oracle; a whole-program comparison is still
// required. Unknown bindings or any additional snapshot uses are refused.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openVerifiedSourceBindingProgram} from '../model/verified-source-binding-program.lexical-parameters.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.collections.mjs';
import {expressionGroupingShape as shape} from './expression-grouping-proof.typedef-terminators.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {readCanonicalInt32Literal} from '../types/inclusive-literal-int-comparison.mjs';
import {SyntaxKind as K,Printer,forEachChild,isAssignmentOperator} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),p=new Printer();
const un=n=>n?.kind===K.ParenthesizedExpression?un(n.expression):n;
const binary=(n,op)=>{n=un(n);return n?.kind===K.BinaryExpression&&n.operatorToken?.kind===op?n:undefined;};
const id=n=>{n=un(n);return n?.kind===K.Identifier?n:undefined;};
const walk=(n,visit)=>{visit(n);forEachChild(n,c=>walk(c,visit));};
const inside=(node,region)=>node.pos>=region.pos&&node.end<=region.end;
export function canonicalConstantRangeSnapshots(source,context={}){
 const proof={kind:'CLOSED_CONSTANT_INTEGER_RANGE_SNAPSHOT',sourceSha256:sha(source),records:[],refused:[],sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false};
 const bound=openVerifiedSourceBindingProgram(source,context);
 if(bound.reason)return{text:source,proof:{...proof,reason:bound.reason,viewSha256:sha(source)}};
 const {program,ast,referenceFacts}=bound,edits=[],removed=new Set(),replacement=new Map(),storageCache=new Map();
 try{
  const same=(a,b)=>{a=id(a);b=id(b);if(!a||!b)return false;const x=program.getBinding(a),y=program.getBinding(b);return x.status==='BOUND'&&y.status==='BOUND'&&x.symbolId===y.symbolId;};
  function storageIssue(reference){
   const target=program.getBinding(reference);if(target.status!=='BOUND')return 'BOUND_STORAGE_UNRESOLVED';
   if(storageCache.has(target.symbolId))return storageCache.get(target.symbolId);
   let issue;for(const doc of program.documents.values()){
    function scan(n,owner){if(n.kind===K.FunctionDeclaration)owner=n;
     if(n.kind===K.Identifier&&n.name===reference.name&&!(n.parent?.kind===K.PropertyAccessExpression&&n.parent.name===n)){
      const binding=program.getBinding(n);if(binding.status!=='BOUND')issue??='UNRESOLVED_SAME_NAME';
      if(binding.status==='BOUND'&&binding.symbolId===target.symbolId){
       for(let q=n.parent;q&&q!==owner?.body;q=q.parent){
        if(q.kind===K.BinaryExpression&&isAssignmentOperator(q.operatorToken.kind)&&inside(n,q.left))issue??='BOUND_CONSTANT_WRITTEN';
        if([K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(q.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(q.operator?.kind??q.operator)&&inside(n,q.operand))issue??='BOUND_CONSTANT_WRITTEN';
        if(q.kind===K.CallExpression&&q.arguments.some(a=>inside(n,a))){const safe=referenceFacts(n,owner?.body??doc);if(safe.reason)issue??='BOUND_CONSTANT_REFERENCE_OR_UNKNOWN_CALL';}
       }
      }
     }
     forEachChild(n,c=>scan(c,owner));
    }scan(doc,undefined);
   }
   storageCache.set(target.symbolId,issue);return issue;
  }
  for(const fn of ast.statements){if(fn.kind!==K.FunctionDeclaration||!fn.body)continue;const s=fn.body.statements;
   for(let i=1;i<s.length;i++){
    const loop=s[i],reset=s[i-1],init=binary(reset?.kind===K.ExpressionStatement?reset.expression:undefined,K.EqualsToken),counter=id(init?.left);
    if(loop.kind!==K.ForStatement||loop.initializer||!counter||readCanonicalInt32Literal(init.right)===undefined||loop.statement?.kind!==K.Block)continue;
    const or=binary(loop.condition,K.BarBarToken),a=or&&binary(or.left,K.AmpersandAmpersandToken),b=or&&binary(or.right,K.AmpersandAmpersandToken);
    const signPlus=a&&binary(a.left,K.GreaterThanEqualsToken),up=a&&binary(a.right,K.LessThanEqualsToken),signMinus=b&&binary(b.left,K.LessThanToken),down=b&&binary(b.right,K.GreaterThanEqualsToken);
    let update=binary(loop.incrementor,K.PlusEqualsToken);if(!update){const assign=binary(loop.incrementor,K.EqualsToken),sum=assign&&binary(assign.right,K.PlusToken);if(assign&&sum&&same(assign.left,sum.left))update={left:assign.left,right:sum.right};}
    if(!signPlus||!up||!signMinus||!down||!update||readCanonicalInt32Literal(signPlus.right)!==0n||readCanonicalInt32Literal(signMinus.right)!==0n||!same(counter,up.left)||!same(counter,down.left)||!same(counter,update.left)||!same(signPlus.left,signMinus.left)||!same(signPlus.left,update.right)||!same(up.right,down.right))continue;
    const endRef=id(up.right),stepRef=id(signPlus.left),endDecl=endRef&&program.declarationAt(endRef),stepDecl=stepRef&&program.declarationAt(stepRef),counterDecl=program.declarationAt(counter);
    const localConst=x=>x?.kind===K.VariableDeclaration&&x.parent?.kind===K.Block&&x.parent.pos===fn.body.pos&&x.parent.end===fn.body.end&&x.type?.kind===K.IntKeyword&&!x.isReference&&x.modifiers?.length===1&&x.modifiers[0].kind===K.ConstKeyword&&x.initializer;
    if(!localConst(endDecl)||!localConst(stepDecl)||endDecl===stepDecl||counterDecl?.kind!==K.VariableDeclaration||(counterDecl.parent?.kind!==K.Block||counterDecl.parent.pos!==fn.body.pos||counterDecl.parent.end!==fn.body.end)||counterDecl.type?.kind!==K.IntKeyword||counterDecl.isReference||counterDecl.modifiers?.length||counterDecl.initializer)continue;
    const amount=readCanonicalInt32Literal(stepDecl.initializer),directLiteral=readCanonicalInt32Literal(endDecl.initializer),sourceBound=id(endDecl.initializer),sourceDecl=sourceBound&&program.declarationAt(sourceBound),where=sourceDecl&&program.location(sourceDecl),identity=where&&program.verifiedInputIdentity(where.sourceFile),literal=directLiteral??(sourceDecl&&readCanonicalInt32Literal(sourceDecl.initializer));
    if(amount===undefined||amount===0n||literal===undefined)continue;
    if(directLiteral===undefined&&(!sourceBound||program.getBinding(sourceBound).status!=='BOUND'||sourceDecl?.kind!==K.VariableDeclaration||sourceDecl.parent?.kind!==K.SourceFile||sourceDecl.type?.kind!==K.IntKeyword||sourceDecl.isReference||sourceDecl.modifiers?.length!==1||sourceDecl.modifiers[0].kind!==K.ConstKeyword||!where||identity?.contentSha256!==where.contentSha256))continue;
    const storageFailure=sourceBound&&storageIssue(sourceBound);if(storageFailure){proof.refused.push({function:fn.name.name,reason:storageFailure});continue;}
    let shadows=fn.parameters.some(x=>x.name?.name===sourceBound?.name);walk(fn.body,x=>{if(x.kind===K.VariableDeclaration&&x.name?.name===sourceBound?.name)shadows=true;});if(shadows){proof.refused.push({function:fn.name.name,reason:'BOUND_NAME_SHADOWED_IN_FUNCTION'});continue;}
    if(endDecl.pos>=reset.pos||stepDecl.pos>=reset.pos)continue;
    let unsafe=false,endUses=0,stepUses=0;walk(fn.body,n=>{if(n.kind!==K.Identifier||n.pos===endDecl.name.pos&&n.end===endDecl.name.end||n.pos===stepDecl.name.pos&&n.end===stepDecl.name.end)return;
     for(const [ref,decl,label]of [[endRef,endDecl,'end'],[stepRef,stepDecl,'step']]){
      const binding=program.getBinding(n);if(n.name===decl.name.name&&binding.status!=='BOUND')unsafe=true;
      if(same(n,ref)){if(!inside(n,loop.condition)&&!inside(n,loop.incrementor))unsafe=true;if(label==='end')endUses++;else stepUses++;}
     }
    });
    if(unsafe||endUses!==2||stepUses!==3){proof.refused.push({function:fn.name.name,reason:'SNAPSHOT_REFERENCES_NOT_PRIVATE',endUses,stepUses});continue;}
    const compare=amount>0n?K.LessThanEqualsToken:K.GreaterThanEqualsToken;
    const result={...loop,initializer:init,condition:{kind:K.BinaryExpression,left:counter,operatorToken:{kind:compare},right:sourceBound??endDecl.initializer},incrementor:{kind:K.BinaryExpression,left:counter,operatorToken:{kind:K.PlusEqualsToken},right:stepDecl.initializer}};
    const endAst=s.find(x=>x.kind===K.VariableDeclaration&&x.pos===endDecl.pos&&x.end===endDecl.end),stepAst=s.find(x=>x.kind===K.VariableDeclaration&&x.pos===stepDecl.pos&&x.end===stepDecl.end);if(!endAst||!stepAst)continue;
    const spans=[{start:endDecl.pos,end:endDecl.end,replacement:''},{start:stepDecl.pos,end:stepDecl.end,replacement:''},{start:reset.pos,end:reset.end,replacement:''},{start:loop.pos,end:loop.end,replacement:p.printNode(result)}];
    if(spans.some(x=>edits.some(e=>x.start<e.end&&e.start<x.end))){proof.refused.push({function:fn.name.name,reason:'OVERLAPPING_PROOF_REGIONS'});continue;}
    for(const e of spans)edits.push({...e,before:source.slice(e.start,e.end)});removed.add(endAst);removed.add(stepAst);removed.add(reset);replacement.set(loop,result);
    proof.records.push({function:fn.name.name,forStart:loop.pos,boundDeclaration:where,boundKind:directLiteral===undefined?'BOUND_GLOBAL_LITERAL_CONSTANT':'DIRECT_INT32_LITERAL',boundValue:String(literal),step:String(amount),snapshotEnd:endDecl.name.name,snapshotStep:stepDecl.name.name,counter:counter.name,allSnapshotReferencesExhausted:true,initializerIsLiteral:true,loopBodyAndControlTransfersPreserved:true});
   }
  }
  const applied=applyReversibleSourceEdits(source,edits),after=parse(applied.text,'constant-range-snapshot-view.galaxy');assert.equal(after.parseDiagnostics.length,0,'SNAPSHOT_VIEW_SYNTAX');
  function project(n){if(replacement.has(n))return project(replacement.get(n));if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.filter(x=>!removed.has(x)).map(project);return Object.fromEntries(Object.entries(n).filter(([k])=>!['parent','symbol','locals','flowNode','syntaxTokens','comments'].includes(k)).map(([k,v])=>[k,project(v)]));}
  assert.deepEqual(shape(after),shape(project(ast)),'SNAPSHOT_UNPLANNED_AST_CHANGE');
  return{text:applied.text,proof:{...proof,exactPlannedStructureVerified:true,closure:bound.closure,edits:applied.proof.edits,byteInverseVerified:applied.proof.byteInverseVerified,viewSha256:sha(applied.text),wholeProgramOracleStillRequired:true}};
 }finally{bound.dispose();}
}

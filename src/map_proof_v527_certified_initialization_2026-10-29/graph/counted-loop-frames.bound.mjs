// Comparison views only. Lift a reset + counted while into the same for frame
// without moving declarations or changing runtime source. A continue targeting
// that while would skip its tail update and therefore cannot be lifted.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lexical-parameters.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.collections.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {readCanonicalInt32Literal} from '../types/inclusive-literal-int-comparison.mjs';
import {expressionGroupingShape} from './expression-grouping-proof.typedef-terminators.mjs';
import {SyntaxKind as K,Printer,forEachChild,isPartOfExpression} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const printer=new Printer(),loops=new Set([K.ForStatement,K.WhileStatement,K.DoStatement]);
const metadata=new Set(['parent','symbol','locals','flowNode','syntaxTokens','comments']);
const clone=n=>!n||typeof n!=='object'?n:Array.isArray(n)?n.map(clone):Object.fromEntries(Object.entries(n).filter(([k])=>!metadata.has(k)).map(([k,v])=>[k,clone(v)]));
const shape=n=>expressionGroupingShape(clone(n));
const walk=(n,visit)=>{visit(n);forEachChild(n,c=>walk(c,visit));};
const inside=(n,owner)=>n&&n.pos>=owner.pos&&n.end<=owner.end;
const comparisons=new Set([K.LessThanToken,K.LessThanEqualsToken,K.GreaterThanToken,K.GreaterThanEqualsToken]);
const compounds=new Set([K.PlusEqualsToken,K.MinusEqualsToken,K.AsteriskEqualsToken,K.SlashEqualsToken,K.PercentEqualsToken]);
const pureBinary=new Set([K.PlusToken,K.MinusToken,K.AsteriskToken,K.SlashToken,K.PercentToken,K.LessThanLessThanToken,K.GreaterThanGreaterThanToken,K.AmpersandToken,K.BarToken,K.CaretToken]);
const pure=n=>{n=un(n);return n?.kind===K.Identifier||n?.kind===K.NumericLiteral||n?.kind===K.BinaryExpression&&pureBinary.has(n.operatorToken?.kind)&&pure(n.left)&&pure(n.right)||n?.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken,K.TildeToken].includes(n.operator?.kind)&&pure(n.operand);};

export function canonicalBoundCountedLoopFrames(source){
 const syntax=parse(source,'counted-loops.galaxy');assert.equal(syntax.parseDiagnostics.length,0,'COUNTED_LOOP_SYNTAX');
 const input={fileName:'counted-loops.galaxy',sourceId:'counted-loops',text:source,owned:true,contentSha256:sha(source)};
 const program=new GalaxyProgramContext([input],{files:[input]},sha,{checks:'binding'});
 const frames=new Map(),forUpdates=new Map(),records=[],refused=[];
 try{
  program.attachOriginal(syntax);
  function counter(initializer,condition){
   const init=un(initializer),test=un(condition),target=un(init?.left);
   if(init?.kind!==K.BinaryExpression||init.operatorToken?.kind!==K.EqualsToken||target?.kind!==K.Identifier||
      test?.kind!==K.BinaryExpression||!comparisons.has(test.operatorToken?.kind))return;
   const binding=program.getBinding(target),declaration=program.declarationAt(target);
   if(binding.status!=='BOUND'||![K.VariableDeclaration,K.ParameterDeclaration].includes(declaration?.kind)||declaration.type?.kind!==K.IntKeyword||declaration.isReference||
      declaration.modifiers?.some(m=>m.kind!==K.StaticKeyword))return;
   const same=node=>{node=un(node);return node?.kind===K.Identifier&&program.getBinding(node).status==='BOUND'&&program.getBinding(node).symbolId===binding.symbolId;};
   if(!same(test.left))return;
   return {init,test,target,binding,declaration,same};
  }
  function update(expression,c){
   const node=un(expression);let arithmetic,amount;
   if(node?.kind===K.BinaryExpression&&compounds.has(node.operatorToken?.kind)&&c.same(node.left)&&pure(node.right)){
    arithmetic=node.operatorToken.kind===K.PlusEqualsToken?K.PlusToken:node.operatorToken.kind===K.MinusEqualsToken?K.MinusToken:undefined;amount=node.right;
   }else if(node?.kind===K.BinaryExpression&&node.operatorToken?.kind===K.EqualsToken&&c.same(node.left)&&pure(node.right)){
    const rhs=un(node.right);if(rhs?.kind===K.BinaryExpression&&[K.PlusToken,K.MinusToken].includes(rhs.operatorToken?.kind)&&c.same(rhs.left)){arithmetic=rhs.operatorToken.kind;amount=rhs.right;}
   }else return;
   const literal=readCanonicalInt32Literal(amount);
   // The counter is an actual scalar int. Only an effect-free literal add or
   // subtract is changed to compound form; every other update stays verbatim.
   let canonical=clone(node);
   if(arithmetic!==undefined&&literal!==undefined){
    let value=arithmetic===K.MinusToken?-literal:literal,operator=K.PlusEqualsToken;
    if(value< -2147483648n||value>2147483647n){value=literal;operator=K.MinusEqualsToken;}
    const right=parse('int step='+value+';','counted-step').statements[0].initializer;
    canonical={kind:K.BinaryExpression,left:clone(c.target),operatorToken:{kind:operator},right:clone(right)};
   }
   return {node,canonical};
  }
  function bodyIssue(body,step,c){
   let reason;
   function controls(n,depth=0){
    if([K.VariableDeclaration,K.ParameterDeclaration,K.FunctionDeclaration,K.StructDeclaration,K.TypedefDeclaration].includes(n.kind)&&n.name?.name===c.target.name)reason='COUNTER_NAME_CAPTURE';
    if([K.BreakStatement,K.ContinueStatement].includes(n.kind)&&(n.label||n.identifier))reason='LABELLED_TRANSFER';
    if(n.kind===K.ContinueStatement&&depth===0)reason='CONTINUE_SKIPS_TAIL_UPDATE';
    forEachChild(n,child=>controls(child,depth+Number(loops.has(n.kind))));
   }controls(body);
   walk(step,n=>{
    if(n.kind!==K.Identifier||!isPartOfExpression(n)||n.parent?.kind===K.PropertyAccessExpression&&n.parent.name===n)return;
    const binding=program.getBinding(n),declaration=program.declarationAt(n);
    if(binding.status!=='BOUND'||!declaration)reason='UPDATE_REFERENCE_UNBOUND';
    else if(inside(declaration,body))reason='UPDATE_REFERENCE_BODY_SCOPE';
   });return reason;
  }
  for(const fn of syntax.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body))walk(fn.body,n=>{
   if(n.kind===K.ForStatement){
    const c=counter(n.initializer,n.condition),step=c&&update(n.incrementor,c);if(!step)return;
    if(JSON.stringify(shape(step.node))!==JSON.stringify(shape(step.canonical))){forUpdates.set(n,step.canonical);records.push({kind:'INT_COUNTER_UPDATE_FORM',function:fn.name.name,start:n.pos,end:n.end,symbolId:c.binding.symbolId,storageName:c.target.name,int32Carrier:true});}
   }
   if(n.kind!==K.Block)return;
   for(let i=0;i+1<n.statements.length;i++){
    const init=n.statements[i],loop=n.statements[i+1];if(init.kind!==K.ExpressionStatement||loop.kind!==K.WhileStatement||loop.statement?.kind!==K.Block)continue;
    const c=counter(init.expression,loop.expression),tail=loop.statement.statements.at(-1),step=c&&tail?.kind===K.ExpressionStatement&&update(tail.expression,c);if(!step)continue;
    const reason=bodyIssue(loop.statement,step.node,c);
    if(reason){refused.push({function:fn.name.name,start:loop.pos,reason,counter:c.target.name});continue;}
    frames.set(init,{init,loop,tail,step:step.canonical});records.push({kind:'BOUND_RESET_WHILE_TAIL_TO_FOR',function:fn.name.name,start:init.pos,end:loop.end,
     counter:c.target.name,symbolId:c.binding.symbolId,declaration:{start:c.declaration.pos,end:c.declaration.end,kind:K[c.declaration.kind]},
     initializerOnce:true,conditionSchedulePreserved:true,tailSchedulePreserved:true,counterStorageUnchanged:true,bodyScopeCaptureExcluded:true,ownContinueExcluded:true});
   }
  });
  if(!frames.size&&!forUpdates.size)return {text:source,proof:{kind:'BOUND_COUNTED_LOOP_FRAMES',records,refused,edits:[],sourceSha256:sha(source),viewSha256:sha(source),sourceOrExportChanged:false,wholeMapAccepted:false}};
  function lifted(frame){return {kind:K.ForStatement,initializer:clone(frame.init.expression),condition:clone(frame.loop.expression),incrementor:clone(frame.step),
    statement:transform({...frame.loop.statement,statements:frame.loop.statement.statements.slice(0,-1)})};}
  function transform(node){
   if(!node||typeof node!=='object')return node;if(Array.isArray(node))return node.map(transform);
   const result=Object.fromEntries(Object.entries(node).filter(([k])=>!metadata.has(k)));
   if(node.kind===K.Block){result.statements=[];for(let i=0;i<node.statements.length;i++){const statement=node.statements[i],frame=frames.get(statement);if(frame){assert.equal(node.statements[++i],frame.loop);result.statements.push(lifted(frame));}else result.statements.push(transform(statement));}}
   else for(const[k,value]of Object.entries(node))if(!metadata.has(k)&&value&&typeof value==='object')result[k]=transform(value);
   if(forUpdates.has(node))result.incrementor=clone(forUpdates.get(node));return result;
  }
  const edits=[];
  function select(node){
   if(node.kind===K.Block){for(let i=0;i<node.statements.length;i++){const statement=node.statements[i],frame=frames.get(statement);if(frame){assert.equal(node.statements[++i],frame.loop);edits.push({start:statement.pos,end:frame.loop.end,before:source.slice(statement.pos,frame.loop.end),replacement:printer.printNode(lifted(frame))+'\n'});}else select(statement);}return;}
   if(forUpdates.has(node)){edits.push({start:node.pos,end:node.end,before:source.slice(node.pos,node.end),replacement:printer.printNode(transform(node))+'\n'});return;}
   forEachChild(node,select);
  }select(syntax);
  const rewritten=applyReversibleSourceEdits(source,edits),after=parse(rewritten.text,'counted-loop-view');assert.equal(after.parseDiagnostics.length,0,'COUNTED_LOOP_VIEW_SYNTAX');
  assert.deepEqual(shape(after),shape(transform(syntax)),'COUNTED_LOOP_OTHER_AST_CHANGED');
  return {text:rewritten.text,proof:{kind:'BOUND_COUNTED_LOOP_FRAMES',sourceSha256:sha(source),viewSha256:sha(rewritten.text),records,refused,edits:rewritten.proof.edits,
   byteInverseVerified:rewritten.proof.byteInverseVerified,allOtherAstExact:true,sourceOrExportChanged:false,wholeProgramOracleStillRequired:true,wholeMapAccepted:false}};
 }finally{program.dispose();}
}

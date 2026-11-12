// Used only after loaded/native loop templates fail. Preserve the for CFG with
// ordinary statements and While; never infer iteration behavior from a name.
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
const loops=new Set([K.ForStatement,K.WhileStatement,K.DoStatement]);
const decls=new Set([K.VariableDeclaration,K.FunctionDeclaration,K.ParameterDeclaration]);
const block=(statements,origin)=>({kind:K.Block,statements,pos:origin?.pos,end:origin?.end});
const statement=expression=>({kind:K.ExpressionStatement,expression,pos:expression.pos,end:expression.end});

export function planResidualForControlFlow(node) {
 if(node?.kind!==K.ForStatement||!node.statement)return;
 if(node.initializer&&decls.has(node.initializer.kind))return;
 // Increment moves into the while body. Retain lexical declarations for the
 // existing scope-aware codec instead of capturing any of their bindings.
 let declaration=false;
 const inspect=n=>{if(decls.has(n.kind))declaration=true;forEachChild(n,inspect);};
 inspect(node.statement);if(declaration)return;
 const increment=node.incrementor?statement(node.incrementor):undefined;
 let rewrittenContinues=0;
 function rewrite(n) {
  if(!n||loops.has(n.kind))return n;
  if(n.kind===K.ContinueStatement) {
   if(!increment)return n;
   rewrittenContinues++;
   return block([increment,n],n);
  }
  let changed=false;const next={...n};
  for(const [key,value]of Object.entries(n)) {
   if(['parent','syntaxTokens','symbol','locals','flowNode'].includes(key)||!value)continue;
   if(Array.isArray(value)) {
    const mapped=[];
    for(const item of value) {
     if(!item||typeof item.kind!=='number'){mapped.push(item);continue;}
     const result=rewrite(item);changed ||= result!==item;
     // A Continue in a statement list expands in place, without a raw Block
     // wrapper. A single If branch receives the ordinary Block form instead.
     if(key==='statements'&&item.kind===K.ContinueStatement&&result!==item)mapped.push(...result.statements);
     else mapped.push(result);
    }
    if(changed)next[key]=mapped;
   }else if(typeof value.kind==='number') {
    const result=rewrite(value);if(result!==value){next[key]=result;changed=true;}
   }
  }
  return changed?next:n;
 }
 const body=rewrite(node.statement),bodyStatements=body.kind===K.Block?[...body.statements]:[body];
 if(increment)bodyStatements.push(increment);
 const condition=node.condition??{kind:K.TrueKeyword};
 const whileNode={kind:K.WhileStatement,expression:condition,statement:block(bodyStatements,node.statement),pos:node.pos,end:node.end};
 return {statements:[...(node.initializer?[statement(node.initializer)]:[]),whileNode],proof:{
  kind:'RESIDUAL_FOR_TO_GUI_WHILE',initializerOnce:true,conditionBeforeEveryIteration:true,
  incrementAfterNormalBody:true,incrementBeforeTargetContinue:rewrittenContinues,
  nestedLoopContinuesUntouched:true,breakAndReturnSkipIncrement:true,
  lexicalDeclarationsAbsent:true,noNewVariablesOrFunctions:true,sourceFilesWritten:false}};
}

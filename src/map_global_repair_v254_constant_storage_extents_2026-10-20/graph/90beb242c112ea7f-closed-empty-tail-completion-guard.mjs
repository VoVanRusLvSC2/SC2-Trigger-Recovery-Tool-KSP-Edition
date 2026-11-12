// A recognition-only view of legacy startup guards. Moving the final true
// store ahead of calls is valid only when every call has a unique, literally
// empty, zero-argument void body. No authored AST or source bytes are mutated.
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v254_constant_storage_extents_2026-10-20/graph/d14d4b948618471b-g2t-core.mjs';
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
function walk(n,visit){if(!n)return;visit(n);forEachChild(n,c=>walk(c,visit));}
export function projectClosedEmptyTailCompletionGuards(nodes){
 const definitions=new Map(),globals=new Map(),collisions=new Set(),proof=[];
 for(const n of nodes){
  if(!n.name?.name)continue;
  if(n.kind===K.FunctionDeclaration){const list=definitions.get(n.name.name)??[];list.push(n);definitions.set(n.name.name,list);}
  if(n.kind===K.VariableDeclaration){if(globals.has(n.name.name))collisions.add(n.name.name);globals.set(n.name.name,n);}
 }
 const projected=nodes.map(fn=>{
  if(fn.kind!==K.FunctionDeclaration||!fn.body||getTypeName(fn.type)!=='void'||fn.parameters.length||definitions.get(fn.name.name)?.length!==1||globals.has(fn.name.name))return fn;
  const ss=fn.body.statements;if(ss.length<3)return fn;
  const first=ss[0],condition=unwrap(first.expression),branch=first.thenStatement?.kind===K.Block?first.thenStatement.statements:[first.thenStatement];
  if(first.kind!==K.IfStatement||first.elseStatement||condition?.kind!==K.Identifier||branch.length!==1||branch[0]?.kind!==K.ReturnStatement||branch[0].expression)return fn;
  const flag=condition.name,decl=globals.get(flag),last=ss.at(-1),store=last.expression;
  if(!decl||collisions.has(flag)||decl.modifiers?.length||getTypeName(decl.type)!=='bool'||unwrap(decl.initializer)?.kind!==K.FalseKeyword||
     last.kind!==K.ExpressionStatement||store?.kind!==K.BinaryExpression||store.operatorToken?.kind!==K.EqualsToken||store.left?.kind!==K.Identifier||store.left.name!==flag||unwrap(store.right)?.kind!==K.TrueKeyword)return fn;
  const calls=[];
  for(const s of ss.slice(1,-1)){
   const call=s.expression,target=call?.expression?.name,choices=definitions.get(target),callee=choices?.[0];
   if(s.kind!==K.ExpressionStatement||call?.kind!==K.CallExpression||call.expression?.kind!==K.Identifier||call.arguments.length||!callee||choices.length!==1||globals.has(target)||
      !callee.body||getTypeName(callee.type)!=='void'||callee.parameters.length||callee.body.statements.length||target===fn.name.name)return fn;
   calls.push(target);
  }
  // A parameter/local with the same callee spelling would change name binding.
  let localCollision=false;walk(fn.body,n=>{if(n.kind===K.VariableDeclaration&&(calls.includes(n.name.name)||n.name.name===flag))localCollision=true;});
  if(localCollision)return fn;
  proof.push({function:fn.name.name,flag,calls,allCalleesUniqueLiteralEmptyVoid:true,allOriginalStatementsPreserved:true,projectionOnly:true});
  return {...fn,body:{...fn.body,statements:[first,last,...ss.slice(1,-1)]}};
 });
 return {nodes:projected,proof,originalNodesChanged:false};
}

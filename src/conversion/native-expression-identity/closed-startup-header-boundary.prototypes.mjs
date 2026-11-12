// Source-only boundary: which existing stages execute before newly generated
// variable initialization. Never infer ownership from a map label or filename.
import {SyntaxKind as K} from "../exact-function-signatures/index-alternate-3.js";
import {getTypeName} from "./g2t-core.generated-call-provenance.mjs";
import {projectClosedEmptyTailCompletionGuards} from "./closed-empty-tail-completion-guard.mjs";
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
export function closedStartupHeaderBoundary(nodes,libraryId){
 const root=`lib${libraryId}_InitLib`,tail=projectClosedEmptyTailCompletionGuards(nodes).proof.find(p=>p.function===root);
 if(tail)return {...tail,layout:'CLOSED_EMPTY_TAIL',earlyStages:[],completionFlags:[tail.flag]};
 const functions=nodes.filter(n=>n.kind===K.FunctionDeclaration&&n.body),prototypes=nodes.filter(n=>n.kind===K.FunctionDeclaration&&!n.body),definitions=functions.filter(n=>n.name.name===root);
 const validPrototypes=name=>prototypes.filter(n=>n.name.name===name).every(n=>getTypeName(n.type)==='void'&&!n.parameters.length&&!n.modifiers?.length);
 if(definitions.length!==1||!validPrototypes(root))return;
 const fn=definitions[0],ss=fn.body?.statements;
 if(!ss||ss.length<2||getTypeName(fn.type)!=='void'||fn.parameters.length||fn.modifiers?.length)return;
 const first=ss[0],condition=unwrap(first.expression),branch=first.thenStatement?.kind===K.Block?first.thenStatement.statements:[first.thenStatement],store=ss[1].expression;
 if(first.kind!==K.IfStatement||first.elseStatement||condition?.kind!==K.Identifier||branch.length!==1||branch[0]?.kind!==K.ReturnStatement||branch[0].expression)return;
 const flag=condition.name,globals=nodes.filter(n=>n.kind===K.VariableDeclaration&&n.name.name===flag),decl=globals[0];
 if(globals.length!==1||decl.modifiers?.length||getTypeName(decl.type)!=='bool'||unwrap(decl.initializer)?.kind!==K.FalseKeyword||ss[1].kind!==K.ExpressionStatement||store?.kind!==K.BinaryExpression||store.operatorToken?.kind!==K.EqualsToken||store.left?.name!==flag||unwrap(store.right)?.kind!==K.TrueKeyword)return;
 const allowed=['InitLibraries','InitVariables','InitCustomScript','InitTriggers'].map(role=>`lib${libraryId}_${role}`),calls=[],earlyStages=[];let previous=-1;
 for(const s of ss.slice(2)){
  const call=s.expression,name=call?.expression?.name,index=allowed.indexOf(name),targets=functions.filter(n=>n.name.name===name),target=targets[0];
  if(s.kind!==K.ExpressionStatement||call?.kind!==K.CallExpression||call.expression?.kind!==K.Identifier||call.arguments.length||index<=previous||index<0||targets.length!==1||!target.body||target.parameters.length||target.modifiers?.length||getTypeName(target.type)!=='void'||!validPrototypes(name))return;
  previous=index;calls.push(name);
  if(index<2)earlyStages.push(name);
  if(index===2&&target.body.statements.length)return;
 }
 let variableGuard;
 const variableStage=functions.find(n=>n.name.name===allowed[1]);
 if(earlyStages.includes(allowed[1])){
  const body=variableStage.body.statements;let i=0;
  while(body[i]?.kind===K.VariableDeclaration){if(body[i].initializer)return;i++;}
  const guard=body[i],condition=unwrap(guard?.expression),branch=guard?.thenStatement?.kind===K.Block?guard.thenStatement.statements:[guard?.thenStatement],set=body[i+1],e=set?.expression;
  const matching=nodes.filter(n=>n.kind===K.VariableDeclaration&&n.name.name===condition?.name),decl=matching[0];
  if(guard?.kind!==K.IfStatement||guard.elseStatement||condition?.kind!==K.Identifier||condition.name===flag||branch.length!==1||branch[0]?.kind!==K.ReturnStatement||branch[0].expression||matching.length!==1||decl.modifiers?.length||getTypeName(decl.type)!=='bool'||unwrap(decl.initializer)?.kind!==K.FalseKeyword||set?.kind!==K.ExpressionStatement||e?.kind!==K.BinaryExpression||e.operatorToken?.kind!==K.EqualsToken||e.left?.name!==condition.name||unwrap(e.right)?.kind!==K.TrueKeyword)return;
  variableGuard={function:allowed[1],flag:condition.name,prefixLength:i+2};
 }
 return {function:root,flag,calls,earlyStages,completionFlags:[flag,...(variableGuard?[variableGuard.flag]:[])],variableGuard,layout:'STANDARD_GUARDED_STAGES',sourceRootUnchanged:true};
}

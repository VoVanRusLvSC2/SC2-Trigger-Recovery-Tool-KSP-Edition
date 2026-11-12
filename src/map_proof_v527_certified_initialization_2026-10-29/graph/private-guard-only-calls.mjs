// A guard which only writes its own otherwise unobservable bool has no business
// effects. Keep its definition and storage; project only direct void call sites.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {partitionDeclarationViews,logicalSourcePath} from '../model/source-ownership.mjs';
import {removeAlreadyLoadedOwnedIncludes} from '../passes/owned-include-closure.mjs';
import {closedSourceFunctionReachability} from '../model/closed-source-function-reachability.typed-gui.mjs';
import {stockGuiNativeContracts} from '../bindings/stock-gui-native-contracts.typed.mjs';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=value=>createHash('sha256').update(value).digest('hex');
const un=node=>{while(node?.kind===K.ParenthesizedExpression)node=node.expression;return node;};
function walk(node,visit,owner){if(node.kind===K.FunctionDeclaration)owner=node;visit(node,owner);forEachChild(node,child=>walk(child,visit,owner));}
export function canonicalPrivateGuardOnlyCalls(source,context={}){
  const proof={kind:'PRIVATE_GUARD_ONLY_VOID_CALLS',edits:[],qualified:[],refused:[],sourceOrExportChanged:false,wholeMapAccepted:false,
    definitionsAndGlobalDeclarationsRetained:true,boundary:'Galaxy program business effects; debugger/profiler observation of private guard state and call frames is excluded.'};
  const unchanged=reason=>({text:source,proof:{...proof,reason}}),root={fileName:'MapScript.galaxy',text:source};
  const owned=context.ownedSources??[],views=partitionDeclarationViews(owned,context.externalSources??[]);if(views.conflicts.length)return unchanged('CONFLICTING_SOURCE_VIEWS');
  const closure=removeAlreadyLoadedOwnedIncludes({root,ownedSources:owned,externalSources:views.external,includeEvidence:context.includeEvidence??[],includeRoot:false}).proof;
  if(!closure.completeReachableClosure)return unchanged('INCOMPLETE_INCLUDE_CLOSURE');
  const reached=new Map(closure.resolvedFiles.map(file=>[logicalSourcePath(file.path),file.sha256])),files=[],seen=new Set();
  for(const file of [root,...owned,...views.external]){
    const fileName=logicalSourcePath(file.originalPath??file.fileName);if(!reached.has(fileName)||seen.has(fileName))continue;
    assert.equal(sha(file.text),reached.get(fileName));seen.add(fileName);const ast=parse(file.text,fileName);assert.equal(ast.parseDiagnostics.length,0);
    files.push({fileName,text:file.text,sha256:sha(file.text),ast,owned:true});
  }
  const contracts=context.nativeGuiLibraries?stockGuiNativeContracts(context.nativeGuiLibraries).contracts:new Map();
  const reachability=closedSourceFunctionReachability(files,contracts);if(reachability.issues.length)return unchanged('UNCLOSED_DISPATCH:'+reachability.issues.join(','));
  const names=new Map();for(const file of files)for(const node of file.ast.statements)if(node.name?.name){const rows=names.get(node.name.name)??[];rows.push({node,file});names.set(node.name.name,rows);}
  const rootFile=files.find(file=>file.fileName===logicalSourcePath(root.fileName));assert(rootFile);
  const candidates=new Map();
  for(const [name,rows]of names){
    const bodies=rows.filter(row=>row.node.kind===K.FunctionDeclaration&&row.node.body),fn=bodies[0]?.node;
    if(bodies.length!==1||rows.some(({node})=>node.kind!==K.FunctionDeclaration||node.parameters.length||node.type.kind!==K.VoidKeyword||node.modifiers?.length)||!fn||fn.body.statements.length!==2)continue;
    const [guard,set]=fn.body.statements,flag=un(guard.expression),branch=guard.thenStatement?.statements,store=un(set.expression);
    if(guard.kind!==K.IfStatement||guard.elseStatement||flag?.kind!==K.Identifier||branch?.length!==1||branch[0].kind!==K.ReturnStatement||branch[0].expression||
      set.kind!==K.ExpressionStatement||store?.kind!==K.BinaryExpression||store.operatorToken.kind!==K.EqualsToken||un(store.left)?.kind!==K.Identifier||un(store.left).name!==flag.name||un(store.right)?.kind!==K.TrueKeyword)continue;
    const globals=names.get(flag.name)??[],declaration=globals[0]?.node;
    if(globals.length!==1||declaration.kind!==K.VariableDeclaration||declaration.type.kind!==K.BoolKeyword||declaration.modifiers?.length||declaration.initializer&&un(declaration.initializer)?.kind!==K.FalseKeyword)continue;
    let observed=false;
    for(const file of files)walk(file.ast,node=>{
      if(node.kind===K.Identifier&&node.name===flag.name&&node!==declaration.name&&node!==flag&&node!==un(store.left))observed=true;
      if(node.kind===K.StringLiteral){const value=readStringLiteralValue(node.text);if(!value||value.value.includes(flag.name))observed=true;}
    });
    if(observed){proof.refused.push({function:name,flag:flag.name,reason:'FLAG_HAS_ANOTHER_OBSERVER_OR_STRING_REFERENCE'});continue;}
    const evidence={function:name,flag:flag.name,functionSource:{fileName:bodies[0].file.fileName,sha256:bodies[0].file.sha256,start:fn.pos,end:fn.end},
      noPayloadStatements:true,noOtherFlagObserver:true,privateBooleanStateOnly:true};
    proof.qualified.push(evidence);candidates.set(name,evidence);
  }
  walk(rootFile.ast,(node,owner)=>{
    const call=node.kind===K.ExpressionStatement&&un(node.expression),name=call?.expression?.kind===K.Identifier&&call.expression.name;
    if(call?.kind!==K.CallExpression||call.arguments.length||!candidates.has(name))return;
    let shadowed=false;if(owner){if(owner.parameters.some(parameter=>parameter.name.name===name))shadowed=true;walk(owner.body,child=>{if(child.kind===K.VariableDeclaration&&child.name.name===name)shadowed=true;});}
    if(shadowed)return;
    proof.edits.push({start:node.pos,end:node.end,before:source.slice(node.pos,node.end),replacement:'',callee:candidates.get(name)});
  });
  proof.edits.sort((a,b)=>a.start-b.start);let delta=0;
  for(const edit of proof.edits){edit.newStart=edit.start+delta;delta-=edit.end-edit.start;}
  let text=source;for(const edit of proof.edits.toReversed())text=text.slice(0,edit.start)+text.slice(edit.end);
  let inverse=text;for(const edit of proof.edits.toReversed())inverse=inverse.slice(0,edit.newStart)+edit.before+inverse.slice(edit.newStart);
  assert.equal(inverse,source);assert.equal(parse(text,'private-guard-view').parseDiagnostics.length,0);
  return {text,proof:{...proof,closure,sourceSha256:sha(source),viewSha256:sha(text),files:files.map(({ast,text,...file})=>file)}};
}

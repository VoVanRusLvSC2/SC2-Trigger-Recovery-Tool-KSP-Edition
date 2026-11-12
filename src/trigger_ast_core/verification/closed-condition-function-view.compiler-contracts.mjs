import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {bindTriggerPhaseParameters} from '../analysis/bound-trigger-phase-parameters.mjs';
import {triggerRejectionGuards} from '../analysis/trigger-rejection-guards.mjs';
import {planClosedConditionRegion} from '../model/closed-condition-region.mjs';
import {partitionDeclarationViews,logicalSourcePath} from '../model/source-ownership.mjs';
import {removeAlreadyLoadedOwnedIncludes} from '../passes/owned-include-closure.mjs';
import {closedSourceFunctionReachability} from '../model/closed-source-function-reachability.compiler-contracts.mjs';
import {stockGuiNativeContracts} from '../bindings/stock-gui-native-contracts.typed.mjs';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=x=>createHash('sha256').update(x).digest('hex');
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const walk=(node,visit)=>{visit(node);forEachChild(node,child=>{walk(child,visit);});};
const returned=(n,kind)=>{if(n?.kind===K.Block&&n.statements.length===1)n=n.statements[0];return n?.kind===K.ReturnStatement&&un(n.expression)?.kind===kind;};
const bodies=ast=>ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body);

// Re-outline only an original nonstandard rejecting phase, not arbitrary new
// functions. The resulting complete source view still needs the unchanged oracle.
export function projectClosedConditionFunctions(before,after,context={}) {
  const proof={kind:'CLOSED_CONDITION_FUNCTION_SOURCE_VIEW',regions:[],edits:[],sourceOrExportChanged:false,
    wholeMapAccepted:false,boundary:'Ordinary same-thread Galaxy calls; private call-frame/debugger/profiler observations excluded.'};
  const unchanged=reason=>({before,after,proof:{...proof,reason}});
  const source=parse(before,'MapScript.galaxy'),candidate=parse(after,'candidate.galaxy');
  assert(!source.parseDiagnostics.length&&!candidate.parseDiagnostics.length);
  const originalOwned=context.ownedSources??[],views=partitionDeclarationViews(originalOwned,context.externalSources??[]);
  if(views.conflicts.length)return unchanged('CONFLICTING_INCLUDE_SOURCES');
  const closure=removeAlreadyLoadedOwnedIncludes({root:{fileName:'MapScript.galaxy',text:before},ownedSources:originalOwned,
    externalSources:views.external,includeEvidence:context.includeEvidence??[],includeRoot:false}).proof;
  if(!closure.completeReachableClosure)return unchanged('INCOMPLETE_INCLUDE_CLOSURE');
  const reached=new Map(closure.resolvedFiles.map(f=>[logicalSourcePath(f.path),f.sha256])),files=[],seen=new Set();
  for(const input of [{fileName:'MapScript.galaxy',text:before,owned:true},...originalOwned.map(f=>({...f,owned:true})),...views.external]){
    const fileName=logicalSourcePath(input.originalPath??input.fileName);if(!reached.has(fileName)||seen.has(fileName))continue;
    assert.equal(sha(input.text),reached.get(fileName));seen.add(fileName);
    files.push({fileName,text:input.text,sha256:sha(input.text),owned:input.owned===true,ast:fileName==='MapScript.galaxy'?source:parse(input.text,fileName)});
  }
  const contracts=context.nativeGuiLibraries?stockGuiNativeContracts(context.nativeGuiLibraries).contracts:new Map();
  const dispatch=closedSourceFunctionReachability(files,contracts,{compilerQualification:context.compilerQualification});
  proof.compilerContracts=dispatch.compilerContracts;proof.functionReferences=dispatch.functionReferences;proof.dispatchIssueSites=dispatch.issueSites;proof.referenceContextFailure=dispatch.referenceContextFailure;
  if(dispatch.issues.length)return unchanged('UNCLOSED_DISPATCH:'+dispatch.issues.join(','));
  const names=new Set(),constructors=new Set();
  for(const file of files)for(const node of file.ast.statements){
    if(node.name?.name)names.add(node.name.name);
    if(node.kind===K.FunctionDeclaration&&!node.body&&node.modifiers?.some(m=>m.kind===K.NativeKeyword)&&
      node.type.kind===K.TriggerKeyword&&node.parameters.length===1&&node.parameters[0].type.kind===K.StringKeyword)constructors.add(node.name.name);
  }
  for(const contract of dispatch.compilerContracts??[])if(contract.returnType==='trigger'&&JSON.stringify(contract.parameterTypes)===JSON.stringify(['string']))constructors.add(contract.name);
  let dynamic=false;
  for(const node of [...dispatch.reachable,...dispatch.initializers])walk(node,n=>{
    if(n.kind===K.CallExpression&&constructors.has(n.expression?.name)&&
      (n.arguments.length!==1||un(n.arguments[0])?.kind!==K.StringLiteral))dynamic=true;
  });
  if(dynamic)return unchanged('DYNAMIC_TRIGGER_CALLBACK_NAME');
  const byName=new Map();for(const fn of bodies(candidate)){const list=byName.get(fn.name.name)??[];list.push(fn);byName.set(fn.name.name,list);}
  const helpers=[],edits=[],usedHelpers=new Set();
  try{
    for(const fn of bodies(source)){
      const candidates=byName.get(fn.name.name)??[];if(candidates.length!==1)continue;
      let sourceGuards,exportGuards;
      try{sourceGuards=bindTriggerPhaseParameters(fn);exportGuards=bindTriggerPhaseParameters(candidates[0]);}catch{continue;}
      const guards=(f,b)=>f.body.statements.filter(s=>s.kind===K.IfStatement&&!s.elseStatement&&b.isTestCondsGuard(s.expression));
      const original=guards(fn,sourceGuards),generated=guards(candidates[0],exportGuards);
      if(original.length!==generated.length)continue;
      const head=fn.body.statements.findIndex(s=>s.kind===K.IfStatement&&(sourceGuards.isTestCondsGuard(s.expression)||sourceGuards.isRunActionsGuard(s.expression)));
      const prefixNodes=fn.body.statements.slice(0,head),declarations=prefixNodes.filter(n=>n.kind===K.VariableDeclaration);
      const initializers=declarations.filter(n=>n.initializer).map(n=>({name:n.name.name,expression:n.initializer}));
      for(const n of prefixNodes)if(n.kind===K.ExpressionStatement&&n.expression.kind===K.BinaryExpression&&n.expression.operatorToken.kind===K.EqualsToken&&un(n.expression.left)?.kind===K.Identifier)
        initializers.push({name:un(n.expression.left).name,expression:n.expression.right});
      for(let index=0;index<original.length;index++){
        const guard=original[index];if(triggerRejectionGuards(guard.thenStatement))continue;
        const list=generated[index].thenStatement?.statements;if(list?.length!==1)continue;
        const rejection=list[0],not=un(rejection.expression),call=not?.kind===K.PrefixUnaryExpression&&not.operator.kind===K.ExclamationToken&&un(not.operand);
        if(rejection.kind!==K.IfStatement||rejection.elseStatement||!returned(rejection.thenStatement,K.FalseKeyword)||call?.kind!==K.CallExpression||call.arguments.length||call.expression.kind!==K.Identifier)continue;
        const name=call.expression.name,definitions=byName.get(name)??[],helper=definitions[0];
        if(names.has(name)||usedHelpers.has(name)||definitions.length!==1||helper.type.kind!==K.BoolKeyword||helper.parameters.length||helper.modifiers?.length)continue;
        assert(returned(helper.body.statements.at(-1),K.TrueKeyword),'CONDITION_FUNCTION_FINAL_TRUE_REQUIRED');
        let observed=false;
        walk(candidate,n=>{
          if(n.kind===K.Identifier&&n.name===name&&n!==call.expression){
            const parent=n.parent;
            if(!(parent?.kind===K.FunctionDeclaration&&parent.name===n&&parent.type.kind===K.BoolKeyword&&parent.parameters.length===0))observed=true;
          }
          if(n.kind===K.StringLiteral){const value=readStringLiteralValue(n.text);if(!value||value.value.includes(name))observed=true;}
        });
        for(const file of files)walk(file.ast,n=>{if(n.kind===K.StringLiteral){const value=readStringLiteralValue(n.text);if(!value||value.value.includes(name))observed=true;}});
        assert(!observed,'CONDITION_FUNCTION_HAS_ANOTHER_OBSERVER');
        const plan=planClosedConditionRegion(fn,guard,{length:head,declarations,initializers});
        const localNames=new Set(plan.localNames),moved=[...plan.locals];
        for(const node of prefixNodes)if(node.kind===K.ExpressionStatement&&node.expression.kind===K.BinaryExpression&&
          node.expression.operatorToken.kind===K.EqualsToken&&localNames.has(un(node.expression.left)?.name))moved.push(node);
        const body=[...moved,...plan.region.statements].map(n=>before.slice(n.pos,n.end)).join('\n');
        helpers.push({name,text:'bool '+name+' () {\n'+body+'\nreturn true;\n}'});usedHelpers.add(name);
        for(const node of moved)edits.push({start:node.pos,end:node.end,before:before.slice(node.pos,node.end),replacement:''});
        edits.push({start:plan.region.pos,end:plan.region.end,before:before.slice(plan.region.pos,plan.region.end),replacement:'{ if (!'+name+'()) { return false; } }'});
        proof.regions.push({...plan.proof,helper:name,uniqueDirectCall:true,literalFunctionNameObservationAbsent:true,necessaryTransparentGuiFunctions:1});
      }
    }
  }catch(error){return unchanged('REGION_PROOF_REFUSED:'+error.message);}
  if(!helpers.length)return unchanged('NO_QUALIFIED_NONSTANDARD_REGION');
  const prototypeAt=source.statements.find(n=>n.kind===K.FunctionDeclaration)?.pos??before.length;
  edits.push({start:prototypeAt,end:prototypeAt,before:'',replacement:helpers.map(h=>'bool '+h.name+' ();').join('\n')+'\n'});
  edits.push({start:before.length,end:before.length,before:'',replacement:'\n'+helpers.map(h=>h.text).join('\n')+'\n'});
  edits.sort((a,b)=>a.start-b.start||a.end-b.end);
  for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start,'CONDITION_VIEW_OVERLAPPING_EDITS');
  let text=before,delta=0;
  for(const e of edits){e.newStart=e.start+delta;delta+=e.replacement.length-(e.end-e.start);}
  for(const e of [...edits].reverse()){assert.equal(text.slice(e.start,e.end),e.before);text=text.slice(0,e.start)+e.replacement+text.slice(e.end);}
  let inverse=text;for(const e of [...edits].reverse()){assert.equal(inverse.slice(e.newStart,e.newStart+e.replacement.length),e.replacement);inverse=inverse.slice(0,e.newStart)+e.before+inverse.slice(e.newStart+e.replacement.length);}
  assert.equal(inverse,before);assert.equal(parse(text,'condition-function-source-view').parseDiagnostics.length,0);
  return {before:text,after,proof:{...proof,edits,closure,files:files.map(({ast,text,...file})=>file),
    sourceSha256:sha(before),proofInputSha256:sha(text),exportSha256:sha(after),byteInverseVerified:true,
    addedOrdinaryFunctions:helpers.map(h=>h.name),numericOrEffectfulLocalInitializersNeverInvented:true}};
}

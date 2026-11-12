import assert from 'node:assert/strict';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {createHash} from 'node:crypto';
import {planClosedConditionRegion} from '../model/closed-condition-region.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';

// Explicitly permitted, necessary GUI function; never a Native descriptor or a
// ScriptCode template. Locals retain their qualified IDs under their new owner.
export function recoverClosedConditionFunction({declaration,guard,prefix,ctx,allocateId,lower}) {
  const plan=planClosedConditionRegion(declaration,guard,prefix);
  let id,name;
  const names=new Set(Object.values(ctx.elements).filter(e=>e.type==='FunctionDef').map(e=>e.identifier??e.name));
  do{id=allocateId();name='ConditionRegion_'+id;}while(ctx.elements[id]||names.has(name));
  const localMap=new Map(),variables=[],initializers=[];
  for(const localName of plan.localNames){
    const localId=ctx.localVarByGalaxyName.get(localName),variable=ctx.elements[localId];
    assert(variable?.type==='Variable'&&variable.library===ctx.libId,'CONDITION_REGION_GUI_LOCAL_IDENTITY');
    localMap.set(localName,localId);variables.push({type:'Variable',library:ctx.libId,id:localId});
    const value=prefix.initializers.find(row=>row.name===localName)?.expression;
    if(value&&!variable.isConstant){
      variable.initialValue=undefined;
      const left={kind:K.Identifier,name:localName,pos:value.pos,end:value.end};
      initializers.push({kind:K.ExpressionStatement,pos:value.pos,end:value.end,
        expression:{kind:K.BinaryExpression,left,right:value,operatorToken:{kind:K.EqualsToken,pos:value.pos,end:value.pos},pos:value.pos,end:value.end}});
    }

  }
  const scope={...ctx,isUserFunction:true,containingTriggerBody:false,returnType:'bool',
    localVarByGalaxyName:localMap,paramRefByGalaxyName:new Map(),structuredLocals:variables,structuredTemplates:new Map(),
    pendingAutoInits:new Map(),pendingAutoEnds:new Map(),pendingAutoIncrements:new Map(),
    structuredFunctionStatements:[...initializers,...guard.thenStatement.statements]};
  const success=parse('bool Success(){return true;}','condition-success').statements[0].body.statements[0];
  const actions=lower([...initializers,...guard.thenStatement.statements,success],scope);
  const definition={type:'FunctionDef',id,library:ctx.libId,name,identifier:name,flags:['Call'],
    isFuncCall:true,isFuncAction:false,returnType:{type:'bool'},parameters:[],localVariables:variables,actions};
  assert(!ctx.elements[id]);ctx.elements[id]=definition;
  const movedIds=new Set(variables.map(ref=>ref.id));
  for(let index=ctx.structuredLocals.length-1;index>=0;index--)if(movedIds.has(ctx.structuredLocals[index].id))ctx.structuredLocals.splice(index,1);
  const callId=allocateId();assert(!ctx.elements[callId]);
  ctx.elements[callId]={type:'FunctionCall',id:callId,library:ctx.libId,functionDef:{type:'FunctionDef',library:ctx.libId,id},parameters:[]};
  const source=ctx.sourceText?.slice(plan.region.pos,plan.region.end);
  return {condition:{type:'FunctionCall',library:ctx.libId,id:callId},
    record:{...plan.proof,helper:{type:'FunctionDef',library:ctx.libId,id},
      movedVariableIds:[...movedIds],explicitLocalInitializers:initializers.length,sourceRegionSha256:source===undefined?undefined:createHash('sha256').update(source).digest('hex'),
      necessaryTransparentGuiFunctions:1,newRuntimeFunctions:1,newNative:0,newCustomScript:0}};
}

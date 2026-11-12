import {boundSourceAggregateAccess} from '../bindings/bound-source-access.lvalues.mjs';
import {resolvePreservedSourceAggregate} from '../bindings/preserved-source-aggregate-interfaces.discarded-results.mjs';
import {sourceAggregateScript} from '../bindings/preserved-source-aggregate-contract.discarded-results.mjs';
import {markGeneratedStructuredTemplate} from '../model/structured-template-liveness.scoped.mjs';
import {SyntaxKind as K,tokenToString} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const assignments=new Set(['=','+=','-=','*=','/=','%=']);
function carrier(type,ctx,tools){
 const own={id:ctx.libId,elements:ctx.elements,elementsByType:{}},libraries=new Map(ctx.dependencyLibraries??[]);if(ctx.nativeLibrary)libraries.set(ctx.nativeLibrary.id,ctx.nativeLibrary);libraries.set(ctx.libId,own);
 try{return tools.mapType(type,own,ctx.nativeLibrary,libraries);}catch{return undefined;}
}
function guiType(source,hint,ctx,tools){
 const candidates=[typeof hint==='string'?{type:hint}:hint,tools.triggerType(source,ctx)];
 return candidates.find(t=>t?.type&&!['any','anyvariable','sameas','sameasparent','return','void'].includes(t.type)&&carrier(t,ctx,tools)===source);
}
function definition(access,type,operator,ctx,tools){
 const indexNames=Array.from({length:access.indexCount},(_,i)=>'index'+(i+1)),write=access.mode==='write';
 const scriptCode=sourceAggregateScript(access,indexNames,write?'value':undefined,operator);
 const key='preserved-source-aggregate:'+JSON.stringify([ctx.libId,access.root.owner,access.root.declarationSha256,access.members.map(m=>m.declarationSha256),type,scriptCode]);
 const definitions=ctx.structuredTemplates??=new Map();let result=definitions.get(key);
 if(result)return result;
 const id=tools.generateId(),parameters=[...indexNames,...(write?['value']:[])].map(name=>{
  const id=tools.generateId();ctx.elements[id]={type:'ParamDef',id,library:ctx.libId,name,paramType:name==='value'?type:{type:'int'}};
  return{type:'ParamDef',id,library:ctx.libId};
 });
 const name=access.root.name+access.steps.filter(s=>s.kind==='member').map(s=>'.'+s.name).join('');
 result={type:'FunctionDef',id,library:ctx.libId,name:(write?'Set ':'')+name,displayName:(write?'Set ':'')+name,
  parameters,returnType:write?{type:'void'}:type,scriptCode,flags:[write?'Action':'Call','Operator'],...(write?{isFuncAction:true}:{isFuncCall:true})};
 ctx.elements[id]=result;definitions.set(key,result);markGeneratedStructuredTemplate(result);return result;
}
function written(node){
 let parent=node.parent;while(parent?.kind===K.ParenthesizedExpression){node=parent;parent=parent.parent;}
 return parent?.kind===K.BinaryExpression&&parent.left===node&&assignments.has(tokenToString(parent.operatorToken?.kind))||[K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(parent?.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(parent.operator?.kind);
}
export function buildPreservedSourceAggregateRead(node,expression,ctx,role,tools,expectedType){
 if(!expression||written(node))return undefined;
 const binding=boundSourceAggregateAccess(node),access=resolvePreservedSourceAggregate(binding);if(!access)return undefined;
 const type=guiType(access.elementType,expectedType,ctx,tools);if(!type)return undefined;
 const def=definition(access,type,undefined,ctx,tools);
 return tools.mkFCRef({functionDef:tools.fdRef(def),parameters:binding.indices.map((index,i)=>tools.param(index,ctx,def.parameters[i])),...(role?{subFunctionType:role}:{})},ctx);
}
export function buildPreservedSourceAggregateWrite(expression,role,ctx,tools){
 if(expression?.kind!==K.BinaryExpression)return undefined;
 const operator=tokenToString(expression.operatorToken?.kind);if(!assignments.has(operator))return undefined;
 const binding=boundSourceAggregateAccess(expression.left,{mode:'write'}),access=resolvePreservedSourceAggregate(binding);if(!access)return undefined;
 if(operator!=='='&&(!['int','byte','fixed','string'].includes(access.elementType)||access.elementType==='string'&&operator!=='+='||access.elementType==='fixed'&&operator==='%='))return undefined;
 const type=guiType(access.elementType,tools.valueType?.(expression.right,ctx),ctx,tools);if(!type)return undefined;
 const def=definition(access,type,operator,ctx,tools),values=[...binding.indices,expression.right];
 return tools.mkFCRef({functionDef:tools.fdRef(def),parameters:values.map((value,i)=>tools.param(value,ctx,def.parameters[i])),...(role?{subFunctionType:role}:{})},ctx);
}

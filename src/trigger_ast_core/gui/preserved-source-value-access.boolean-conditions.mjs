import {buildPreservedSourceAggregateRead,buildPreservedSourceAggregateWrite} from './preserved-source-aggregate-access.boolean-conditions.mjs';
import {boundSourceValueRead} from '../bindings/bound-source-call-return.values.mjs';
import {resolvePreservedSourceValue} from '../bindings/preserved-source-aggregate-interfaces.boolean-conditions.mjs';

// Inline metadata for a source-owned scalar read. Its array base is not a
// fake scalar function; all axes stay in this one expression, evaluated once.
export function buildPreservedSourceValueRead(node,expression,ctx,role,tools,expectedType){
 if(!expression){const value=node?.kind===138?node.expression:node;const write=buildPreservedSourceAggregateWrite(value,role,ctx,{...tools,param:tools.structuredParam});if(write)return write;}
 const aggregate=buildPreservedSourceAggregateRead(node,expression,ctx,role,{...tools,param:tools.structuredParam},expectedType);if(aggregate)return aggregate;
 if(!expression)return undefined;
 const binding=boundSourceValueRead(node),source=resolvePreservedSourceValue(binding);
 if(!source)return undefined;
 const returnType=tools.triggerType(source.elementType,ctx);
 if(!returnType||['any','anyvariable','sameas','return','void'].includes(returnType.type))return undefined;
 const scriptCode=source.name+binding.indices.map((_,i)=>`[#PARAM(index${i+1})]`).join('');
 const key='preserved-source-value:'+JSON.stringify([ctx.libId,source.owner,source.declarationSha256,returnType,scriptCode]);
 const definitions=ctx.structuredTemplates??=new Map();let definition=definitions.get(key);
 if(!definition){
  const id=tools.generateId();
  const parameters=binding.indices.map((_,i)=>{
   const id=tools.generateId();ctx.elements[id]={type:'ParamDef',id,library:ctx.libId,name:`index${i+1}`,paramType:{type:'int'}};
   return {type:'ParamDef',library:ctx.libId,id};
  });
  definition={type:'FunctionDef',id,library:ctx.libId,name:source.name,displayName:source.name,
   parameters,returnType,scriptCode,flags:['Call','Operator'],isFuncCall:true};
  ctx.elements[id]=definition;definitions.set(key,definition);
 }
 return tools.mkFCRef({functionDef:tools.fdRef(definition),parameters:binding.indices.map((index,i)=>tools.structuredParam(index,ctx,definition.parameters[i])),
  ...(role?{subFunctionType:role}:{})},ctx);
}

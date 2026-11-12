import {sourceStorageGuiType} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/gui/source-storage-value-domain.mjs';
import {buildPreservedSourceAggregateRead,buildPreservedSourceAggregateWrite} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v513_qualified_macro_binding_2026-10-28/graph/25951804beb5-b2168d5-5c4573575aad-93f3f2cc7180-preserved-source-aggregate-access.boolean-conditions.mjs';
import {boundSourceValueRead} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v477_bound_static_primary_storage_2026-10-27/graph/69e8fe7095fc-8726dff6f220-275fab4f952d-709110eecf5b-bound-source-access.authored.mjs';
import {resolvePreservedSourceValue} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v513_qualified_macro_binding_2026-10-28/graph/a506df8d48df-cf88a612c59b-42749245fb9e-7869a6b4d2ab-08a5b9f23ba2-source-storage-resolution.authored.mjs';

// Inline metadata for a source-owned scalar read. Its array base is not a
// fake scalar function; all axes stay in this one expression, evaluated once.
export function buildPreservedSourceValueRead(node,expression,ctx,role,tools,expectedType){
 if(!expression){const value=node?.kind===138?node.expression:node;const write=buildPreservedSourceAggregateWrite(value,role,ctx,{...tools,param:tools.structuredParam});if(write)return write;}
 const aggregate=buildPreservedSourceAggregateRead(node,expression,ctx,role,{...tools,param:tools.structuredParam},expectedType);if(aggregate)return aggregate;
 if(!expression)return undefined;
 const binding=boundSourceValueRead(node),source=resolvePreservedSourceValue(binding);
 if(!source)return undefined;
 const returnType=sourceStorageGuiType(source.elementType,expectedType,ctx,tools);
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
   parameters,returnType,scriptCode,flags:['Call','Operator','NoScriptPrefix'],isFuncCall:true};
  ctx.elements[id]=definition;definitions.set(key,definition);
 }
 return tools.mkFCRef({functionDef:tools.fdRef(definition),parameters:binding.indices.map((index,i)=>tools.structuredParam(index,ctx,definition.parameters[i])),
  ...(role?{subFunctionType:role}:{})},ctx);
}

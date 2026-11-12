import {createHash} from 'node:crypto';
import {createGalaxyDocument} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e735afc2fd5b-galaxy-document.collections.mjs';
import {checkPreservedSourceFunctionInterface} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v513_qualified_macro_binding_2026-10-28/graph/16313089e1b8-282687e7450e-9c9ffdc78977-preserved-source-member-contract.boolean-conditions.mjs';
import {SyntaxKind as K,Printer} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
const printer=new Printer(),sha=s=>createHash('sha256').update(s).digest('hex');

export function indexOriginalFunctionPrototypes(root){
 const result=new Map(),doc=createGalaxyDocument(root);
 try{for(const node of doc.ast.statements){
  if(node.kind!==K.FunctionDeclaration||node.body||node.modifiers?.some(m=>[K.NativeKeyword,K.StaticKeyword].includes(m.kind)))continue;
  const name=node.name.name,row={name,returnType:printer.printNode(node.type),
   parameters:node.parameters.map(p=>({type:printer.printNode(p.type),isReference:!!p.isReference})),
   sourceFile:root.fileName,sourceSha256:sha(root.text),prototypeSha256:sha(root.text.slice(node.pos,node.end))};
  const rows=result.get(name)??[];rows.push(row);result.set(name,rows);
 }}finally{doc.dispose();}
 return result;
}

/** Complete only a bodyless GUI placeholder backed by one original prototype
 * and one preserved owned include body. It is an inline call interface, not a
 * new runtime function, Native declaration or duplicate source body. */
export function restorePreservedPrototypeInterfaces({elements,library,index,prototypes,carrier}){
 const restored=[];
 for(const e of new Set(Object.values(elements))){
  if(e.type!=='FunctionDef'||e.library!==library||!e.unresolvedGuiBinding||e.nativeDeclarationOnly||e.scriptCode?.trim()||e.expressionCode!==undefined||
   e.actions?.length||e.localVariables?.length||e.subFunctionTypes?.length||e.isSubFunction||e.disabled||(e.flags??[]).some(flag=>flag!=='NoScriptPrefix'))continue;
  const candidates=prototypes.get(e.name)??[],resolved=index.resolve(e.name);
  if(candidates.length!==1||resolved.status!=='UNIQUE_SIMPLE_ABI')continue;
  const proto=candidates[0],source=resolved.definition;
  if(e.isFuncAction&&source.returnType!=='void'||e.isFuncCall&&source.returnType==='void')continue;
  if(proto.returnType!==source.returnType||proto.parameters.length!==source.parameters.length||
   proto.parameters.some((p,i)=>p.isReference||p.type!==source.parameters[i].type||source.parameters[i].isReference))continue;
  const params=(e.parameters??[]).map(ref=>elements['ParamDef:'+ref.id]??elements[ref.id]);
  if(params.some(p=>!p||typeof p.name!=='string'||!/^[A-Za-z_]\w*$/u.test(p.name)))continue;
  const proposed={...e,returnType:e.returnType??{type:source.returnType},flags:['Operator','NoScriptPrefix',source.returnType==='void'?'Action':'Call'],
   scriptCode:`${source.name}(${params.map(p=>`#PARAM(${p.name})`).join(', ')})${source.returnType==='void'?';':''}`};
  try{
   const proof=checkPreservedSourceFunctionInterface(index,proposed,elements,library,carrier);
   const previousUnresolved=e.unresolvedGuiBinding;
   Object.assign(e,{returnType:proposed.returnType,flags:proposed.flags,scriptCode:proposed.scriptCode});
   delete e.unresolvedGuiBinding;
   restored.push({kind:'ORIGINAL_PROTOTYPE_TO_PRESERVED_BODY_INTERFACE',prototype:proto,body:source,interface:proof.interface,
    previousUnresolved,newNative:false,newRuntimeFunction:false,bodyDuplicated:false,originalSourceChanged:false});
  }catch{/* An unproven ABI leaves the original placeholder for the strict gate. */}
 }
 return restored;
}

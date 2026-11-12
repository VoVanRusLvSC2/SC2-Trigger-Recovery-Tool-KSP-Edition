/** Preserve the literal API spelled in source. NO Deprecated/modern
 * equivalence is assumed. A loaded native companion + exact operator macro
 * only proves the expression's GUI type, not that another call is equivalent.
 */
import {printNode} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v258_bound_typedef_abi_2026-10-20/graph/0facdb3525fc37a5-script-template.mjs';
export function explicitLegacyAccessor(node,ctx){
 while(node?.kind===126)node=node.expression;
 if(node?.kind!==121||node.expression?.kind!==113||node.arguments?.length!==0)return;
 const name=node.expression.name;if(!name.endsWith('Deprecated'))return;
 const definition=ctx.funcNameToFuncDef.get(name),modern=ctx.funcNameToFuncDef.get(name.slice(0,-10));
 if(!definition?.flags?.includes('Native')||definition.name!==name||definition.parameters?.length!==0||
  !modern?.flags?.includes('Operator')||modern.library!==definition.library||modern.parameters?.length!==0||
  modern.returnType?.type!==definition.returnType?.type||definition.returnType?.typeElement||
  !/^\s*#AUTOVAR\(\s*[^,()]+\s*,\s*ancestor:([^()]+?)\s*\)\s*$/u.test(modern.scriptCode??''))return;
 const type=definition.returnType?.type;if(!['int','unit','bool','fixed','playergroup','unitgroup'].includes(type))return;
 return {scriptCode:printNode(node),valueType:{type}};
}

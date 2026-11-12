import {resolveNativeRoleWithLibrary} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v294_shared_native_formal_abi_2026-10-22/graph/3f2bfb75364e-native-library-declaration-binding.mjs";
import {getTypeName,unwrapParens} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/39db0c9c9123-ae8e39bac3e6-0131c278e7d7-3449b17ca5f9-174ab517065c-g2t-core.generated-call-provenance.mjs";
import {SyntaxKind as K,forEachChild} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js";

export function loadedNativeEventRegistration(call,handle,session,nativeLibraryId) {
 const callee=unwrapParens(call?.expression),target=unwrapParens(call?.arguments?.[0]);
 if(call?.kind!==K.CallExpression||callee?.kind!==K.Identifier||target?.kind!==K.Identifier||target.name!==handle||!session)return undefined;
 const program=session.program;
 if(program.getBinding(callee).status!=='BOUND'||program.conflictingDeclarationNames().includes(callee.name))return undefined;
 const declaration=program.declarationAt(callee);
 if(declaration?.kind!==K.FunctionDeclaration||declaration.body||!declaration.modifiers?.some(m=>m.kind===K.NativeKeyword))return undefined;
 let source=declaration;while(source.parent)source=source.parent;
 const owner=program.verifiedInputIdentity(source.fileName);
 if(owner?.owned!==false||!owner.contentSha256)return undefined;
 const signature={returnType:getTypeName(declaration.type),parameters:[...declaration.parameters].map(p=>getTypeName(p.type))};
 if(signature.parameters.length!==call.arguments.length)return undefined;
 const resolution=resolveNativeRoleWithLibrary(session.candidates,{name:callee.name,declaration:signature},'Event',nativeLibraryId);
 return resolution.status==='RESOLVED'?resolution.definition:undefined;
}

/** This promotion is limited to the current owned source, after every call
 * was independently proved to be registration in a valid generated _Init.
 * Mixed Action/Event use retains the original global ambiguity.
 */
export function eventOnlyNativeSymbols(statements,eventBindings) {
 const calls=new Map();
 const visit=node=> {
  if(node?.kind===K.CallExpression&&unwrapParens(node.expression)?.kind===K.Identifier) {
   const name=unwrapParens(node.expression).name,group=calls.get(name)??[];group.push(node);calls.set(name,group);
  }
  forEachChild(node,visit);
 };
 for(const statement of statements)visit(statement);
 const result=new Map();
 for(const [name,group] of calls) {
  if(!group.length||group.some(call=>!eventBindings.has(call)))continue;
  const definitions=group.map(call=>eventBindings.get(call));
  const identities=new Set(definitions.map(d=>`${d.library}:FunctionDef:${d.id}`));
  if(identities.size===1)result.set(name,definitions[0]);
 }
 return result;
}

import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
const fail=reason=>({status:'UNPROVEN',reason,guiBindingAuthorized:false});

/** Resolve typedef chains using the existing nominal binder. This view grants
 * no GUI binding and does not erase reference/array shape or invent a carrier.
 * Every alias is tied to a verified source and lexical declaration identity. */
export function resolveBoundTypeAlias(program,type) {
 if(typeof program?.verifiedInputIdentity!=='function')return fail('VERIFIED_TYPE_CONTEXT_REQUIRED');
 const seen=new Set(),aliases=[];let node=type;
 while(node?.kind===K.Identifier) {
  if(aliases.length>=64)return fail('TYPE_ALIAS_DEPTH');
  const binding=program.getBinding(node),declaration=program.declarationAt(node);
  if(binding.status!=='BOUND'||!declaration)return fail('TYPE_ALIAS_NOT_BOUND');
  if(declaration.kind!==K.TypedefDeclaration) {
   if(declaration.kind!==K.StructDeclaration)return fail('TYPE_NAME_IS_NOT_A_TYPE');
   const where=program.location(declaration);
   if(!where?.contentSha256||program.verifiedInputIdentity(where.sourceFile)?.contentSha256!==where.contentSha256)return fail('NOMINAL_TYPE_SOURCE_NOT_VERIFIED');
   return {status:'RESOLVED',node,nominal:declaration,aliases,guiBindingAuthorized:false};
  }
  if(seen.has(declaration))return fail('TYPE_ALIAS_CYCLE');seen.add(declaration);
  const where=program.location(declaration);
  if(!where?.contentSha256||program.verifiedInputIdentity(where.sourceFile)?.contentSha256!==where.contentSha256)return fail('TYPE_ALIAS_SOURCE_NOT_VERIFIED');
  aliases.push({...where,name:declaration.name.name,symbolId:binding.symbolId});node=declaration.type;
 }
 if(!node||!program.location(node)?.contentSha256)return fail('TYPE_ORIGIN_NOT_VERIFIED');
 return {status:'RESOLVED',node,aliases,guiBindingAuthorized:false};
}

export function resolveBoundStructref(program,type) {
 const shape=resolveBoundTypeAlias(program,type);if(shape.status!=='RESOLVED')return shape;
 if(shape.node.kind!==K.MappedType||shape.node.returnType?.kind!==K.StructrefKeyword||shape.node.typeArguments?.length!==1)
  return fail('TYPE_IS_NOT_STRUCTREF');
 const target=resolveBoundTypeAlias(program,shape.node.typeArguments[0]);
 if(target.status!=='RESOLVED'||target.nominal?.kind!==K.StructDeclaration)return fail('STRUCTREF_TARGET_NOT_NOMINAL');
 return {status:'RESOLVED_STRUCTREF',node:target.node,nominal:target.nominal,aliases:[...shape.aliases,...target.aliases],guiBindingAuthorized:false};
}

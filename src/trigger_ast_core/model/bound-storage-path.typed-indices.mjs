import {SyntaxKind as K,Printer} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const printer=new Printer();
const un=node=>{while(node?.kind===K.ParenthesizedExpression)node=node.expression;return node;};
const fail=(reason,detail={})=>({status:'UNPROVEN',reason,...detail,guiBindingAuthorized:false});
const origin=(program,node)=>{
  let root=node;while(root?.parent)root=root.parent;
  const input=root&&program.verifiedInputIdentity(root.fileName);
  return input&&{sourceFile:root.fileName,sourceId:input.sourceId,contentSha256:input.contentSha256,start:node.pos,end:node.end};
};
// An expression has no declaration symbol: literals and arithmetic legitimately
// have UNKNOWN binding status while their checker carrier is integer. Check the
// expression tree and all lexical operands instead of demanding a root symbol.
function integerIndex(program,expression,depth=0) {
  const node=un(expression);if(!node||depth>64)return false;
  const binding=program.getBinding(node),where=program.location(node);
  if(binding.carrier!=='int'||!where?.contentSha256)return false;
  if(node.kind===K.NumericLiteral)return Number.isInteger(Number(node.text??node.value));
  if(node.kind===K.Identifier)return binding.status==='BOUND';
  if(node.kind===K.PrefixUnaryExpression)return [K.PlusToken,K.MinusToken,K.TildeToken].includes(node.operator?.kind)&&integerIndex(program,node.operand,depth+1);
  if(node.kind===K.BinaryExpression)return [K.PlusToken,K.MinusToken,K.AsteriskToken,K.SlashToken,K.PercentToken,K.LessThanLessThanToken,K.GreaterThanGreaterThanToken,K.AmpersandToken,K.BarToken,K.CaretToken].includes(node.operatorToken.kind)&&integerIndex(program,node.left,depth+1)&&integerIndex(program,node.right,depth+1);
  return false;
}
const referent=type=>type?.kind===K.MappedType&&type.returnType?.kind===K.StructrefKeyword&&type.typeArguments?.length===1?type.typeArguments[0]:type;

/** Exact lexical storage, including a structref formal. No source-owned/global
 * shortcut is applied: every member comes from the real binder declaration. */
export function resolveBoundStorage(program,node,{mode='read'}={}) {
  if(typeof program?.verifiedInputIdentity!=='function'||!['read','write','reference'].includes(mode))return fail('VERIFIED_STORAGE_CONTEXT_REQUIRED');
  const path=[];let base=un(node);
  while([K.PropertyAccessExpression,K.ElementAccessExpression].includes(base?.kind)) {
    if(path.length>=64)return fail('STORAGE_PATH_LIMIT');path.unshift(base);base=un(base.expression);
  }
  if(base?.kind!==K.Identifier)return fail('STORAGE_ROOT_NOT_LVALUE');
  const binding=program.getBinding(base),root=program.declarationAt(base),where=root&&origin(program,root);
  if(binding.status!=='BOUND'||![K.VariableDeclaration,K.ParameterDeclaration].includes(root?.kind)||!where?.contentSha256)return fail('STORAGE_ROOT_NOT_BOUND');
  const writable=mode!=='read',constant=n=>n.modifiers?.some(m=>m.kind===K.ConstKeyword);
  if(writable&&constant(root))return fail('READONLY_STORAGE',{root:where});
  let type=referent(root.type);const steps=[];
  for(const access of path) {
    if(access.kind===K.ElementAccessExpression) {
      const index=program.location(access.argumentExpression);
      if(type?.kind!==K.ArrayType)return fail('INDEX_ON_NONARRAY',{root:where,steps});
      if(!index?.contentSha256||!integerIndex(program,access.argumentExpression))return fail('INDEX_TYPE_OR_ORIGIN_UNPROVEN',{root:where,steps});
      steps.push({kind:'index',extent:printer.printNode(type.size),index});type=referent(type.elementType);
    }else {
      const member=program.declarationAt(access),memberBinding=program.getBinding(access),structure=member?.parent;
      const nominal=program.declarationAt(type);
      if(memberBinding.status!=='BOUND'||member?.kind!==K.PropertyDeclaration||structure?.kind!==K.StructDeclaration||nominal!==structure)
        return fail('MEMBER_OWNER_OR_TYPE_UNPROVEN',{root:where,steps,member:access.name?.name,expected:printer.printNode(type)});
      const location=origin(program,member);if(!location?.contentSha256)return fail('MEMBER_ORIGIN_UNPROVEN',{root:where,steps});
      if(writable&&constant(member))return fail('READONLY_MEMBER',{root:where,steps,member:location});
      steps.push({kind:'member',name:member.name.name,structure:origin(program,structure),declaration:location});type=referent(member.type);
    }
  }
  if(type?.kind===K.MappedType)return fail('UNSUPPORTED_STORAGE_REFERENCE_KIND',{root:where,steps});
  return {status:'BOUND_STORAGE',root:{...where,name:root.name.name,symbolId:binding.symbolId,
    kind:root.kind===K.ParameterDeclaration?'parameter':root.parent?.kind===K.SourceFile?'global':'local',
    throughStructref:referent(root.type)!==root.type},steps,type:printer.printNode(type),
    structure:program.declarationAt(type)?.kind===K.StructDeclaration?origin(program,program.declarationAt(type)):undefined,
    mode,guiBindingAuthorized:false,newRuntimeFunctions:0,newNative:0,newCustomScript:0};
}

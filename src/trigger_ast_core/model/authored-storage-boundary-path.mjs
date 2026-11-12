import {resolveBoundStorage} from './bound-storage-path.type-aliases.mjs';
import {SyntaxKind as K,tokenToString} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const assignments=new Set(['=','+=','-=','*=','/=','%=','&=','|=','^=','<<=','>>=']);
export function storageExpressionAt(identifier){
 let node=identifier;
 while([K.PropertyAccessExpression,K.ElementAccessExpression,K.ParenthesizedExpression].includes(node?.parent?.kind)&&node.parent.expression===node)node=node.parent;
 return node;
}
export function sourceStorageUseMode(node){
 while(node?.parent?.kind===K.ParenthesizedExpression)node=node.parent;
 const parent=node?.parent;
 if(parent?.kind===K.BinaryExpression&&parent.left===node){const op=tokenToString(parent.operatorToken?.kind);if(assignments.has(op))return op==='='?'write':'readwrite';}
 if([K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(parent?.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(parent.operator?.kind))return 'readwrite';
 return 'read';
}

// Reuse the common alias-aware storage resolver; boundary ownership adds only
// the global/value-role fence. This cannot authorize a GUI/raw representation.
export function boundSourceStoragePath(program,expression,{mode=sourceStorageUseMode(expression)}={}){
 const refused=reason=>({status:'UNPROVED',reason,guiEmissionAuthorized:false});
 if(!['read','write','readwrite'].includes(mode))return refused('UNSUPPORTED_STORAGE_ROLE');
 const storage=resolveBoundStorage(program,expression,{mode:mode==='read'?'read':'write'});
 if(storage.status!=='BOUND_STORAGE')return refused(storage.reason);
 if(storage.root.kind!=='global')return refused('STORAGE_ROOT_NOT_VERIFIED_GLOBAL');
 let argument=expression;while(argument.parent?.kind===K.ParenthesizedExpression)argument=argument.parent;
 if(argument.parent?.kind===K.CallExpression){
  const call=argument.parent,index=call.arguments.indexOf(argument),formal=program.declarationAt(call.expression)?.parameters?.[index];
  if(index>=0&&(!formal||formal.isReference||formal.type?.kind===K.MappedType))return refused('REFERENCE_OR_UNKNOWN_ARGUMENT_ROLE');
 }
 if(storage.structure||!/^[_A-Za-z]\w*$/u.test(storage.type)||storage.type==='void')return refused('COMPLETE_SCALAR_STORAGE_REQUIRED');
 return {...storage,status:'EXACT_BOUND_SCALAR_STORAGE',elementType:storage.type,mode,guiEmissionAuthorized:false};
}

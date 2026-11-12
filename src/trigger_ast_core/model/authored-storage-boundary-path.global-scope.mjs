export {storageExpressionAt,sourceStorageUseMode} from './authored-storage-boundary-path.mjs';
import {boundSourceStoragePath as resolve} from './authored-storage-boundary-path.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
export function boundSourceStoragePath(program,expression,options){
 const result=resolve(program,expression,options);
 if(result.status!=='EXACT_BOUND_SCALAR_STORAGE')return result;
 let base=expression;
 while([K.PropertyAccessExpression,K.ElementAccessExpression,K.ParenthesizedExpression].includes(base?.kind))base=base.expression;
 if(program.declarationAt(base)?.modifiers?.some(m=>m.kind===K.StaticKeyword))
  return {status:'UNPROVED',reason:'STATIC_STORAGE_SCOPE_NOT_SUPPORTED',guiEmissionAuthorized:false};
 return result;
}

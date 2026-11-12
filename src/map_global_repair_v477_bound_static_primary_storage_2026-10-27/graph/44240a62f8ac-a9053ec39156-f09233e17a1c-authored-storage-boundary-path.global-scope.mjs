export {storageExpressionAt,sourceStorageUseMode} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v452_source_axes_integrated_2026-10-26/graph/90303d079013-28a40be9b7dd-authored-storage-boundary-path.mjs';
import {boundSourceStoragePath as resolve} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v452_source_axes_integrated_2026-10-26/graph/90303d079013-28a40be9b7dd-authored-storage-boundary-path.mjs';
import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
export function boundSourceStoragePath(program,expression,options){
 const result=resolve(program,expression,options);
 if(result.status!=='EXACT_BOUND_SCALAR_STORAGE')return result;
 let base=expression;
 while([K.PropertyAccessExpression,K.ElementAccessExpression,K.ParenthesizedExpression].includes(base?.kind))base=base.expression;
 const declaration=program.declarationAt(base);
 if(!declaration?.modifiers?.some(m=>m.kind===K.StaticKeyword))return result;
 // Static storage is callable through an inline GUI expression only in the
 // same verified source unit. The outer owner/interface proof is still required.
 const owner=program.location(declaration),use=program.location(expression);
 if(!owner||!use||owner.sourceFile!==use.sourceFile||owner.contentSha256!==use.contentSha256||
   program.verifiedInputIdentity(owner.sourceFile)?.contentSha256!==owner.contentSha256)
  return {status:'UNPROVED',reason:'STATIC_STORAGE_CROSS_UNIT_OR_UNVERIFIED_SCOPE',guiEmissionAuthorized:false};
 return {...result,staticScopeProof:{sourceFile:owner.sourceFile,contentSha256:owner.contentSha256,
  declarationStart:declaration.pos,declarationEnd:declaration.end,useStart:expression.pos,useEnd:expression.end,
  sameVerifiedSourceUnit:true,guiEmissionAuthorized:false}};
}

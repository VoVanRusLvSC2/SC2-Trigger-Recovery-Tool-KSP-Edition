import {storageExpressionAt as storageRootExpression} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v452_source_axes_integrated_2026-10-26/graph/90303d079013-28a40be9b7dd-authored-storage-boundary-path.mjs';
import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
export {boundSourceStoragePath,sourceStorageUseMode} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v477_bound_static_primary_storage_2026-10-27/graph/44240a62f8ac-a9053ec39156-f09233e17a1c-authored-storage-boundary-path.global-scope.mjs';

// A bound field name denotes its complete property expression. Starting from
// the field token alone would lose the actual receiver and nominal owner.
export function storageExpressionAt(identifier){
 const parent=identifier.parent;
 return storageRootExpression(parent?.kind===K.PropertyAccessExpression&&parent.name===identifier?parent:identifier);
}

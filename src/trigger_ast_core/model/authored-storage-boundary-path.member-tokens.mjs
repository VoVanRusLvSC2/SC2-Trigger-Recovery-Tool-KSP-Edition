import {storageExpressionAt as storageRootExpression} from './authored-storage-boundary-path.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
export {boundSourceStoragePath,sourceStorageUseMode} from './authored-storage-boundary-path.global-scope.mjs';

// A bound field name denotes its complete property expression. Starting from
// the field token alone would lose the actual receiver and nominal owner.
export function storageExpressionAt(identifier){
 const parent=identifier.parent;
 return storageRootExpression(parent?.kind===K.PropertyAccessExpression&&parent.name===identifier?parent:identifier);
}

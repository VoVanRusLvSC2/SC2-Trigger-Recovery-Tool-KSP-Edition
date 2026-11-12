import {storageExpressionAt as storageRootExpression} from "../source-axes-integrated/authored-storage-boundary-path.mjs";
import {SyntaxKind as K} from "../exact-function-signatures/index-alternate-3.js";
export {boundSourceStoragePath,sourceStorageUseMode} from "./authored-storage-boundary-path.global-scope.mjs";

// A bound field name denotes its complete property expression. Starting from
// the field token alone would lose the actual receiver and nominal owner.
export function storageExpressionAt(identifier){
 const parent=identifier.parent;
 return storageRootExpression(parent?.kind===K.PropertyAccessExpression&&parent.name===identifier?parent:identifier);
}

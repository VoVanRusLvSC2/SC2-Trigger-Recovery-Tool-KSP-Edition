import { SyntaxKind as K } from '../sdk/array-values/modules/galaxy/language-core/index.js';

// Intrinsic function-local storage has no source-level allocating constructor.
// This is a storage predicate, not permission to remove initializers or uses.
export function isIntrinsicScalarType(type) {
  return (
    typeof type?.kind === 'number' &&
    type.kind >= K.BoolKeyword &&
    type.kind <= K.WavetargetKeyword &&
    type.kind !== K.VoidKeyword
  );
}

// Keep nominal/ref/dynamic arrays opaque. In particular, a runtime extent or
// initializer must never be moved across another effect by this predicate.
export function isPassiveFixedIntrinsicArrayDeclaration(node) {
  if (node.initializer || node.modifiers?.length || node.type?.kind !== K.ArrayType) return false;
  let type = node.type;
  while (type?.kind === K.ArrayType) {
    const extent = type.size?.kind === K.NumericLiteral ? Number(type.size.text) : NaN;
    if (!Number.isSafeInteger(extent) || extent <= 0 || extent > 2147483647) return false;
    type = type.elementType;
  }
  return isIntrinsicScalarType(type);
}

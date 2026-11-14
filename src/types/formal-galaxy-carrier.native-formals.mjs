// A NativeLib unit reference is not a unit value. This same ABI rule is used
// for binding and for generated forward declarations; ordinary GUI functions
// keep their own parameter contracts.
export function nativeFormalGalaxyCarrier(formal, definition, carrier) {
  if (
    definition?.flags?.includes('Native') &&
    formal?.isReference === true &&
    formal.paramType?.type === 'unit' &&
    carrier === 'unit'
  )
    return 'unitref';
  return carrier;
}
export function formalGalaxyCarrier(index, formal, owner, definition) {
  return nativeFormalGalaxyCarrier(formal, definition, index.carrier(formal.paramType, owner));
}

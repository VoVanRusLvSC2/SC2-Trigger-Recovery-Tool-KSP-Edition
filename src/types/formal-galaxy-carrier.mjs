// A GUI value's carrier and a native formal's ABI are distinct contracts.
// NativeLib represents unitref as Type=unit plus ParamFlagReference. Preserve
// the original ParamDef; only signature comparison uses its effective ABI.
export function formalGalaxyCarrier(index, formal, owner, definition) {
  if (
    definition.flags?.includes('Native') &&
    formal?.isReference === true &&
    formal.paramType?.type === 'unit'
  )
    return 'unitref';
  return index.carrier(formal.paramType, owner);
}

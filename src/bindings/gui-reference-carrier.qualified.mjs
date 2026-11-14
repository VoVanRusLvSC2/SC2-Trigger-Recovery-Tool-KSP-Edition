/** Reference flags and GUI atom names do not certify the emitted ABI.
 * Classify the operand form before the native reference conversion; do not
 * invent a cast for ParamRef or Expression. Actual Editor rejects those unit
 * forms, including an ordinary ParamDef carrying ParamFlagReference. */
export function unitReferenceCarrier(param) {
  const shapes = [
    ['variable', param.variable],
    ['parameter', param.paramRef],
    ['call', param.functionCall],
    ['document', param.valueId ?? param.paramValueId],
    ['expression', param.expressionText ?? param.expressionCode],
  ].filter(([, v]) => v !== undefined);
  if (shapes.length !== 1)
    return {
      kind: 'UNPROVEN',
      reason: 'REFERENCE_OPERAND_CARRIER_UNQUALIFIED',
      shapes: shapes.map(([s]) => s),
    };
  switch (shapes[0][0]) {
    case 'variable':
      return { kind: 'STORAGE_REFERENCE' };
    case 'call':
    case 'document':
      return { kind: 'SNAPSHOT_VALUE' };
    case 'parameter':
      return {
        kind: 'UNPROVEN',
        reason: 'FORMAL_REFERENCE_ABI_UNQUALIFIED',
        formal: param.paramRef,
      };
    default:
      return { kind: 'UNPROVEN', reason: 'EXPRESSION_CANNOT_SUPPLY_UNIT_REFERENCE' };
  }
}

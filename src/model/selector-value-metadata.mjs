// ValueTypeInfo describes the editor selector, never an extra runtime operand.
// reference 0/1 are native-emission controls R3448; other tags remain refused.
export function hasVerifiedSelectorMetadata(param, valueType, hasOperand) {
  if (param.valueTypeInfo === undefined) return true;
  const info = param.valueTypeInfo;
  if (hasOperand || !/^\d+$/u.test(info) || !Number.isSafeInteger(Number(info))) return false;
  if (valueType === 'reference')
    return (
      ['0', '1'].includes(info) && typeof param.value === 'string' && param.valueId === undefined
    );
  return ['filepath', 'abilcmd'].includes(valueType ?? '');
}

// Recover the GUI domain from an already resolved parameter contract. This is
// not an attribute definition/default resolver and never rewrites an owner ID.
const domains = new Set(['attributegame', 'attributeplayer']);
const operandFields = [
  'scriptCode',
  'expressionCode',
  'functionCall',
  'variable',
  'parameter',
  'preset',
  'valueElement',
  'structMember',
  'valueId',
];
function validId(value) {
  if (/["\u0000-\u001f\ufffe\uffff]/u.test(value)) return false;
  const plain = /^[1-9][0-9]{0,9}$/u;
  const match = /^\[bnet:([^\]\r\n\0]+)\]([1-9][0-9]{0,9})$/u.exec(value);
  const id = match?.[2] ?? value;
  if (!plain.test(id) || BigInt(id) > 4294967295n) return false;
  if (!match) return plain.test(value);
  // The title and local filename are opaque. Only require the actual wire
  // grammar, with no normalization, guessing, path access, or title matching.
  const owner = /^(.+)\/([0-9]+)\.([0-9]+)\/([0-9]+)(?:,file:([^\]\r\n\0]+))?$/u.exec(match[1]);
  return (
    !!owner &&
    BigInt(owner[2]) <= 65535n &&
    BigInt(owner[3]) <= 65535n &&
    BigInt(owner[4]) <= 4294967295n
  );
}
export function coerceAttributeSelectorDomain(data, expected) {
  if (!domains.has(expected) || data.valueType?.type !== 'string' || typeof data.value !== 'string')
    return false;
  if (
    operandFields.some((k) => data[k] !== undefined) ||
    data.valueParams?.length ||
    data.valuePresets?.length ||
    data.array?.length ||
    data.valueTypeInfo !== undefined
  )
    return false;
  if (!validId(data.value)) return false;
  // Retain semantic contents while definitions/owners are being bound. The
  // final serialization phase adds Editor delimiters after that binding.
  data.valueType = { type: expected };
  return true;
}
export function quoteAttributeSelectorScalar(data) {
  if (!domains.has(data.valueType?.type) || typeof data.value !== 'string') return false;
  if (
    operandFields.some((k) => data[k] !== undefined) ||
    data.valueParams?.length ||
    data.valuePresets?.length ||
    data.array?.length ||
    data.valueTypeInfo !== undefined ||
    !validId(data.value)
  )
    return false;
  // The actual forward codec strips outer delimiters only. JSON escaping here
  // would double filename backslashes and change the generated lookup string.
  data.value = '"' + data.value + '"';
  return true;
}

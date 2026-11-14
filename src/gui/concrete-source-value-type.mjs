// These are relational GUI schema terms, not concrete scalar return domains.
// Sharing an ABI carrier (e.g. anycompare -> int) does not make a term concrete.
const relational = new Set([
  'any',
  'anyvariable',
  'anycompare',
  'sameas',
  'sameasparent',
  'return',
  'void',
]);
export function isConcreteGuiValueType(type) {
  return (
    typeof type?.type === 'string' &&
    !relational.has(type.type) &&
    (type.type !== 'preset' || type.typeElement?.type === 'Preset')
  );
}

export function selectSourceValueType(source, hint, { fromGalaxy, carrier }) {
  const candidates = [typeof hint === 'string' ? { type: hint } : hint, fromGalaxy(source)];
  return candidates.find((type) => isConcreteGuiValueType(type) && carrier(type) === source);
}

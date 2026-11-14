/** One source map, all required independent packing variants. A variant error
 * is reported in its own scope and cannot erase the other required mode. */
export function attributeVariantModes(usesAttributes) {
  if (typeof usesAttributes !== 'boolean')
    throw new TypeError('Original attribute-presence proof must be boolean');
  return usesAttributes
    ? ['without-attribute-recovery', 'with-attribute-recovery']
    : ['without-attribute-recovery'];
}
export async function runVariantBatch(modes, run, onFailure) {
  if (
    !Array.isArray(modes) ||
    !modes.length ||
    new Set(modes).size !== modes.length ||
    modes.some((mode) => !['without-attribute-recovery', 'with-attribute-recovery'].includes(mode))
  )
    throw new Error('Required variant scopes are invalid');
  const records = [];
  for (const mode of modes) {
    try {
      const result = await run(mode);
      if (result?.mode !== mode) throw new Error('Variant result escaped its assigned mode');
      records.push(result);
    } catch (error) {
      const result = await onFailure(mode, error);
      if (result?.mode !== mode || result.status !== 'VARIANT_FAILED')
        throw new Error('Variant failure lost its assigned scope');
      records.push(result);
    }
  }
  return records;
}

/** Canonicalize serialized GUI identity without discarding defined metadata.
 * XML omits the current library on typed references; object key order is not
 * identity. Explicit foreign owners and all other defined values stay exact. */
export function canonicalScopedGuiIdentity(value, library) {
  if (Array.isArray(value)) return value.map((item) => canonicalScopedGuiIdentity(item, library));
  if (value === null || typeof value !== 'object') return value;
  const fields = Object.entries(value).filter(([, item]) => item !== undefined);
  if (typeof value.type === 'string' && typeof value.id === 'string' && value.library === undefined)
    fields.push(['library', library]);
  return Object.fromEntries(
    fields
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonicalScopedGuiIdentity(item, library)]),
  );
}

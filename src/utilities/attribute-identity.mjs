// Runtime identity is owner + ID + domain. An equal decimal ID in a different
// domain/library is not evidence of the same attribute.
export const attributeDomains = Object.freeze({
  attributegame: 'Global',
  attributeplayer: 'Player',
});
export const attributeToken = (id) =>
  /^(?:0|[1-9]\d*)$/u.test(String(id)) ? String(id).padStart(4, '0') : String(id);
export function attributeIdentityCatalog(model) {
  const definitions = new Map();
  for (const definition of model?.attributes ?? []) {
    const id = String(definition.id);
    if (
      !/^(?:0|[1-9]\d*)$/u.test(id) ||
      !['Global', 'Player'].includes(definition.type) ||
      definitions.has(id)
    )
      throw Error('INVALID_ATTRIBUTE_IDENTITY_CATALOG');
    const tokens = (definition.values ?? []).map((v) => attributeToken(v.id));
    if (new Set(tokens).size !== tokens.length) throw Error('DUPLICATE_ATTRIBUTE_IDENTITY_TOKEN');
    definitions.set(id, { id, domain: definition.type, tokens: tokens.sort() });
  }
  return [...definitions.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

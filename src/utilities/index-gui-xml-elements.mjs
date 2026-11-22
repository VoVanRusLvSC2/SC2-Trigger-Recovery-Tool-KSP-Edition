const indexes = new WeakMap();

/** Typed identities of direct XML children, with duplicates retained in source order. */
export function indexGuiXmlElements(group) {
  const cached = indexes.get(group);
  if (cached) return cached;
  const entries = [];
  const byType = new Map();
  let duplicate = false;
  let missingIdentity = false;
  for (const node of group.children) {
    if (node.tag !== 'Element') continue;
    const { Type: type, Id: id } = node.attributes;
    entries.push(node);
    let entriesById = byType.get(type);
    if (!entriesById) byType.set(type, (entriesById = new Map()));
    if (entriesById.has(id)) duplicate = true;
    entriesById.set(id, node);
    if (!type || !id) missingIdentity = true;
  }
  const index = { entries, byType, duplicate, missingIdentity };
  // Cached XML trees are frozen recursively by the recovery parse scope.
  if (Object.isFrozen(group) && Object.isFrozen(group.children)) indexes.set(group, index);
  return index;
}

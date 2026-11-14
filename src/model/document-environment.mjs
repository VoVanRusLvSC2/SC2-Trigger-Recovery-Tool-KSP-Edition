/** A typed reference index owned by one immutable binding phase.
 * No module-global state, memoized conversion results, or persistent cache.
 * Documents with overlapping library IDs must use separate environments.
 */
export function createDocumentEnvironment(entries, { documentId = 'conversion' } = {}) {
  const libraries = new Map(),
    indexes = new Map(),
    issues = [];
  for (const [owner, library] of entries) {
    if (libraries.has(owner) && libraries.get(owner) !== library)
      throw Error('AMBIGUOUS_LIBRARY_OWNER: ' + owner);
    if (libraries.has(owner)) continue;
    libraries.set(owner, library);
    const types = new Map();
    for (const element of Object.values(library.elements ?? {})) {
      let byId = types.get(element.type);
      if (!byId) types.set(element.type, (byId = new Map()));
      if (byId.has(element.id) && byId.get(element.id) !== element)
        issues.push({
          kind: 'DUPLICATE_TYPED_ELEMENT',
          documentId,
          library: owner,
          type: element.type,
          id: element.id,
        });
      else byId.set(element.id, element);
    }
    indexes.set(owner, types);
  }
  const key = (ref, owner) =>
    JSON.stringify([ref.documentId ?? documentId, ref.library ?? owner, ref.type, ref.id]);
  const resolve = (ref, owner, type = ref?.type) => {
    if (!ref || (ref.documentId !== undefined && ref.documentId !== documentId)) return undefined;
    const scope = ref.library ?? owner;
    // Retain the established typed-table precedence and first fallback match.
    const table = libraries.get(scope)?.elementsByType?.[type];
    const preferred = table && Object.hasOwn(table, ref.id) ? table[ref.id] : undefined;
    return preferred ?? indexes.get(scope)?.get(type)?.get(ref.id);
  };
  return Object.freeze({
    documentId,
    issues: Object.freeze(issues),
    key,
    resolve,
    library: (owner) => libraries.get(owner),
    elements: (owner, type) => [...(indexes.get(owner)?.get(type)?.values() ?? [])],
  });
}

/** Adapt lossless XML nodes to the same typed reference model. Nodes retain
 * source spans; consumers must not reparse text to resolve each reference. */
export function createXmlEnvironment(root, { documentId = 'conversion' } = {}) {
  const libraries = new Map(),
    nodes = [];
  const visit = (node) => {
    if (node.tag === 'Element') {
      const owner = node.scope ?? '';
      let library = libraries.get(owner);
      if (!library) libraries.set(owner, (library = { id: owner, elements: {} }));
      const element = { type: node.attributes.Type, id: node.attributes.Id, library: owner, node };
      library.elements[nodes.length] = element;
      nodes.push(node);
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  const environment = createDocumentEnvironment(libraries, { documentId });
  const reference = (node, owner) => ({
    type: node.attributes.Type,
    id: node.attributes.Id,
    library: node.attributes.Library ?? owner,
  });
  return Object.freeze({
    ...environment,
    nodes: Object.freeze(nodes),
    resolveNode: (ref, node) =>
      ref && environment.resolve(reference(ref, node.scope ?? ''), node.scope ?? '')?.node,
  });
}

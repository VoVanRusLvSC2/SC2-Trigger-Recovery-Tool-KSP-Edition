// Bounded read-only graph context for a failed binding. Never changes a gate.
export function bindingIssueContext(elements, libId, issues, external = new Map()) {
  const key = (r, owner) => JSON.stringify([r.library ?? owner, r.type, r.id]),
    nodes = new Map(),
    incoming = new Map(),
    outgoing = new Map();
  for (const [id, l] of [...external, [libId, { elements }]])
    for (const e of Object.values(l.elements ?? {}))
      nodes.set(key(e, id), { library: id, element: e });
  function refs(v, owner, found) {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach((v) => refs(v, owner, found));
      return;
    }
    if (v.type && v.id) {
      found.add(key(v, owner));
      return;
    }
    for (const [k, x] of Object.entries(v))
      if (!['parent', 'xmlSource', 'rawXml'].includes(k)) refs(x, owner, found);
  }
  for (const [k, { library, element }] of nodes) {
    const found = new Set();
    for (const [n, v] of Object.entries(element))
      if (!['parent', 'xmlSource', 'rawXml'].includes(n)) refs(v, library, found);
    outgoing.set(k, found);
    for (const ref of found) {
      const a = incoming.get(ref) ?? new Set();
      a.add(k);
      incoming.set(ref, a);
    }
  }
  return [...new Set(issues.map((i) => i.id).filter(Boolean))].slice(0, 8).map((id) => {
    const start = key({ type: 'Param', id }, libId),
      seen = new Set([start]),
      pending = [{ k: start, depth: 0 }];
    while (pending.length && seen.size < 80) {
      const { k, depth } = pending.shift();
      if (depth >= 4) continue;
      for (const next of [...(outgoing.get(k) ?? []), ...(incoming.get(k) ?? [])])
        if (!seen.has(next) && seen.size < 80) {
          seen.add(next);
          pending.push({ k: next, depth: depth + 1 });
        }
    }
    return {
      id,
      nodes: [...seen]
        .map((k) => nodes.get(k))
        .filter(Boolean)
        .map(({ library, element }) => ({
          library,
          element: Object.fromEntries(
            Object.entries(element)
              .filter(([k]) => !['parent', 'xmlSource', 'rawXml'].includes(k))
              .map(([k, v]) => [
                k,
                typeof v === 'string' && v.length > 3000 ? v.slice(0, 3000) : v,
              ]),
          ),
        })),
    };
  });
}

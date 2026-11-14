// Read-only bounded diagnostics over Library/Type/Id. Never repairs a reference.
export function describeReferenceFailure(library, context, { limit = 128 } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1024)
    throw new RangeError('Invalid owner trace bound');
  let owner;
  try {
    owner = JSON.parse(context?.owner);
  } catch {
    return { reason: 'NO_TYPED_OWNER', diagnosticOnly: true };
  }
  if (!Array.isArray(owner) || owner.length !== 3)
    return { reason: 'NO_TYPED_OWNER', diagnosticOnly: true };
  const key = (ref) => JSON.stringify([ref.library ?? library.id, ref.type, ref.id]);
  const elements = new Map(),
    parents = new Map();
  for (const element of Object.values(library.elements ?? {})) elements.set(key(element), element);
  for (const [parent, element] of elements) {
    const pending = [...Object.values(element)],
      seen = new Set();
    while (pending.length) {
      const value = pending.pop();
      if (!value || typeof value !== 'object' || seen.has(value)) continue;
      seen.add(value);
      if (Array.isArray(value)) {
        pending.push(...value);
        continue;
      }
      if (typeof value.type === 'string' && typeof value.id === 'string') {
        const ref = key(value);
        if (!parents.has(ref)) parents.set(ref, new Set());
        parents.get(ref).add(parent);
      }
      pending.push(...Object.values(value));
    }
  }
  const queue = [{ key: JSON.stringify(owner), path: [] }],
    visited = new Set(),
    owners = [];
  const summary = (element) => ({
    type: element.type,
    library: element.library ?? library.id,
    id: element.id,
    name: element.name,
    identifier: element.identifier,
    variableType: element.variableType,
    flags: element.flags,
    initialValue: element.initialValue,
    localVariableCount: element.localVariables?.length,
  });
  while (queue.length && visited.size < limit) {
    const current = queue.shift();
    if (visited.has(current.key)) continue;
    visited.add(current.key);
    const element = elements.get(current.key),
      path = [...current.path, current.key];
    if (element && ['FunctionDef', 'Trigger', 'CustomScript', 'Structure'].includes(element.type)) {
      owners.push({ owner: summary(element), path });
      continue;
    }
    for (const parent of parents.get(current.key) ?? []) queue.push({ key: parent, path });
  }
  return {
    diagnosticOnly: true,
    library: library.id,
    elementCount: elements.size,
    missingReference: context?.reference,
    missingTargetPresent: context?.reference ? elements.has(key(context.reference)) : undefined,
    failedOwner: elements.has(JSON.stringify(owner))
      ? summary(elements.get(JSON.stringify(owner)))
      : null,
    owners,
    visited: visited.size,
    truncated: queue.length > 0,
  };
}

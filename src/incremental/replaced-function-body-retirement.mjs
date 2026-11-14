// Retire only the closed old expression/local graph of replaced user functions.
// Keeping an unowned old local would turn it into a global during SDK emission.
// Shared records stay; a shared local blocks migration instead of changing scope.
import assert from 'node:assert/strict';
const key = (r) => JSON.stringify([r.library, r.type, r.id]);
function refs(v, library, out = []) {
  if (Array.isArray(v)) {
    for (const x of v) refs(x, library, out);
  } else if (v && typeof v === 'object') {
    if (v.type && v.id) out.push({ library: v.library ?? library, type: v.type, id: v.id });
    else for (const x of Object.values(v)) refs(x, library, out);
  }
  return out;
}
export function planReplacedFunctionBodyRetirement(library, definitions) {
  const values = Object.values(library.elements),
    index = new Map(values.map((e) => [key({ ...e, library: e.library ?? library.id }), e]));
  const changed = new Set(definitions.map((e) => key({ ...e, library: e.library ?? library.id }))),
    locals = new Set();
  for (const def of definitions)
    for (const r of def.localVariables ?? []) {
      const k = key({ ...r, library: r.library ?? library.id });
      assert(!locals.has(k), 'INCREMENTAL_SHARED_OLD_LOCAL_OWNER');
      locals.add(k);
    }
  const candidates = new Set(),
    edges = new Map(),
    pending = definitions.flatMap((e) => refs([e.actions, e.localVariables], library.id));
  while (pending.length) {
    const r = pending.pop(),
      k = key(r);
    if (r.library !== library.id || candidates.has(k)) continue;
    if (!['FunctionCall', 'Param'].includes(r.type) && !(r.type === 'Variable' && locals.has(k)))
      continue;
    const e = index.get(k);
    assert(e, 'INCREMENTAL_OLD_BODY_REFERENCE_MISSING');
    candidates.add(k);
    const children = refs(
      Object.values(e).filter((v) => v && typeof v === 'object'),
      e.library ?? library.id,
    );
    edges.set(k, children);
    pending.push(...children);
  }
  const retained = new Set(),
    external = [];
  for (const e of values) {
    const k = key({ ...e, library: e.library ?? library.id });
    if (candidates.has(k)) continue;
    const fields = Object.entries(e)
      .filter(([f]) => !changed.has(k) || !['actions', 'localVariables'].includes(f))
      .map(([, v]) => v);
    external.push(...refs(fields, e.library ?? library.id));
  }
  external.push(...refs(library.items ?? [], library.id));
  const work = external;
  while (work.length) {
    const r = work.pop(),
      k = key(r);
    if (!candidates.has(k) || retained.has(k)) continue;
    retained.add(k);
    work.push(...(edges.get(k) ?? []));
  }
  assert(
    ![...locals].some((k) => retained.has(k)),
    'INCREMENTAL_SHARED_OLD_LOCAL_WOULD_CHANGE_SCOPE',
  );
  const removed = [...candidates]
    .filter((k) => !retained.has(k))
    .map((k) => {
      const [library, type, id] = JSON.parse(k);
      return { library, type, id };
    });
  return {
    removed,
    proof: {
      kind: 'CLOSED_REPLACED_FUNCTION_BODY_RETIREMENT',
      removed,
      retainedSharedRecords: retained.size,
      functionDefinitionsRemoved: 0,
      foldersRemoved: 0,
      unrelatedElementsRemoved: 0,
      sharedLocalsRejected: true,
    },
  };
}

// An incomplete disabled source call may be retained as editable GUI. Never
// grant this exemption to changed nodes or to any enabled structural path.
export function collectPreservedDisabledGuiCalls(libraries, original) {
  const key = (r, owner) => JSON.stringify([r.library ?? owner, r.type, r.id]);
  const elements = new Map(),
    old = new Map(),
    edges = new Map();
  for (const [owner, lib] of libraries)
    for (const e of Object.values(lib.elements ?? {})) elements.set(key(e, owner), { e, owner });
  for (const [owner, lib] of original)
    for (const e of Object.values(lib.elements ?? {})) old.set(key(e, owner), e);
  const referenceTypes = new Set(['FunctionCall', 'Param', 'Variable']);
  for (const [id, { e, owner }] of elements) {
    const refs = [];
    const walk = (value, root = false) => {
      if (!value || typeof value !== 'object') return;
      if (!root && referenceTypes.has(value.type) && value.id) {
        const target = key(value, owner);
        if (elements.has(target)) refs.push(target);
        return;
      }
      for (const child of Object.values(value))
        if (typeof child === 'object')
          if (Array.isArray(child)) child.forEach((x) => walk(x));
          else walk(child);
    };
    walk(e, true);
    edges.set(id, refs);
  }
  const queue = [];
  for (const [id, { e }] of elements)
    if (['Trigger', 'FunctionDef', 'Variable', 'ParamDef'].includes(e.type))
      queue.push({ id, disabled: false, unchanged: true });
  const seen = new Set(),
    enabled = new Set(),
    preserved = new Set();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const state = queue[cursor],
      entry = elements.get(state.id);
    if (!entry) continue;
    const disabled = state.disabled || entry.e.disabled === true;
    const unchanged =
      state.unchanged &&
      old.has(state.id) &&
      JSON.stringify(entry.e) === JSON.stringify(old.get(state.id));
    const visit = JSON.stringify([state.id, disabled, unchanged]);
    if (seen.has(visit)) continue;
    seen.add(visit);
    if (!disabled) enabled.add(state.id);
    else if (unchanged) preserved.add(state.id);
    for (const child of edges.get(state.id) ?? []) queue.push({ id: child, disabled, unchanged });
  }
  return {
    isPreservedDisabledCall(ref, owner) {
      const id = key(ref, owner);
      return ref.type === 'FunctionCall' && preserved.has(id) && !enabled.has(id);
    },
  };
}

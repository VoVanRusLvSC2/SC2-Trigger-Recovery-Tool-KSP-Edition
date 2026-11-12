const identity = (ref, owner) => ({type: ref.type, library: ref.library ?? owner, id: ref.id});
const key = ref => JSON.stringify([ref.library, ref.type, ref.id]);

/** All explicit choice domains. A dependent ParamDef TypeElement is NOT a Preset. */
export function formalPresetRefs(formal, owner = formal?.library) {
  const refs = formal?.paramType?.typeElement?.type === 'Preset'
    ? [formal.paramType.typeElement]
    : formal?.presets ?? (formal?.preset ? [formal.preset] : []);
  const unique = new Map();
  for (const ref of refs) {
    if (ref?.type !== 'Preset' || !ref.id) continue;
    const qualified = identity(ref, owner);
    unique.set(key(qualified), qualified);
  }
  return [...unique.values()];
}

/** Follow only declared membership/extension edges; never search values globally. */
export function presetDomain(ref, resolve) {
  const values = new Map(), visiting = new Set(), visited = new Set();
  let valid = true;
  function visit(current) {
    const id = key(current);
    if (visiting.has(id)) { valid = false; return; }
    if (visited.has(id)) return;
    const preset = resolve(current, current.library, 'Preset');
    if (!preset || preset.type !== 'Preset') { valid = false; return; }
    visiting.add(id);
    for (const member of preset.values ?? []) {
      const qualified = identity(member, current.library);
      const value = resolve(qualified, current.library, 'PresetValue');
      if (!value || value.type !== 'PresetValue') { valid = false; continue; }
      values.set(key(qualified), {ref: qualified, element: value});
    }
    if (preset.extends) visit(identity(preset.extends, current.library));
    visiting.delete(id); visited.add(id);
  }
  visit(ref);
  return {valid, values: [...values.values()]};
}

export function resolveFormalPresetScalar(formal, scalar, owner, resolve) {
  const matches = new Map();
  for (const ref of formalPresetRefs(formal, owner)) {
    const domain = presetDomain(ref, resolve);
    if (!domain.valid) return undefined;
    for (const value of domain.values) {
      if (value.element.value === scalar) matches.set(key(value.ref), value.ref);
    }
  }
  // Equal script text does not prove equal GUI identity. Keep ambiguity explicit.
  return matches.size === 1 ? [...matches.values()][0] : undefined;
}

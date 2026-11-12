// Event ownership includes the stock Register Events subtree. Merely linking an
// Event from an Action/value slot does not supply an implicit target trigger.
export function auditGuiEventCallOwnership(libraries, externalLibraries = new Map()) {
  const all = new Map([...externalLibraries, ...libraries]), uses = new Map(), issues = [];
  const key = (ref, owner) => `${ref.library ?? owner}:${ref.type}:${ref.id}`;
  const resolve = (ref, owner) => ref && (all.get(ref.library ?? owner)?.elementsByType?.[ref.type]?.[ref.id]
    ?? all.get(ref.library ?? owner)?.elements?.[ref.id]);
  let functionCalls = 0, eventCalls = 0, eventSlots = 0, registeredEventSlots = 0;
  for (const [owner, library] of libraries) for (const element of Object.values(library.elements ?? {})) {
    const visit = (value, field) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach((child, i) => visit(child, `${field}[${i}]`)); return; }
      if (value !== element && value.type === 'FunctionCall' && typeof value.id === 'string') {
        const id = key(value, owner), rows = uses.get(id) ?? [];
        rows.push({element, owner, field}); uses.set(id, rows);
        if (element.type === 'Trigger' && /^events\[\d+\]$/u.test(field)) {
          eventSlots++;
          const call = resolve(value, owner), definition = resolve(call?.functionDef, call?.library ?? owner);
          if (!definition?.flags?.includes('Event')) issues.push({kind: 'EVENT_SLOT_WITHOUT_EVENT_DEFINITION', call: id});
        }
      }
      for (const [name, child] of Object.entries(value)) if (!['xmlSource', 'rawXml', 'parent'].includes(name))
        visit(child, field ? `${field}.${name}` : name);
    };
    visit(element, '');
  }
  function actionContext(call, owner, visiting = new Set()) {
    const id = key(call, owner);
    if (visiting.has(id)) return false;
    const parents = uses.get(id) ?? [];
    if (!parents.length) return false;
    const next = new Set(visiting).add(id);
    return parents.every(({element, owner: parentOwner, field}) => {
      if (element.type === 'Trigger') return /^actions\[\d+\]$/u.test(field);
      if (element.type === 'FunctionDef') return element.flags?.includes('Event') && /^actions\[\d+\]$/u.test(field);
      if (element.type !== 'FunctionCall' || !/^subFunctions\[\d+\]$/u.test(field)) return false;
      const definition = resolve(element.functionDef, parentOwner), childRole = call.subFunctionType;
      const declared = childRole && definition?.subFunctionTypes?.find(r => key(r, definition.library ?? parentOwner) === key(childRole, call.library ?? owner));
      const role = resolve(declared, definition?.library ?? parentOwner);
      return role?.isAction === true && actionContext(element, parentOwner, next);
    });
  }
  function registeredOwner(call, use) {
    const {element: container, owner, field} = use;
    if (container.type !== 'FunctionCall' || !/^subFunctions\[\d+\]$/u.test(field)) return false;
    const definition = resolve(container.functionDef, owner), childRole = call.subFunctionType;
    if (!definition?.flags?.includes('Action') || definition.scriptCode || !childRole) return false;
    const roles = (definition.subFunctionTypes ?? []).map(r => resolve(r, definition.library ?? owner));
    return roles.length > 0 && roles.every(r => r?.isEvent === true) &&
      roles.some(r => key(r, definition.library ?? owner) === key(childRole, call.library ?? owner)) &&
      actionContext(container, owner);
  }
  for (const [owner, library] of libraries) for (const call of Object.values(library.elements ?? {})) {
    if (call.type !== 'FunctionCall') continue;
    functionCalls++;
    const definition = resolve(call.functionDef, owner), id = key(call, owner);
    if (!definition) { issues.push({kind: 'UNRESOLVED_CALL_DEFINITION', call: id}); continue; }
    if (!definition.flags?.includes('Event')) continue;
    eventCalls++;
    const parents = uses.get(id) ?? [];
    if (!parents.length) issues.push({kind: 'EVENT_CALL_WITHOUT_TRIGGER_OWNER', call: id});
    for (const use of parents) {
      if (use.element.type === 'Trigger' && /^events\[\d+\]$/u.test(use.field)) continue;
      if (registeredOwner(call, use)) { registeredEventSlots++; continue; }
      issues.push({kind: 'EVENT_CALL_IN_ORDINARY_GUI_SLOT', call: id, owner: key(use.element, use.owner), field: use.field});
    }
  }
  return {passed: issues.length === 0, functionCalls, eventCalls, eventSlots, registeredEventSlots, issues,
    scope: 'Event tree ownership including declared Event subroles and current-trigger/custom-event context; no arbitrary target or runtime equivalence claim.'};
}

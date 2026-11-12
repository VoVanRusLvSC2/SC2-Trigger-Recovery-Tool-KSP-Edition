// Read-only audit of the implicit trigger ABI. Event calls belong directly to
// Trigger.events; an ordinary action or parameter cannot supply that owner.
export function auditGuiEventCallOwnership(libraries, externalLibraries = new Map()) {
  const all = new Map([...externalLibraries, ...libraries]), issues = [], uses = new Map();
  const key = (r, owner) => `${r.library ?? owner}:${r.type}:${r.id}`;
  const resolve = (r, owner) => all.get(r.library ?? owner)?.elementsByType?.[r.type]?.[r.id]
    ?? all.get(r.library ?? owner)?.elements?.[r.id];
  let eventCalls = 0, eventSlots = 0, functionCalls = 0;
  for (const [owner, library] of libraries) for (const element of Object.values(library.elements ?? {})) {
    function visit(value, field) {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) { value.forEach((v, i) => visit(v, `${field}[${i}]`)); return; }
      if (value !== element && value.type === 'FunctionCall' && typeof value.id === 'string') {
        const id = key(value, owner), rows = uses.get(id) ?? [];
        rows.push({owner: key(element, owner), type: element.type, field}); uses.set(id, rows);
        if (element.type === 'Trigger' && /^events\[\d+\]$/u.test(field)) {
          eventSlots++;
          const call = resolve(value, owner), definition = call?.functionDef && resolve(call.functionDef, call.library ?? owner);
          if (!definition?.flags?.includes('Event')) issues.push({kind: 'EVENT_SLOT_WITHOUT_EVENT_DEFINITION', call: id, field});
        }
      }
      for (const [name, child] of Object.entries(value)) if (!['xmlSource', 'rawXml', 'parent'].includes(name))
        visit(child, field ? `${field}.${name}` : name);
    }
    visit(element, '');
  }
  for (const [owner, library] of libraries) for (const call of Object.values(library.elements ?? {})) {
    if (call.type !== 'FunctionCall') continue;
    functionCalls++;
    const definition = call.functionDef && resolve(call.functionDef, owner);
    if (!definition) { issues.push({kind: 'UNRESOLVED_CALL_DEFINITION', call: key(call, owner)}); continue; }
    if (!definition.flags?.includes('Event')) continue;
    eventCalls++;
    const id = key(call, owner), owners = uses.get(id) ?? [];
    if (!owners.length) issues.push({kind: 'EVENT_CALL_WITHOUT_TRIGGER_OWNER', call: id});
    for (const use of owners) if (use.type !== 'Trigger' || !/^events\[\d+\]$/u.test(use.field))
      issues.push({kind: 'EVENT_CALL_IN_ORDINARY_GUI_SLOT', call: id, ...use});
  }
  return {passed: issues.length === 0, functionCalls, eventCalls, eventSlots, issues,
    scope: 'Event versus ordinary GUI ownership only; not complete type checking or runtime proof.'};
}

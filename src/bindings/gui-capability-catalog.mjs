/** A conversion-owned view of existing GUI definitions. This catalog never
 * invents a FunctionDef, target parameter, carrier or script implementation. */
export function createGuiCapabilityCatalog(entries) {
  const libraries = new Map(),
    elements = new Map(),
    capabilityElements = [],
    issues = [];
  // IDs are local to a library and element kind.
  for (const [owner, library] of entries) {
    if (libraries.has(owner)) {
      if (libraries.get(owner) !== library) issues.push({ kind: 'AMBIGUOUS_LIBRARY_OWNER', owner });
      continue;
    }
    libraries.set(owner, library);
    const byType = new Map();
    elements.set(owner, byType);
    const conflictingElements = new Set();
    for (const group of [library.elements ?? {}, ...Object.values(library.elementsByType ?? {})])
      for (const element of Object.values(group)) {
        let byId = byType.get(element.type);
        if (!byId) byType.set(element.type, (byId = new Map()));
        const previous = byId.get(element.id);
        // The ordinary typed index repeats the same objects as the flat
        // index. Keep an identity set only for the ambiguous definitions.
        if (previous === element || (previous === null && conflictingElements.has(element)))
          continue;
        if (
          (element.type === 'ParamDef' && element.paramType?.type === 'struct') ||
          (element.type === 'FunctionDef' && element.flags?.includes('SubFunctions'))
        )
          capabilityElements.push([owner, element]);
        if (byId.has(element.id)) {
          if (previous !== null) conflictingElements.add(previous);
          conflictingElements.add(element);
          byId.set(element.id, null);
          issues.push({
            kind: 'AMBIGUOUS_TYPED_GUI_ELEMENT',
            owner,
            type: element.type,
            id: element.id,
          });
        } else byId.set(element.id, element);
        if (element.library !== undefined && element.library !== owner)
          issues.push({ kind: 'GUI_OWNER_MISMATCH', owner, type: element.type, id: element.id });
      }
  }
  const invalidOwners = new Set(
    issues.filter((i) => i.kind === 'AMBIGUOUS_LIBRARY_OWNER').map((i) => i.owner),
  );
  // Ambiguous owners and duplicate typed definitions deliberately do not resolve.
  function resolve(ref, owner, expectedType = ref?.type) {
    if (!ref || !expectedType || (ref.type !== undefined && ref.type !== expectedType))
      return undefined;
    const library = ref.library ?? owner;
    if (invalidOwners.has(library)) return undefined;
    const element = elements.get(library)?.get(expectedType)?.get(ref.id);
    return element && (element.library === undefined || element.library === library)
      ? element
      : undefined;
  }
  // These are catalog capabilities, not proof that a runtime event can be
  // rewritten. Call sites still need to establish the target and argument ABI.
  const eventContainers = [],
    structureFormals = [];
  for (const [owner, e] of capabilityElements) {
    if (
      elements.get(owner).get(e.type).get(e.id) !== e ||
      invalidOwners.has(owner) ||
      (e.library !== undefined && e.library !== owner)
    )
      continue;
    if (e.type === 'ParamDef' && e.paramType?.type === 'struct') {
      const structure = resolve(e.paramType.typeElement, owner, 'Structure');
      structureFormals.push({
        owner,
        formal: e,
        structure,
        status: structure ? 'RESOLVED' : 'UNRESOLVED_STRUCTURE_OWNER',
      });
    }
    if (
      e.type !== 'FunctionDef' ||
      !e.flags?.includes('Action') ||
      !e.flags.includes('SubFunctions') ||
      e.flags.includes('Native') ||
      e.disabled ||
      (e.returnType && e.returnType.type !== 'void')
    )
      continue;
    const roles = (e.subFunctionTypes ?? []).map((ref) => resolve(ref, owner, 'SubFuncType'));
    if (!roles.length || roles.some((r) => !r?.isEvent)) continue;
    const parameters = (e.parameters ?? []).map((ref) => resolve(ref, owner, 'ParamDef'));
    eventContainers.push({
      owner,
      definition: e,
      roles,
      parameters,
      implicitTarget: parameters.length === 0,
      bodiless:
        !e.scriptCode && !e.expressionCode && !e.actions?.length && !e.localVariables?.length,
      allParametersResolved: parameters.every(Boolean),
      explicitTargetProved: false,
    });
  }
  return Object.freeze({
    issues: Object.freeze(issues),
    resolve,
    eventContainers: Object.freeze(eventContainers),
    structureFormals: Object.freeze(structureFormals),
    implicitEventContainer(owner) {
      if (invalidOwners.has(owner)) return { status: 'AMBIGUOUS' };
      const matches = eventContainers.filter(
        (e) => e.owner === owner && e.implicitTarget && e.bodiless && e.roles.length === 1,
      );
      return matches.length === 1
        ? { status: 'RESOLVED', ...matches[0] }
        : { status: matches.length ? 'AMBIGUOUS' : 'UNRESOLVED' };
    },
    evidence() {
      return {
        kind: 'EXISTING_TYPED_GUI_CAPABILITIES',
        issues,
        eventContainers: eventContainers.map((e) => ({
          owner: e.owner,
          id: e.definition.id,
          identifier: e.definition.identifier,
          parameterCount: e.parameters.length,
          implicitTarget: e.implicitTarget,
          bodiless: e.bodiless,
          explicitTargetProved: false,
        })),
        structureFormals: structureFormals.map((e) => ({
          owner: e.owner,
          id: e.formal.id,
          status: e.status,
          structure: e.formal.paramType.typeElement,
        })),
        newDefinitions: 0,
        newNative: 0,
        newCustomScript: 0,
        persistentCache: false,
      };
    },
  });
}

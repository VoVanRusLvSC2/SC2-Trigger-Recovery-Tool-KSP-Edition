// A supplied native Galaxy declaration names the runtime API, not an arbitrary
// user-library description with the same editor identifier. Prefer a unique
// public description from the SDK's actual Native library when its complete ABI
// matches. The identity index remains conservative. This only constructs a GUI
// binding; unchanged full roundtrip/SDK/GUI gates still decide acceptance.
import { formalGalaxyCarrier } from '../../types/formal-galaxy-carrier.native-formals.mjs';
import { resolveNativeRoleCandidate as previousRole } from '../../bindings/native-gui-role-candidate.mjs';
const hidden = new Set(['Hidden', 'Internal', 'Deprecated']);
const allowed = new Set(['Native', 'Event', 'Action', 'Call', 'Operator']);
export function bindNativeLibraryDeclaration(index, query, resolution, nativeLibraryId) {
  if (resolution?.status !== 'AMBIGUOUS' || !query.declaration || !nativeLibraryId)
    return resolution;
  const library = index.libraries.get(nativeLibraryId);
  if (!library) return resolution;
  const abi = query.declaration,
    keys = new Set(resolution.candidateKeys);
  const compatible = (index.bySymbol.get(query.name) ?? []).flatMap((c) => {
    const d = c.definition,
      flags = d.flags ?? [];
    if (
      !keys.has(c.key) ||
      c.origin !== 'emitted' ||
      c.symbol !== query.name ||
      d.name !== query.name ||
      (d.identifier && d.identifier !== query.name) ||
      d.disabled ||
      d.scriptCode ||
      d.isSubFunction ||
      !flags.includes('Native') ||
      flags.some((f) => hidden.has(f) || !allowed.has(f))
    )
      return [];
    if (flags.includes('Event') && flags.includes('Action')) return [];
    const role = flags.includes('Event')
      ? 'event'
      : flags.includes('Action') || d.isFuncAction
        ? 'action'
        : 'value';
    const count = role === 'event' ? 1 : 0;
    if (
      (count && abi.parameters[0] !== 'trigger') ||
      d.parameters.length + count !== abi.parameters.length ||
      index.carrier(d.returnType, c.library) !== abi.returnType
    )
      return [];
    const exactFormals = d.parameters.every((ref, i) => {
      const formal = index.formal(ref, c.library);
      if (!formal) return false;
      const carrier = formalGalaxyCarrier(index, formal, c.library, d);
      return !!carrier && carrier === abi.parameters[i + count];
    });
    return exactFormals ? [{ candidate: c, role }] : [];
  });
  const matches = compatible.filter(
    ({ candidate, role }) =>
      candidate.library === library && (!query.guiUse || query.guiUse === role),
  );
  let selected = matches.length === 1 ? matches[0].candidate : undefined;
  const stockAction = compatible.some(
    ({ candidate, role }) => candidate.library === library && role === 'action',
  );
  if (
    !matches.length &&
    query.guiUse === 'value' &&
    abi.returnType !== 'void' &&
    stockAction &&
    compatible.length === keys.size
  ) {
    // A loaded dependency can supply an explicit value descriptor for the
    // identical native API that the installed catalog exposes as an Action.
    // All ambiguous candidates must agree with the bound runtime ABI.
    const valueDescriptions = compatible.filter(
      ({ candidate, role }) => role === 'value' && candidate.definition.flags.includes('Call'),
    );
    if (valueDescriptions.length === 1) selected = valueDescriptions[0].candidate;
  }
  if (!selected) return resolution;
  return {
    ...resolution,
    status: 'RESOLVED',
    definition: selected.definition,
    candidateKeys: [selected.key],
    nativeLibraryBinding: {
      kind:
        selected.library === library
          ? 'DECLARED_NATIVE_API_BOUND_TO_ACTUAL_SDK_NATIVE_LIBRARY'
          : 'DECLARED_NATIVE_API_BOUND_TO_LOADED_VALUE_DESCRIPTION',
      symbol: query.name,
      nativeLibraryId,
      selected: selected.key,
      actualAbi: abi,
      shadowDescriptions: resolution.candidateKeys.filter((k) => k !== selected.key),
      explicitArgumentsRequired: true,
      originalTypedMetadataPreserved: true,
      newNativeDefinitions: 0,
      candidateConstructionOnly: true,
      fullRoundtripRequired: true,
      wholeProgramEquivalenceProved: false,
    },
  };
}
export function resolveNativeRoleWithLibrary(index, query, requiredRole, nativeLibraryId) {
  const previous = previousRole(index, query, requiredRole);
  if (previous.status !== 'AMBIGUOUS') return previous;
  const resolved = bindNativeLibraryDeclaration(
    index,
    { ...query, guiUse: { Event: 'event', Action: 'action', Call: 'value' }[requiredRole] },
    index.resolve(query),
    nativeLibraryId,
  );
  return resolved?.status === 'RESOLVED'
    ? { ...resolved, requiredRole, owner: resolved.candidateKeys[0] }
    : previous;
}

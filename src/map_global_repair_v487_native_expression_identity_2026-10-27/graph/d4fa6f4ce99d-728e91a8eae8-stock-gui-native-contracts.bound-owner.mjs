import {createGuiCapabilityCatalog} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/bindings/gui-capability-catalog.mjs';
// Existing SDK Native descriptors are also declarations of compiler intrinsics
// omitted from natives.galaxy. This indexes metadata; it emits no source or GUI.
import {FunctionCandidateIndex} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/ce9e8969ee16-2dc3e1a30794-96138b7e78fe2409-function-candidates.mjs';
import {formalGalaxyCarrier} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/types/formal-galaxy-carrier.mjs';
export function stockGuiNativeContracts(libraries = [], {nativeLibraryId} = {}) {
  const entries = [...libraries], catalog = createGuiCapabilityCatalog(entries);
  const issues = [...catalog.issues, ...entries.filter(([owner, library]) => owner !== library.id)
    .map(([owner]) => ({kind: 'LIBRARY_ID_MISMATCH', owner}))];
  if (issues.length) return {contracts: new Map(), refused: issues};
  const index = new FunctionCandidateIndex(entries.map(([, library]) => {
    const elementsByType = {};
    for (const element of new Set(Object.values(library.elements)))
      (elementsByType[element.type] ??= {})[element.id] = element;
    return {...library, elementsByType};
  }));
  const contracts = new Map(), refused = [];
  for (const [name, candidates] of index.bySymbol) {
    const resolution = index.resolve({name, ...(nativeLibraryId ? {libraryId: nativeLibraryId} : {})});
    if (resolution.status !== 'RESOLVED') {refused.push({name, reason: resolution.status});continue;}
    const candidate = candidates.find(row => row.key === resolution.candidateKeys[0]);
    const {definition: def, library} = candidate;
    if (candidate.origin !== 'emitted' || !def.flags?.includes('Native') || def.disabled || def.scriptCode ||
      def.expressionCode || def.actions?.length || def.localVariables?.length || def.isSubFunction) continue;
    const formals = (def.parameters ?? []).map(ref => index.formal(ref, library));
    const parameters = formals.map(formal => formal && formalGalaxyCarrier(index, formal, library, def));
    const returnType = index.carrier(def.returnType, library);
    if (!returnType || parameters.some(type => !type)) {refused.push({name, reason: 'UNRESOLVED_NATIVE_ABI'});continue;}
    if (def.flags.includes('Event')) parameters.unshift('trigger');
    contracts.set(name, {name, library: library.id, type: 'FunctionDef', id: def.id, returnType, parameters,
      formals: formals.map(formal => ({library: formal.library ?? library.id, type: formal.type, id: formal.id, guiType: formal.paramType})),
      basis: 'EXISTING_UNIQUE_NATIVE_GUI_DESCRIPTOR', newNative: false, newRuntimeFunction: false});
  }
  return {contracts, refused};
}

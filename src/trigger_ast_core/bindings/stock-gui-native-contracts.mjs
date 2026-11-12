// Existing SDK Native descriptors are also declarations of compiler intrinsics
// omitted from natives.galaxy. This indexes metadata; it emits no source or GUI.
import {FunctionCandidateIndex} from '../../map_global_repair_v265_attribute_scalar_codec_2026-10-21/graph/96138b7e78fe2409-function-candidates.mjs';
import {formalGalaxyCarrier} from '../types/formal-galaxy-carrier.mjs';
export function stockGuiNativeContracts(libraries = []) {
  const index = new FunctionCandidateIndex([...libraries].map(([, library]) => {
    const elementsByType = {};
    for (const element of new Set(Object.values(library.elements)))
      (elementsByType[element.type] ??= {})[element.id] = element;
    return {...library, elementsByType};
  }));
  const contracts = new Map(), refused = [];
  for (const [name, candidates] of index.bySymbol) {
    const resolution = index.resolve({name});
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

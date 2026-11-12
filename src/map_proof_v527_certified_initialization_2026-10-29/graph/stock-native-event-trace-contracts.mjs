import {createGuiCapabilityCatalog} from '../bindings/gui-capability-catalog.mjs';
import {stockGuiNativeContracts} from '../bindings/stock-gui-native-contracts.typed.mjs';

// Event membership comes from a qualified loaded definition, never a name
// prefix or an untyped element-table key. No descriptions or source are emitted.
export function stockNativeEventTraceContracts(libraries = []) {
  const entries = [...libraries], catalog = createGuiCapabilityCatalog(entries);
  if (catalog.issues.length) return [];
  const {contracts} = stockGuiNativeContracts(entries), events = [];
  for (const contract of contracts.values()) {
    const definition = catalog.resolve(contract, contract.library, 'FunctionDef');
    if (definition?.flags?.includes('Event')) events.push({name: contract.name,
      signature: {returnType: contract.returnType, parameterTypes: contract.parameters},
      owner: {library: contract.library, type: 'FunctionDef', id: contract.id}});
  }
  return events;
}

/** Bind real foreign Trigger elements to declared trigger-typed ABI handles.
 * No invented/unused reference or startup call. An actual expression becomes
 * the same ValueElement the Editor writes for selecting that foreign trigger.
 */
import {triggerHandleName} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/1fc1424d67fd-49ae0c09fec3-a88461b66130-core.mjs';
import {getTypeName} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/1460ea54e793-6264c2524955-eae6ab3d18153439-g2t-core.mjs';

export function declaredExternalTriggerReferences(sources, libraries, ownLibraryId) {
  const declarations = new Map(), references = new Map(), ambiguous = new Set();
  for (const source of sources ?? []) {
    if (source.parseDiagnostics?.length) continue;
    for (const node of source.statements ?? []) {
      if (node.kind !== 141 /* VariableDeclaration */ || !node.name?.name) continue;
      const types = declarations.get(node.name.name) ?? new Set();
      // getTypeName unwraps arrays; only a scalar handle is a Trigger element.
      types.add(node.type?.kind === 117 /* ArrayType */ ? '[array]' : getTypeName(node.type)); declarations.set(node.name.name,types);
    }
  }
  for (const library of libraries ?? []) {
    if (!library?.id || library.id === ownLibraryId) continue;
    for (const element of Object.values(library.elements ?? {})) {
      if (element.type !== 'Trigger' || element.disabled ||
          (element.library !== undefined && element.library !== library.id)) continue;
      const name = triggerHandleName(library.id,element), types = declarations.get(name);
      if (!types || types.size !== 1 || !types.has('trigger') || ambiguous.has(name)) continue;
      const reference = {type:'Trigger',library:library.id,id:element.id};
      const prior = references.get(name);
      if (prior && (prior.id !== reference.id || prior.library !== reference.library)) {
        references.delete(name); ambiguous.add(name);
      } else references.set(name,reference);
    }
  }
  return references;
}

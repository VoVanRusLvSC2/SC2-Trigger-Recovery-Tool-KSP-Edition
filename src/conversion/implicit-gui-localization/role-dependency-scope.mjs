import { AsyncLocalStorage } from 'node:async_hooks';

const active = new AsyncLocalStorage();

export function withRoleDependencyScope(operation) {
  return active.run({ dependencies: new Map(), chars: 0 }, operation);
}

export function rememberRoleDependency(xml, libraries) {
  const state = active.getStore();
  if (!state || state.dependencies.has(xml) || state.chars + xml.length > 16 * 1024 ** 2) return;
  // The role-only reader uses an empty owner for an omitted SubFunctionType
  // library. Keep its independent parse when that difference is observable.
  for (const library of libraries.values())
    for (const element of Object.values(library.elementsByType.FunctionDef ?? {}))
      if (element.subFunctionTypes?.some((reference) => reference.library === undefined)) return;

  state.dependencies.set(xml, libraries);
  state.chars += xml.length;
}

/** Role checks use dependency identities, types and edges. Dependency localization
 * may annotate display names, grammar and text values, which these checks never read. */
export function roleDependency(xml) {
  return active.getStore()?.dependencies.get(xml);
}

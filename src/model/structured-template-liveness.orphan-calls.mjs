import { AsyncLocalStorage } from 'node:async_hooks';
const scope = new AsyncLocalStorage();
export function withGeneratedStructuredTemplateScope(operation) {
  const frame = { active: true, generated: new WeakSet(), calls: new WeakSet() };
  try {
    const result = scope.run(frame, operation);
    if (result?.then)
      return Promise.resolve(result).finally(() => {
        frame.active = false;
      });
    frame.active = false;
    return result;
  } catch (error) {
    frame.active = false;
    throw error;
  }
}
export function markGeneratedStructuredTemplate(definition) {
  const frame = scope.getStore();
  if (frame?.active) frame.generated.add(definition);
}
export function markGeneratedStructuredCall(call, definition) {
  const frame = scope.getStore();
  if (frame?.active && frame.generated.has(definition)) frame.calls.add(call);
}
const identity = (library, type, id) => JSON.stringify([library, type, id]);

// Failed speculative matching may leave a new inline template in the graph.
// Existing/authored definitions and runtime function bodies are never candidates.
export function pruneUnusedGeneratedStructuredTemplates(elements, library, rootRefs = []) {
  const frame = scope.getStore();
  if (!frame?.active)
    return {
      kind: 'UNUSED_NEW_INLINE_TEMPLATE_RETIREMENT',
      removed: [],
      retiredFormals: [],
      categoryEdgesRemoved: 0,
      authoredDefinitionsRemoved: 0,
      nativeDefinitionsRemoved: 0,
      runtimeBodiesRemoved: 0,
      scriptEquivalenceProved: false,
      notApplied: 'NO_ACTIVE_GENERATION_SCOPE',
    };
  const generated = frame.generated;
  const definitions = [];
  const calls = [];
  const aliases = new Map();
  let values = Object.values(elements);
  // Most elements are arguments and actions unrelated to speculative templates.
  // Only generated candidates can cause the retirement pass to alter the graph.
  const isCandidate = (element) =>
    element.library === library &&
    (element.type === 'FunctionDef'
      ? generated.has(element) &&
        element.flags?.includes('Operator') &&
        !element.flags.includes('Native') &&
        !element.actions?.length &&
        !element.localVariables?.length
      : element.type === 'FunctionCall' &&
        frame.calls.has(element) &&
        !element.parameters?.length &&
        !element.subFunctions?.length);
  if (values.some(isCandidate)) {
    values = [...new Set(values)];
    for (const e of values) {
      if (!isCandidate(e)) continue;
      (e.type === 'FunctionDef' ? definitions : calls).push(e);
    }
  }
  const uses = new Set();
  const referencedIds = new Set([...definitions, ...calls].map((candidate) => candidate.id));
  const roots = new Set(rootRefs.map((r) => identity(r.library ?? library, r.type, r.id)));
  const trackAliases = () => {
    if (aliases.size) return;
    for (const [name, element] of Object.entries(elements)) {
      const keys = aliases.get(element) ?? [];
      keys.push(name);
      aliases.set(element, keys);
    }
  };
  function refs(value, output, ids) {
    if (Array.isArray(value)) {
      for (const child of value) refs(child, output, ids);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (value.type && value.id) {
      if (ids.has(value.id)) output.add(identity(value.library ?? library, value.type, value.id));
      return;
    }
    for (const child of Object.values(value)) refs(child, output, ids);
  }
  if (definitions.length || calls.length)
    for (const e of values)
      for (const [field, value] of Object.entries(e)) {
        if (e.type === 'Category' && field === 'items') continue;
        refs(value, uses, referencedIds);
      }
  // Retire only calls whose creation was observed in this generation scope.
  // An authored/original call, explicit root, category item or any incoming
  // reference is a barrier. Argument-bearing calls are conservatively retained.
  const retiredOrphanCalls = [];
  const categoryRoots = new Set();
  if (calls.length)
    for (const e of values)
      if (e.type === 'Category')
        for (const r of e.items ?? [])
          categoryRoots.add(identity(r.library ?? library, r.type, r.id));
  for (const e of calls) {
    const key = identity(e.library ?? library, e.type, e.id),
      ref = e.functionDef;
    const definition =
      ref &&
      (ref.library ?? library) === library &&
      (elements['FunctionDef:' + ref.id] ?? elements[ref.id]);
    if (
      uses.has(key) ||
      roots.has(key) ||
      categoryRoots.has(key) ||
      !definition ||
      !generated.has(definition) ||
      !definition.flags?.includes('Operator') ||
      definition.flags.includes('Native') ||
      definition.actions?.length ||
      definition.localVariables?.length
    )
      continue;
    retiredOrphanCalls.push({
      library,
      type: e.type,
      id: e.id,
      definition: { library, type: definition.type, id: definition.id },
      incomingReferences: 0,
      createdInActiveGeneration: true,
      explicitRoot: false,
      arguments: 0,
    });
    trackAliases();
    for (const alias of aliases.get(e)) delete elements[alias];
  }
  if (retiredOrphanCalls.length) {
    uses.clear();
    for (const e of new Set(Object.values(elements)))
      for (const [field, value] of Object.entries(e)) {
        if (e.type === 'Category' && field === 'items') continue;
        refs(value, uses, referencedIds);
      }
  }
  const removed = [],
    formals = [];
  for (const e of definitions) {
    const key = identity(e.library ?? library, e.type, e.id);
    if (uses.has(key) || roots.has(key)) continue;
    removed.push({ library, type: e.type, id: e.id });
    formals.push(...(e.parameters ?? []), ...(e.subFunctionTypes ?? []));
    trackAliases();
    for (const alias of aliases.get(e)) delete elements[alias];
  }
  const deleted = new Set(removed.map((r) => identity(r.library, r.type, r.id)));
  let categoryEdgesRemoved = 0;
  if (deleted.size)
    for (const e of new Set(Object.values(elements)))
      if (e.type === 'Category' && e.items) {
        const prior = e.items;
        e.items = prior.filter((r) => !deleted.has(identity(r.library ?? library, r.type, r.id)));
        categoryEdgesRemoved += prior.length - e.items.length;
      }
  // A formal may be shared or explicitly rooted. Retire it only after checking
  // the remaining graph, using typed references rather than ID text matches.
  const remaining = new Set(roots);
  if (formals.length) {
    const formalIds = new Set(formals.map((ref) => ref.id));
    for (const e of new Set(Object.values(elements)))
      for (const value of Object.values(e)) refs(value, remaining, formalIds);
  }
  const retiredFormals = [];
  for (const ref of formals) {
    const key = identity(ref.library ?? library, ref.type, ref.id);
    if (
      (ref.library ?? library) !== library ||
      !['ParamDef', 'SubFuncType'].includes(ref.type) ||
      remaining.has(key)
    )
      continue;
    const candidates = [
      ...new Set([elements[ref.id], elements[ref.type + ':' + ref.id]].filter(Boolean)),
    ];
    if (candidates.length !== 1) continue;
    const e = candidates[0];
    if (e.type !== ref.type || e.library !== library || e.id !== ref.id) continue;
    for (const alias of aliases.get(e) ?? []) delete elements[alias];
    retiredFormals.push({ library, type: e.type, id: e.id });
  }
  return {
    kind: 'UNUSED_NEW_INLINE_TEMPLATE_RETIREMENT',
    removed,
    retiredFormals,
    categoryEdgesRemoved,
    retiredOrphanCalls,
    authoredDefinitionsRemoved: 0,
    nativeDefinitionsRemoved: 0,
    runtimeBodiesRemoved: 0,
    scriptEquivalenceProved: false,
  };
}

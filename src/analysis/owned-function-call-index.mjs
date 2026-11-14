// A per-invocation tree index, discarded after validation. Preserve the source
// order and the exact local-library / ID equality used by the original scan.
export function indexOwnedFunctionCalls(values, libraryId) {
  const calls = new Map();
  for (const element of values) {
    if (
      element.type !== 'FunctionCall' ||
      (element.functionDef?.library ?? libraryId) !== libraryId
    )
      continue;
    const id = element.functionDef?.id;
    let list = calls.get(id);
    if (!list) {
      list = [];
      calls.set(id, list);
    }
    list.push(element);
  }
  return calls;
}

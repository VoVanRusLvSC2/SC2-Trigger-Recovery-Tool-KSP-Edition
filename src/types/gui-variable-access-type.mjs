// Resolve the GUI type of a variable access, including array and structure
// projections. No coercion between Galaxy carriers and Editor domains occurs.
export function guiVariableAccessType(param, owner, { resolve, key, indexType }) {
  const seen = new Set();
  function walk(p, scope, expectedMembers) {
    if (
      !p ||
      p.type !== 'Param' ||
      !p.variable ||
      p.scriptCode !== undefined ||
      ['value', 'paramRef', 'functionCall', 'preset', 'valueElement', 'expressionText'].some(
        (k) => p[k] !== undefined,
      )
    )
      return;
    const identity = key(p, scope);
    if (seen.has(identity)) return;
    seen.add(identity);
    const own = p.library ?? scope,
      variable = resolve(p.variable, own);
    if (variable?.type !== 'Variable' || !variable.variableType?.type) return;
    if (expectedMembers && !expectedMembers.some((r) => key(r, scope) === key(p.variable, own)))
      return;
    if (p.array !== undefined && p.arrayIndexes !== undefined) return;
    const raw = p.array ?? p.arrayIndexes,
      indices = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    const dimensions = variable.arraySizes ?? [];
    if (variable.isArray) {
      if (!dimensions.length || indices.length !== dimensions.length) return;
    } else if (indices.length) return;
    for (const r of indices) {
      const child = resolve(r, own);
      if (!child || indexType(child, own, new Set(seen)) !== 'int') return;
    }
    if (!p.structMember) return variable.variableType.type;
    if (variable.variableType.type !== 'struct') return;
    const struct = resolve(variable.variableType.typeElement, variable.library ?? own);
    if (struct?.type !== 'Structure' || !Array.isArray(struct.variables)) return;
    return walk(resolve(p.structMember, own), own, struct.variables);
  }
  const result = walk(param, owner);
  return !param?.valueType || param.valueType.type === result ? result : undefined;
}

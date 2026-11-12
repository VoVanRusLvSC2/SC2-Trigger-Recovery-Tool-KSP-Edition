// Validate actual typed GUI call graphs, including nonnumeric arguments of a
// numeric-returning call. Nothing here evaluates or rewrites an expression.
export function createGuiCallTypeResolver({resolve, key, argumentType, declared}) {
  const scalar = type => ['int', 'fixed', 'bool', 'string'].includes(type);
  const numeric = type => type === 'int' || type === 'fixed';
  return function callType(param, owner, seen) {
    const call = resolve(param.functionCall, owner);
    const definition = call && resolve(call.functionDef, call.library ?? owner);
    if (call?.type !== 'FunctionCall' || definition?.type !== 'FunctionDef' || definition.disabled ||
        !scalar(definition.returnType?.type)) return;
    const arguments_ = call.parameters ?? [], formals = definition.parameters ?? [];
    if (arguments_.length !== formals.length) return;
    for (let i = 0; i < formals.length; i++) {
      const actualOwner = call.library ?? owner, formalOwner = definition.library ?? owner;
      const argument = resolve(arguments_[i], actualOwner), formal = resolve(formals[i], formalOwner);
      if (argument?.type !== 'Param' || formal?.type !== 'ParamDef' || !argument.parameterDef ||
          key(argument.parameterDef, argument.library ?? actualOwner) !== key(formals[i], formalOwner)) return;
      const actual = argumentType(argument, argument.library ?? actualOwner, new Set(seen));
      const expected = formal.paramType?.type;
      if (!actual || !expected) return;
      // Preserve the existing conservative numeric-only wildcard rule.
      if (['any', 'anycompare', 'anyvariable', 'sameas'].includes(expected)) {
        if (!numeric(actual)) return;
      } else if (expected === 'fixed') {
        if (!numeric(actual)) return;
      } else if (expected === 'preset') {
        if (!argument.preset) return;
        const value = resolve(argument.preset, argument.library ?? actualOwner);
        const preset = resolve(formal.paramType.typeElement, formal.library ?? formalOwner);
        if (value?.type !== 'PresetValue' || preset?.type !== 'Preset' ||
            !preset.values?.some(ref => key(ref, preset.library ?? formalOwner) ===
              key(argument.preset, argument.library ?? actualOwner))) return;
      } else if (actual !== expected) return;
    }
    return declared(param, definition.returnType.type);
  };
}

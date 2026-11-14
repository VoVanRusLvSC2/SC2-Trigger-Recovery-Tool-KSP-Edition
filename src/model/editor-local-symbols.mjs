import { generatedStructureStem } from './generated-structure-stem.mjs';

// The source AST supplies a complete symbol. Editor owns the first lv_;
// a second lv_ is part of the authored stem and must remain in the GUI.
export function recoveredEditorLocalIdentity(sourceName) {
  const stem = generatedStructureStem(sourceName, 'lv_');
  return stem === undefined ? { name: sourceName } : { name: stem, identifier: stem };
}

// Keep the SDK's scoped indexes and all unrelated naming behavior. Only an
// explicit legal stem bypasses the display-name sanitizer (which adds '_'
// before a digit). No map identities or input data are stored here.
export function createEditorLocalSymbols({
  legacy,
  createElementAccessExpression,
  createPropertyAccessExpression,
  conversionError,
}) {
  const localVarName = (variable) => {
    const id = variable.identifier;
    if (
      !variable.flags?.includes('NoScriptPrefix') &&
      typeof id === 'string' &&
      generatedStructureStem('lv_' + id, 'lv_') !== undefined
    )
      return 'lv_' + id;
    return legacy.localVarName(variable);
  };
  const memberVarName = (variable, library) =>
    variable.library !== undefined && variable.library !== library
      ? legacy.memberVarName(variable, library)
      : localVarName(variable);
  const resolveVariableGalaxyName = (variable, ref, ctx) =>
    (ref?.library ?? ctx.libId) === ctx.libId && ctx.localVarIds.has(variable.id)
      ? localVarName(variable)
      : legacy.resolveVariableGalaxyName(variable, ref, ctx);
  function applyParamAccessors(base, param, ctx, convert) {
    let result = base;
    const indices = Array.isArray(param.array) ? param.array : param.array ? [param.array] : [];
    for (const ref of indices) {
      const index = legacy.resolve(ref, ctx),
        expression = index && convert(index, ctx);
      if (!expression)
        conversionError('ARRAY_INDEX', 'Array index is unavailable', { reference: ref });
      result = createElementAccessExpression(result, expression);
    }
    if (param.structMember) {
      const member = legacy.resolve(param.structMember, ctx),
        variable = member?.variable && legacy.resolve(member.variable, ctx);
      if (!member || !variable)
        conversionError('STRUCT_MEMBER', 'Structure member is unavailable', {
          reference: param.structMember,
        });
      result = applyParamAccessors(
        createPropertyAccessExpression(result, memberVarName(variable, ctx.libId)),
        member,
        ctx,
        convert,
      );
    }
    return result;
  }
  return { localVarName, memberVarName, resolveVariableGalaxyName, applyParamAccessors };
}

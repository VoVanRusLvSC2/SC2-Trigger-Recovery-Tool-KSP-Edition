import {
  guiGameLinkTypeIdentity,
  declaredGuiGameLinkType,
} from '../../types/gui-game-link-type.mjs';
import { SyntaxKind as K } from '../../sdk/array-values/modules/galaxy/language-core/index.js';
import { getTypeName } from '../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
// Validate actual typed GUI call graphs, including nonnumeric arguments of a
// numeric-returning call. Nothing here evaluates or rewrites an expression.
export function createGuiCallTypeResolver({ resolve, key, argumentType, declared, onRefusal }) {
  // Nested arguments may be any intrinsic Galaxy carrier; only the outer
  // numeric-expression contract requires an int/fixed result. Nominal GUI
  // domains remain opaque until their qualified model is supplied.
  const intrinsicTypes = new Set();
  for (let kind = K.BoolKeyword; kind <= K.WavetargetKeyword; kind++)
    if (kind !== K.VoidKeyword) {
      const name = getTypeName({ kind });
      if (name && name !== 'unknown' && name !== 'void') intrinsicTypes.add(name);
    }
  const intrinsic = (type) => type && !type.typeElement && intrinsicTypes.has(type.type);
  const numeric = (type) => type === 'int' || type === 'fixed';
  return function callType(param, owner, seen) {
    const call = resolve(param.functionCall, owner);
    const definition = call && resolve(call.functionDef, call.library ?? owner);
    const reject = (reason, details = {}) => {
      onRefusal?.({
        reason,
        call: param.functionCall,
        definition: call?.functionDef,
        returnType: definition?.returnType,
        ...details,
      });
    };
    if (
      call?.type !== 'FunctionCall' ||
      definition?.type !== 'FunctionDef' ||
      definition.disabled ||
      !(intrinsic(definition.returnType) || guiGameLinkTypeIdentity(definition.returnType))
    )
      return reject('GUI_CALL_RETURN_DOMAIN_UNQUALIFIED');
    const arguments_ = call.parameters ?? [],
      formals = definition.parameters ?? [];
    const formalOwner = definition.library ?? owner;
    const declaredFormals = formals.map((ref) => resolve(ref, formalOwner));
    const repeated = declaredFormals.findIndex((formal) => formal?.isMultiple);
    if (
      declaredFormals.some((formal) => formal?.type !== 'ParamDef') ||
      (repeated < 0 && arguments_.length !== formals.length) ||
      (repeated >= 0 &&
        (repeated !== formals.length - 1 ||
          arguments_.length < formals.length ||
          declaredFormals.slice(0, repeated).some((formal) => formal.isMultiple)))
    )
      return reject('GUI_CALL_ARGUMENT_COUNT');
    for (let i = 0; i < arguments_.length; i++) {
      const actualOwner = call.library ?? owner;
      const formalIndex = repeated >= 0 ? Math.min(i, repeated) : i;
      const argument = resolve(arguments_[i], actualOwner),
        formal = declaredFormals[formalIndex];
      if (
        argument?.type !== 'Param' ||
        formal?.type !== 'ParamDef' ||
        !argument.parameterDef ||
        key(argument.parameterDef, argument.library ?? actualOwner) !==
          key(formals[formalIndex], formalOwner)
      )
        return;
      const actual = argumentType(argument, argument.library ?? actualOwner, new Set(seen));
      const expected =
        formal.paramType?.type === 'gamelink'
          ? guiGameLinkTypeIdentity(formal.paramType)
          : formal.paramType?.type;
      if (!actual || !expected)
        return reject('GUI_CALL_ARGUMENT_UNRESOLVED', {
          argument: i,
          actual,
          expected,
          value: arguments_[i],
          formal: formals[formalIndex],
        });
      // Preserve the existing conservative numeric-only wildcard rule.
      if (['any', 'anycompare', 'anyvariable', 'sameas'].includes(expected)) {
        if (!numeric(actual)) return;
      } else if (expected === 'fixed') {
        if (!numeric(actual)) return;
      } else if (expected === 'preset') {
        if (!argument.preset) return;
        const value = resolve(argument.preset, argument.library ?? actualOwner);
        const preset = resolve(formal.paramType.typeElement, formal.library ?? formalOwner);
        if (
          value?.type !== 'PresetValue' ||
          preset?.type !== 'Preset' ||
          !preset.values?.some(
            (ref) =>
              key(ref, preset.library ?? formalOwner) ===
              key(argument.preset, argument.library ?? actualOwner),
          )
        )
          return;
      } else if (actual !== expected)
        return reject('GUI_CALL_ARGUMENT_CARRIER_MISMATCH', {
          argument: i,
          actual,
          expected,
          value: arguments_[i],
          formal: formals[formalIndex],
        });
    }
    return definition.returnType.type === 'gamelink'
      ? declaredGuiGameLinkType(param, definition.returnType)
      : declared(param, definition.returnType.type);
  };
}

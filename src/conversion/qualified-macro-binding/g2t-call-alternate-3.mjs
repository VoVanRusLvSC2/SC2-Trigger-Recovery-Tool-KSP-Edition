import { resolveDirectSourceGuiCall as resolveExpressionSourceCall } from '../../bindings/direct-source-gui-call-precedence.mjs';
import { recoverySessionFor as expressionSourceRecoveryFor } from '../native-expression-identity/recovery-session-alternate-2.mjs';
import { collectLeftAssociatedOperands } from '../exact-function-signatures/left-associated-operands.mjs';
import { boundSourceValueRead as boundScalarSourceRead } from '../bound-static-primary-storage/bound-source-access.authored-alternate.mjs';
import { resolvePreservedSourceValue as resolveScalarSourceRead } from './source-storage-resolution.authored.mjs';
import { boundSourceAggregateAccess as boundWholeSourceRead } from '../bound-static-primary-storage/bound-source-access.authored-alternate.mjs';
import { resolvePreservedSourceAggregate as resolveWholeSourceRead } from './source-storage-resolution.authored.mjs';
import { sourceStorageUseMode } from '../bound-static-primary-storage/authored-storage-boundary-path.member-tokens.mjs';
import { formalExpressionPreset } from '../exact-function-signatures/formal-preset-expression.arithmetic.mjs';
import { formalPresetRefs } from '../../bindings/formal-preset-domain.mjs';
import { singleCallTemplateAlias } from '../exact-native-export/single-call-template-alias-alternate-3.mjs';
import {
  libraryPrefix,
  lookupElement,
} from '../../sdk/lossless-colors/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {
  mkParamRef,
  mkFCRef,
  fdRef,
  buildFuncDefRoleMap,
  unwrapParens,
  idFromKey,
  extractAutoVarName,
  maybeResolveStructureMember,
  sanitizeFuncName,
  localizedTextParamId,
} from '../exact-native-export/g2t-core.mjs';
import {
  resolveParamDefByRef,
  coerceStringDomainType,
  tryBuildEncodedScalarParamFromCall,
  inferStringValueTypeWithoutParamDef,
  resolvePresetValueForParamScalar,
  unitFilterStringFromCall,
} from '../exact-native-export/g2t-params.mjs';
import { decodeUnknownSubFunctionTail } from '../exact-native-export/g2t-payload-alternate-3.mjs';
function resolveUnitFilterPresetName(identifier, ctx) {
  const preset = ctx.galaxyConstToPreset.get(identifier);
  if (!preset) return undefined;
  const libraries = new Map(ctx.dependencyLibraries);
  if (ctx.nativeLibrary) libraries.set(ctx.nativeLibrary.id, ctx.nativeLibrary);
  libraries.set(ctx.libId, {
    id: ctx.libId,
    items: [],
    elements: ctx.elements,
    elementsByType: {},
  });
  const definition = lookupElement(libraries.values(), preset, ctx.libId);
  return definition?.type === 'PresetValue'
    ? (definition.identifier ?? definition.name)
    : undefined;
}
export function resolvedFunctionDefForCall(callExpr, ctx) {
  if (!callExpr || callExpr.kind !== 121 /* SyntaxKind.CallExpression */) return undefined;
  const calleeExpr = callExpr.expression;
  if (!calleeExpr || calleeExpr.kind !== 113 /* SyntaxKind.Identifier */) return undefined;
  const calleeName = calleeExpr.name;
  const direct = ctx.funcNameToFuncDef.get(calleeName);
  if (direct) return direct;
  const libWrapperMatch = /^lib([A-Za-z0-9]+)_gf_([A-Za-z0-9_]+)$/.exec(calleeName);
  const wrappedName = libWrapperMatch?.[2];
  return wrappedName
    ? libraryOwnedDefinition(ctx.funcNameToFuncDef.get(wrappedName), libWrapperMatch?.[1], ctx)
    : undefined;
}
/** `lib<ID>_gf_<Name>` names the library that owns the function. A same-named
 * function in another loaded library is a different function: a campaign map
 * carries its own copy of a Blizzard library under a hashed ID, and attributing
 * the call to the stock library renames it in the generated script. */
function libraryOwnedDefinition(definition, wrappedLib, ctx) {
  if (!definition || !wrappedLib) return definition;
  return (definition.library ?? ctx.libId) === wrappedLib ? definition : undefined;
}
export function callExprHasResolvedFunctionDef(callExpr, ctx) {
  if (!callExpr || callExpr.kind !== 121 /* SyntaxKind.CallExpression */) return false;
  const calleeExpr = callExpr.expression;
  if (!calleeExpr || calleeExpr.kind !== 113 /* SyntaxKind.Identifier */) return false;
  const calleeName = calleeExpr.name;
  if (resolvedFunctionDefForCall(callExpr, ctx)) return true;
  const libWrapperMatch = /^lib([A-Za-z0-9]+)_gf_([A-Za-z0-9_]+)$/.exec(calleeName);
  const wrappedLib = libWrapperMatch?.[1];
  const wrappedName = libWrapperMatch?.[2];
  // Some Galaxy helper calls are not FunctionDefs in NativeLib, but are valid
  // encoded trigger scalar params (for example UnitFilter(...)).
  if (
    tryBuildEncodedScalarParamFromCall(callExpr, undefined) ||
    unitFilterStringFromCall(callExpr, (identifier) => resolveUnitFilterPresetName(identifier, ctx))
  )
    return true;
  const userPrefix = `${libraryPrefix(ctx.libId)}gf_`;
  if (calleeName.startsWith(userPrefix)) {
    const funcName = calleeName.slice(userPrefix.length);
    const existingId = Object.keys(ctx.elements).find(
      (id) => ctx.elements[id].type === 'FunctionDef' && ctx.elements[id].name === funcName,
    );
    if (existingId) return true;
  }
  if (wrappedLib && wrappedLib !== ctx.libId && ctx.crossLibFuncDefs?.has(calleeName)) return true;
  if (globalThis.process?.env?.['MX_G2T_TRACE_UNRESOLVED_CALLS'] === '1') {
    const wrapped = wrappedName ? ` wrapped=${wrappedName}` : '';
    console.error(`[triggers:g2t] unresolved-call ${calleeName}${wrapped}`);
  }
  return false;
}
export function exprContainsUnresolvedCall(expr, ctx) {
  if (!expr) return false;
  if (expr.kind === 121 /* SyntaxKind.CallExpression */) {
    if (!callExprHasResolvedFunctionDef(expr, ctx)) return true;
    return Array.from(expr.arguments ?? []).some((arg) => exprContainsUnresolvedCall(arg, ctx));
  }
  if (expr.kind === 126 /* SyntaxKind.ParenthesizedExpression */)
    return exprContainsUnresolvedCall(expr.expression, ctx);
  if (expr.kind === 122 /* SyntaxKind.PrefixUnaryExpression */)
    return exprContainsUnresolvedCall(expr.operand, ctx);
  if (expr.kind === 124 /* SyntaxKind.BinaryExpression */) {
    return (
      exprContainsUnresolvedCall(expr.left, ctx) || exprContainsUnresolvedCall(expr.right, ctx)
    );
  }
  if (expr.kind === 120 /* SyntaxKind.PropertyAccessExpression */)
    return exprContainsUnresolvedCall(expr.expression, ctx);
  if (expr.kind === 119 /* SyntaxKind.ElementAccessExpression */) {
    return (
      exprContainsUnresolvedCall(expr.expression, ctx) ||
      exprContainsUnresolvedCall(expr.argumentExpression, ctx)
    );
  }
  return false;
}
// ---------------------------------------------------------------------------
// Expression → Param ref
// ---------------------------------------------------------------------------
function presetBitsParamData(expr, paramDef, ctx) {
  const candidates = formalPresetRefs(paramDef, paramDef?.library ?? ctx.libId)
    .map((ref) => presetBitsFromDomain(expr, ref, ctx))
    .filter(Boolean);
  return candidates.length === 1 ? candidates[0] : undefined;
}
function presetBitsFromDomain(expr, presetRef, ctx) {
  if (!presetRef?.id) return undefined;
  const libraries = new Map(ctx.dependencyLibraries);
  if (ctx.nativeLibrary) libraries.set(ctx.nativeLibrary.id, ctx.nativeLibrary);
  const presetElement = lookupElement(
    libraries.values(),
    { ...presetRef, type: 'Preset' },
    ctx.libId,
  );
  if (presetElement?.type !== 'Preset' || !presetElement.asBits) return undefined;
  const preset = presetElement;
  const presetLibrary = preset.library ?? presetRef.library ?? ctx.libId;
  const allowed = new Map(
    (preset.values ?? []).map((ref) => [
      `${ref.library ?? presetLibrary}:${ref.id}`,
      { type: 'PresetValue', library: ref.library ?? presetLibrary, id: ref.id },
    ]),
  );
  const selected = [];
  const seen = new Set();
  const collect = (node) => {
    const value = unwrapParens(node);
    if (
      value?.kind === 2 /* SyntaxKind.NumericLiteral */ &&
      Number(value.text ?? value.value) === 0
    )
      return true;
    if (
      value?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
      value.operatorToken?.kind === 30 /* SyntaxKind.BarToken */
    ) {
      return collect(value.left) && collect(value.right);
    }
    if (value?.kind !== 113 /* SyntaxKind.Identifier */) return false;
    const ref = ctx.galaxyConstToPreset.get(value.name);
    if (!ref?.id) return false;
    const key = `${ref.library ?? presetLibrary}:${ref.id}`;
    const member = allowed.get(key);
    if (!member) return false;
    if (!seen.has(key)) {
      seen.add(key);
      selected.push(member);
    }
    return true;
  };
  if (!collect(expr)) return undefined;
  return {
    valueType: { type: 'preset' },
    valueElement: { type: 'Preset', library: presetLibrary, id: preset.id },
    valuePresets: selected,
  };
}
// SetVariable and several editor templates describe the value with a
// relational pseudo-type.  The concrete domain belongs to the referenced
// variable/member, not to the generic ParamDef.  Prefer that proven target
// type so encoded values such as Color(...) remain typed scalars instead of
// becoming strings that compile only through an invalid implicit cast, and
// `"a" + "b"` stays Combine Strings instead of integer arithmetic.
const RELATIONAL_PARAM_TYPES = new Set([
  'any',
  'anyvariable',
  'anycompare',
  'sameas',
  'sameasparent',
  'return',
]);
function concreteExpectedType(formal, hint) {
  return !formal || RELATIONAL_PARAM_TYPES.has(formal) ? (hint?.toLowerCase() ?? formal) : formal;
}
export function exprToParamRef(expr, ctx, paramDefRef, expectedTypeHint) {
  const declaredPreset = formalExpressionPreset(expr, paramDefRef, ctx);
  if (declaredPreset) return mkParamRef({ parameterDef: paramDefRef, preset: declaredPreset }, ctx);
  const pd = paramDefRef ? resolveParamDefByRef(paramDefRef, ctx) : undefined;
  const expected = concreteExpectedType(pd?.paramType?.type?.toLowerCase(), expectedTypeHint);
  const abiExpected = expectedTypeHint?.toLowerCase();
  const presetBits = presetBitsParamData(expr, pd, ctx);
  if (presetBits) {
    if (paramDefRef) presetBits.parameterDef = paramDefRef;
    return mkParamRef(presetBits, ctx);
  }
  const textParamId = localizedTextParamId(expr, ctx);
  if (textParamId !== undefined) {
    const data = { valueType: { type: 'text' } };
    // Preserve the original external key even when the primary locale has no value.
    data.scriptCode =
      'StringExternal(' +
      JSON.stringify(String(unwrapParens(unwrapParens(expr).arguments[0]).value)) +
      ')';
    if (paramDefRef) data.parameterDef = paramDefRef;
    return mkParamRef(data, ctx, textParamId);
  }
  {
    const encoded = tryBuildEncodedScalarParamFromCall(expr, expected);
    if (encoded) {
      if (paramDefRef) encoded.parameterDef = paramDefRef;
      return mkParamRef(encoded, ctx);
    }
  }
  {
    const value = unitFilterStringFromCall(expr, (identifier) =>
      resolveUnitFilterPresetName(identifier, ctx),
    );
    if (value !== undefined) {
      const data = { value, valueType: { type: 'unitfilter' } };
      if (paramDefRef) data.parameterDef = paramDefRef;
      return mkParamRef(data, ctx);
    }
  }
  if (expr?.kind === 121 /* SyntaxKind.CallExpression */) {
    const fcRef = callExprToFCRef(expr, undefined, ctx, expected);
    if (fcRef) {
      const data = { functionCall: fcRef };
      if (paramDefRef) data.parameterDef = paramDefRef;
      return mkParamRef(data, ctx);
    }
  }
  if (expected === 'text' && expr?.kind === 3 /* SyntaxKind.StringLiteral */) {
    const textRef = stringLiteralToTextFCRef(expr, ctx);
    if (textRef) {
      const data = { functionCall: textRef };
      if (paramDefRef) data.parameterDef = paramDefRef;
      return mkParamRef(data, ctx);
    }
  }
  const concatenationType =
    abiExpected === 'text' || abiExpected === 'string'
      ? abiExpected
      : expected === 'text' || expected === 'string'
        ? expected
        : undefined;
  if (concatenationType) {
    const operatorRef = typedPlusToOperatorFCRef(expr, ctx, concatenationType);
    if (operatorRef) {
      const data = { functionCall: operatorRef };
      if (paramDefRef) data.parameterDef = paramDefRef;
      return mkParamRef(data, ctx);
    }
  }
  const data = exprToParamData(expr, ctx);
  if (
    paramDefRef &&
    !data.preset &&
    !data.variable &&
    !data.functionCall &&
    !data.paramRef &&
    typeof data.value === 'string'
  ) {
    const presetRef = resolvePresetValueForParamScalar(paramDefRef, data.value, ctx);
    if (presetRef) {
      delete data.value;
      delete data.valueType;
      data.preset = presetRef;
    }
  }
  if (paramDefRef) {
    const pd = resolveParamDefByRef(paramDefRef, ctx);
    coerceStringDomainType(data, pd?.paramType?.type?.toLowerCase());
    // ValueGameType is the catalog namespace of a gamelink, not redundant
    // display metadata. Without it the editor keeps the text but loses the
    // actual Model/Unit/Effect link.
    if (
      pd?.paramType?.gameType &&
      /^(?:any)?gamelink$/u.test(data.valueType?.type?.toLowerCase() ?? '')
    ) {
      data.valueType = { ...data.valueType, gameType: pd.paramType.gameType };
    }
  } else if (expectedTypeHint) {
    coerceStringDomainType(data, expectedTypeHint.toLowerCase());
  }
  if (paramDefRef) data.parameterDef = paramDefRef;
  return mkParamRef(data, ctx);
}
// ---------------------------------------------------------------------------
// Expression → Param data
// ---------------------------------------------------------------------------
/** An expression without a native TriggerData shape. The structural pass keeps it
 * as a synthesized template; a null value silently dropped the operation, e.g.
 * `return (input << rotation) | UnsignedRightShift(...)` in Rainbow Arena's MD5. */
function unrepresentedParamData(expr, ctx) {
  return ctx.structuredExpression
    ? { functionCall: ctx.structuredExpression(expr, undefined, ctx) }
    : { value: 'null' };
}
export function exprToParamData(expr, ctx) {
  if (!expr) return { value: 'null' };
  const imported = ctx.externalPropertyParamData?.(expr, ctx);
  if (imported) return imported;
  switch (expr.kind) {
    case 126 /* SyntaxKind.ParenthesizedExpression */:
      return exprToParamData(expr.expression, ctx);
    case 113 /* SyntaxKind.Identifier */: {
      const name = expr.name;
      // PickEachInteger loop counter → IntLoopCurrent()
      if (ctx.pickEachIntVarName && name === ctx.pickEachIntVarName) {
        const funcDef = ctx.funcNameToFuncDef.get('IntLoopCurrent');
        if (!funcDef) return { value: 'null' }; // NativeLib not loaded
        return { functionCall: mkFCRef({ functionDef: fdRef(funcDef) }, ctx) };
      }
      if (ctx.pickEachPlayerVarName && name === ctx.pickEachPlayerVarName) {
        const funcDef = ctx.funcNameToFuncDef.get('PlayerGroupLoopCurrent');
        if (!funcDef) return { value: 'null' };
        return { functionCall: mkFCRef({ functionDef: fdRef(funcDef) }, ctx) };
      }
      if (ctx.pickEachUnitVarName && name === ctx.pickEachUnitVarName) {
        const funcDef = ctx.funcNameToFuncDef.get('UnitGroupLoopCurrent');
        if (!funcDef) return { value: 'null' };
        return { functionCall: mkFCRef({ functionDef: fdRef(funcDef) }, ctx) };
      }
      const accessor = ctx.structuredAutoAccessors?.get(name);
      if (accessor) return { functionCall: mkFCRef({ functionDef: fdRef(accessor) }, ctx) };
      // Function parameter ref (lp_xxx in user function body)
      const paramRefEntry = ctx.paramRefByGalaxyName?.get(name);
      if (paramRefEntry) return { paramRef: paramRefEntry };
      const localId = ctx.localVarByGalaxyName.get(name);
      if (localId) return { variable: { type: 'Variable', library: ctx.libId, id: localId } };
      const triggerRef = ctx.triggerByGalaxyName?.get(name);
      if (triggerRef) {
        return {
          valueType: { type: 'trigger' },
          valueElement: {
            type: 'Trigger',
            library: triggerRef.library ?? ctx.libId,
            id: triggerRef.id,
          },
        };
      }
      const globalRef = ctx.globalVarByGalaxyName.get(name);
      if (globalRef)
        return { variable: { type: 'Variable', library: globalRef.library, id: globalRef.id } };
      // NativeLib galaxy constant (c_xxx) → resolve to PresetValue ref
      const presetRef = ctx.galaxyConstToPreset.get(name);
      if (presetRef) return { preset: presetRef };
      // Captured loop-scaffolding helper (const auto*_ae/_ai) referenced as a
      // plain value (e.g. `lv_total = autoX_ae;`) — substitute the captured
      // expression; the helper itself is never emitted as a variable.
      {
        const auto = extractAutoVarName(name);
        if (auto) {
          const captured =
            auto.suffix === 'ae'
              ? ctx.pendingAutoEnds.get(name)
              : auto.suffix === 'ai'
                ? ctx.pendingAutoIncrements.get(name)
                : undefined;
          if (captured) return exprToParamData(captured, ctx);
        }
      }
      // Preserve original scalar ownership with a typed GUI interface.
      // Bare identifier Values cannot supply the type needed by native macros.
      const sourceScalar = boundScalarSourceRead(expr);
      if (sourceScalar && resolveScalarSourceRead(sourceScalar)) {
        if (!ctx.structuredExpression) throw new Error('BOUND_SOURCE_SCALAR_GUI_LOWERER_REQUIRED');
        return unrepresentedParamData(expr, ctx);
      }
      // Unknown identifier — fall back to raw string
      return { value: name };
    }
    case 69 /* SyntaxKind.NullKeyword */:
      // SC2 Editor compiles an empty Param as a blank operand. Store the null
      // token explicitly so comparisons like `lp_file != null` stay valid.
      return { value: 'null' };
    case 67 /* SyntaxKind.TrueKeyword */:
      return { value: 'true', valueType: { type: 'bool' } };
    case 68 /* SyntaxKind.FalseKeyword */:
      return { value: 'false', valueType: { type: 'bool' } };
    case 2 /* SyntaxKind.NumericLiteral */: {
      // expr.text = original source text (preserves "2.0"); expr.value = parsed number ("2")
      const rawText = String(expr.text ?? expr.value ?? '0');
      const isFixed = rawText.includes('.');
      return { value: rawText, valueType: { type: isFixed ? 'fixed' : 'int' } };
    }
    case 122 /* SyntaxKind.PrefixUnaryExpression */: {
      // -N numeric literal -> negative int/fixed value
      if (
        expr.operator?.kind === 21 /* SyntaxKind.MinusToken */ &&
        expr.operand?.kind === 2 /* SyntaxKind.NumericLiteral */
      ) {
        const rawText = String(expr.operand.text ?? expr.operand.value ?? '0');
        const isFixed = rawText.includes('.');
        return { value: `-${rawText}`, valueType: { type: isFixed ? 'fixed' : 'int' } };
      }
      // !cond -> Not(cond)
      if (expr.operator?.kind === 32 /* SyntaxKind.ExclamationToken */) {
        const notDef = ctx.funcNameToFuncDef.get('Not');
        if (notDef) {
          const roleMap = buildFuncDefRoleMap(notDef, ctx.nativeLibrary, ctx.roleToSubFuncType);
          const condRole = roleMap.get('cond') ?? roleMap.get('Conditions') ?? roleMap.get('If');
          const condRef = exprToConditionFCRef(expr.operand, condRole, ctx);
          if (condRef) {
            return {
              functionCall: mkFCRef({ functionDef: fdRef(notDef), subFunctions: [condRef] }, ctx),
            };
          }
        }
      }
      // TriggerData has no standalone unary-minus node.  A synthesized
      // Template with ScriptCode `-#PARAM(operand)` round-trips through this
      // converter, but the SC2 editor emits it as an undefined
      // lf_PrefixUnaryExpression helper.  Express a non-literal negation with
      // the loaded arithmetic operator instead.  This evaluates the operand
      // once and is valid for both int and fixed expressions.
      if (expr.operator?.kind === 21 /* SyntaxKind.MinusToken */) {
        const real = isRealExpr(expr.operand, ctx);
        const arithmetic = binaryArithToFCRef(
          {
            kind: 124 /* SyntaxKind.BinaryExpression */,
            left: { kind: 2 /* SyntaxKind.NumericLiteral */, text: real ? '0.0' : '0', value: '0' },
            operatorToken: { kind: 21 /* SyntaxKind.MinusToken */ },
            right: expr.operand,
          },
          ctx,
        );
        if (arithmetic) return { functionCall: arithmetic };
      }
      // Unary plus does not change a Galaxy int/fixed value.  Keeping the
      // operand's structural representation avoids another synthetic helper.
      if (expr.operator?.kind === 20 /* SyntaxKind.PlusToken */)
        return exprToParamData(expr.operand, ctx);
      // Other prefix ops
      return unrepresentedParamData(expr, ctx);
    }
    case 3 /* SyntaxKind.StringLiteral */: {
      const s = String(expr.value ?? '');
      // In many NativeLib calls (e.g. UnitFilter), SC2 stores "null" as a raw
      // scalar value without an explicit ValueType. Keep that shape.
      if (s === 'null') return { value: s };
      const inferred = inferStringValueTypeWithoutParamDef(s);
      return { value: s, valueType: { type: inferred ?? 'string' } };
    }
    case 121 /* SyntaxKind.CallExpression */: {
      // A UnitFilter expression is an encoded parameter scalar.  This branch
      // is reached when the surrounding declaration has no ParamDef (for
      // example a global initializer), so exprToParamRef cannot supply a
      // formal type hint.  Do not turn the Galaxy constructor into a bogus
      // Ntve FunctionDef reference.
      const unitFilter = unitFilterStringFromCall(expr, (identifier) =>
        resolveUnitFilterPresetName(identifier, ctx),
      );
      if (unitFilter !== undefined) return { value: unitFilter, valueType: { type: 'unitfilter' } };
      const fcRef = callExprToFCRef(expr, undefined, ctx);
      if (fcRef) return { functionCall: fcRef };
      return unrepresentedParamData(expr, ctx);
    }
    case 120 /* SyntaxKind.PropertyAccessExpression */: {
      // Resolve the complete nominal source path before recursively
      // materializing its array/struct receiver as a scalar GUI value.
      const wholeSourceRead = sourceStorageUseMode(expr) === 'read' && boundWholeSourceRead(expr);
      if (wholeSourceRead && resolveWholeSourceRead(wholeSourceRead) && ctx.structuredExpression)
        return unrepresentedParamData(expr, ctx);
      const baseData = exprToParamData(expr.expression, ctx);
      const memberName = expr.name?.name;
      if (memberName) {
        const resolved = maybeResolveStructureMember(baseData, memberName, ctx);
        if (resolved) return resolved;
      }
      return unrepresentedParamData(expr, ctx);
    }
    case 119 /* SyntaxKind.ElementAccessExpression */: {
      // Indices address storage: a variable or a parameter. An unresolved root
      // is only text to the Param, and indices set beside a text value are
      // dropped on the way back (EditorTest CAI2: libCCUI_gv_productionUnits[lp_player][1]
      // compiled back as libCCUI_gv_productionUnits). Such an access keeps the
      // whole expression instead.
      let root = expr;
      while (root.kind === 119 /* SyntaxKind.ElementAccessExpression */) root = root.expression;
      if (
        root.kind === 113 /* SyntaxKind.Identifier */ &&
        !ctx.paramRefByGalaxyName?.has(root.name) &&
        !ctx.localVarByGalaxyName.has(root.name) &&
        !ctx.globalVarByGalaxyName.has(root.name)
      ) {
        if (ctx.structuredExpression) return unrepresentedParamData(expr, ctx);
        const text =
          typeof ctx.sourceText === 'string' &&
          Number.isInteger(expr.pos) &&
          Number.isInteger(expr.end)
            ? ctx.sourceText.slice(expr.pos, expr.end).trim()
            : '';
        if (text) return { value: text };
      }
      // Collect the full chain of index expressions for N-D array access.
      const indices = [];
      let cur = expr;
      while (cur.kind === 119 /* SyntaxKind.ElementAccessExpression */) {
        indices.unshift(exprToParamRef(cur.argumentExpression, ctx));
        cur = cur.expression;
      }
      const baseData = exprToParamData(cur, ctx);
      if (indices.length === 0) return baseData;
      // An unresolved property/function result cannot carry storage indices.
      // Preserve the full expression; never emit the unindexed base.
      if (!baseData.variable && !baseData.paramRef) return unrepresentedParamData(expr, ctx);
      if (baseData.structMember?.id) {
        let indexedMember = ctx.elements[baseData.structMember.id];
        while (indexedMember?.structMember?.id) {
          indexedMember = ctx.elements[indexedMember.structMember.id];
        }
        if (indexedMember) {
          indexedMember.array = indices.length === 1 ? indices[0] : indices;
        }
        return baseData;
      }
      if (indices.length === 1) return { ...baseData, array: indices[0] };
      return { ...baseData, array: indices };
    }
    case 124 /* SyntaxKind.BinaryExpression */: {
      const opKind = expr.operatorToken.kind;
      const compStr = binaryOpToComparisonStr(opKind);
      if (compStr) {
        const fcRef = comparisonToFCRef(expr.left, compStr, expr.right, undefined, ctx);
        if (fcRef) return { functionCall: fcRef };
      }
      // Arithmetic operators → ArithmeticInt / ArithmeticReal
      const arithRef = binaryArithToFCRef(expr, ctx);
      if (arithRef) return { functionCall: arithRef };
      return unrepresentedParamData(expr, ctx);
    }
    default:
      return unrepresentedParamData(expr, ctx);
  }
}
// ---------------------------------------------------------------------------
// Operator helpers
// ---------------------------------------------------------------------------
export const COMPARISON_OP_MAP = {
  [17 /* SyntaxKind.EqualsEqualsToken */]: '==',
  [18 /* SyntaxKind.ExclamationEqualsToken */]: '!=',
  [13 /* SyntaxKind.LessThanToken */]: '<',
  [14 /* SyntaxKind.GreaterThanToken */]: '>',
  [15 /* SyntaxKind.LessThanEqualsToken */]: '<=',
  [16 /* SyntaxKind.GreaterThanEqualsToken */]: '>=',
};
export function binaryOpToComparisonStr(opKind) {
  return COMPARISON_OP_MAP[opKind];
}
// Map galaxy arithmetic token → ArithmeticOp preset symbol (PresetValue.value in NativeLib)
export const ARITHMETIC_OP_MAP = {
  [20 /* SyntaxKind.PlusToken */]: '+',
  [21 /* SyntaxKind.MinusToken */]: '-',
  [22 /* SyntaxKind.AsteriskToken */]: '*',
  [23 /* SyntaxKind.SlashToken */]: '/',
};
/** Returns true if expression should be treated as fixed/real in arithmetic context. */
export function isRealExpr(expr, ctx) {
  if (!expr) return false;
  if (expr.kind === 2 /* SyntaxKind.NumericLiteral */) {
    const text = expr.text ?? String(expr.value ?? '');
    return text.includes('.');
  }
  if (expr.kind === 126 /* SyntaxKind.ParenthesizedExpression */)
    return isRealExpr(expr.expression, ctx);
  if (expr.kind === 122 /* SyntaxKind.PrefixUnaryExpression */) {
    return isRealExpr(expr.operand, ctx);
  }
  if (expr.kind === 113 /* SyntaxKind.Identifier */) {
    const name = expr.name;
    const localId = ctx.localVarByGalaxyName.get(name);
    if (localId) {
      const el = ctx.elements[localId];
      if (el?.type === 'Variable') return (el.variableType?.type ?? '').toLowerCase() === 'fixed';
    }
    const globalRef = ctx.globalVarByGalaxyName.get(name);
    if (globalRef && globalRef.library === ctx.libId) {
      const el = ctx.elements[globalRef.id];
      if (el?.type === 'Variable') return (el.variableType?.type ?? '').toLowerCase() === 'fixed';
    }
    return false;
  }
  if (expr.kind === 121 /* SyntaxKind.CallExpression */) {
    const callee = expr.expression;
    if (callee?.kind === 113 /* SyntaxKind.Identifier */) {
      const fd = ctx.funcNameToFuncDef.get(callee.name);
      const ret = fd?.returnType?.type?.toLowerCase();
      return ret === 'fixed';
    }
  }
  if (expr.kind === 124 /* SyntaxKind.BinaryExpression */) {
    return isRealExpr(expr.left, ctx) || isRealExpr(expr.right, ctx);
  }
  return false;
}
/** The operands of one chain of `opKind`, left to right. A parenthesized operand is
 *  one value: the editor writes every arithmetic and Combine Strings call in
 *  parentheses of its own, so a nested call keeps them, and opening them changes the
 *  value of `-` and `/` (old-red-data: `(angle-(facing - 360.0))` came back as
 *  `(angle - facing - 360.0)`). */
export function collectArithmeticOperands(expr, opKind, out) {
  collectLeftAssociatedOperands(expr, opKind, out);
}
function getFuncParamDefs(funcDef) {
  return funcDef?.parameters ?? [];
}
function stringLiteralToTextFCRef(expr, ctx) {
  const funcDef = chooseFunctionDefForExpectedReturn(
    ctx,
    'StringToText',
    ctx.funcNameToFuncDef.get('StringToText'),
    'text',
  );
  if (!funcDef || funcDef.returnType?.type?.toLowerCase() !== 'text') return undefined;
  const paramDefs = getFuncParamDefs(funcDef);
  const argRef = exprToParamRef(expr, ctx, paramDefs[0], 'string');
  return mkFCRef({ functionDef: fdRef(funcDef), parameters: [argRef] }, ctx);
}
function typedPlusToOperatorFCRef(expr, ctx, expectedType) {
  while (expr?.kind === 126 /* SyntaxKind.ParenthesizedExpression */) expr = expr.expression;
  if (expr?.kind !== 124 /* SyntaxKind.BinaryExpression */) return undefined;
  const opKind = expr.operatorToken?.kind;
  if (opKind !== 20 /* SyntaxKind.PlusToken */) return undefined;
  const operands = [];
  collectArithmeticOperands(expr, opKind, operands);
  if (operands.length < 2) return undefined;
  const binaryName = expectedType === 'text' ? 'CombineText' : 'CombineStrings';
  const multName = expectedType === 'text' ? 'CombineTextMultiple' : 'CombineStringsMult';
  if (operands.length > 2) {
    const multDef = ctx.funcNameToFuncDef.get(multName);
    const paramDefs = getFuncParamDefs(multDef);
    if (multDef && paramDefs.length > 0) {
      return mkFCRef(
        {
          functionDef: fdRef(multDef),
          parameters: operands.map((o) => exprToParamRef(o, ctx, paramDefs[0], expectedType)),
        },
        ctx,
      );
    }
  }
  const funcDef = ctx.funcNameToFuncDef.get(binaryName);
  const paramDefs = getFuncParamDefs(funcDef);
  if (!funcDef || paramDefs.length < 2) return undefined;
  return mkFCRef(
    {
      functionDef: fdRef(funcDef),
      parameters: [
        exprToParamRef(expr.left, ctx, paramDefs[0], expectedType),
        exprToParamRef(expr.right, ctx, paramDefs[1], expectedType),
      ],
    },
    ctx,
  );
}
/** Lower a binary expression when TriggerData has a declared structural
 * representation for it.  Syntax-directed recovery calls this before its
 * generic template fallback so ordinary arithmetic/comparison expressions and
 * bit-mask presets never become editor-invalid `lf_BinaryExpression` helpers.
 * The formal ParamDef is authoritative for preset bit sets and string/text
 * concatenation; no content-specific identifier inference is used. */
export function tryBinaryExpressionParamData(expr, ctx, paramDefRef, expectedTypeHint) {
  while (expr?.kind === 126 /* SyntaxKind.ParenthesizedExpression */) expr = expr.expression;
  if (expr?.kind !== 124 /* SyntaxKind.BinaryExpression */) return undefined;
  const paramDef = paramDefRef ? resolveParamDefByRef(paramDefRef, ctx) : undefined;
  const presetBits = presetBitsParamData(expr, paramDef, ctx);
  if (presetBits) return presetBits;
  const expected = concreteExpectedType(paramDef?.paramType?.type?.toLowerCase(), expectedTypeHint);
  if (expected === 'text' || expected === 'string') {
    const stringOperator = typedPlusToOperatorFCRef(expr, ctx, expected);
    if (stringOperator) return { functionCall: stringOperator };
  }
  const comparison = binaryOpToComparisonStr(expr.operatorToken?.kind);
  if (comparison) {
    const call = comparisonToFCRef(expr.left, comparison, expr.right, undefined, ctx);
    if (call) return { functionCall: call };
  }
  const arithmetic = binaryArithToFCRef(expr, ctx);
  return arithmetic ? { functionCall: arithmetic } : undefined;
}
export function binaryArithToFCRef(expr, ctx) {
  const opKind = expr.operatorToken?.kind;
  const opStr = ARITHMETIC_OP_MAP[opKind];
  if (!opStr) return undefined;
  const isReal = isRealExpr(expr.left, ctx) || isRealExpr(expr.right, ctx);
  const funcName = isReal ? 'ArithmeticReal' : 'ArithmeticInt';
  const multFuncName = isReal ? 'ArithmeticRealMult' : 'ArithmeticIntMult';
  const operands = [];
  collectArithmeticOperands(expr, opKind, operands);
  if (operands.length > 2) {
    const multDef = ctx.funcNameToFuncDef.get(multFuncName);
    if (multDef) {
      const multParamDefs = multDef.parameters;
      const presetRef = ctx.galaxyConstToPreset.get(opStr);
      const opParamData = presetRef ? { preset: presetRef } : { value: opStr };
      if (multParamDefs?.[0]) opParamData.parameterDef = multParamDefs[0];
      const opRef = mkParamRef(opParamData, ctx);
      const valRefs = operands.map((o) => exprToParamRef(o, ctx, multParamDefs?.[1]));
      const data = {
        functionDef: fdRef(multDef),
        parameters: [opRef, ...valRefs],
      };
      return mkFCRef(data, ctx);
    }
  }
  const funcDef = ctx.funcNameToFuncDef.get(funcName);
  if (!funcDef) return undefined; // NativeLib not loaded — cannot produce a valid ref
  const paramDefs = funcDef.parameters;
  const val1Ref = exprToParamRef(expr.left, ctx, paramDefs?.[0]);
  const presetRef = ctx.galaxyConstToPreset.get(opStr);
  const opParamData = presetRef ? { preset: presetRef } : { value: opStr };
  if (paramDefs?.[1]) opParamData.parameterDef = paramDefs[1];
  const opRef = mkParamRef(opParamData, ctx);
  const val2Ref = exprToParamRef(expr.right, ctx, paramDefs?.[2]);
  const data = {
    functionDef: fdRef(funcDef),
    parameters: [val1Ref, opRef, val2Ref],
  };
  return mkFCRef(data, ctx);
}
// ---------------------------------------------------------------------------
// CallExpression → FunctionCall element ref
// ---------------------------------------------------------------------------
function functionDefMatchesGalaxyName(funcDef, galaxyName) {
  if (funcDef.name === galaxyName) return true;
  const sanitized = funcDef.name ? sanitizeFuncName(funcDef.name) : '';
  if (sanitized === galaxyName) return true;
  const scriptGalaxyName = funcDef.scriptCode?.match(/^([A-Za-z_]\w*)\s*\(/)?.[1];
  return scriptGalaxyName === galaxyName;
}
/** Native declarations by the Galaxy name they answer to, built once per library.
 *  The match is decidable from the declaration alone, so the scan that used to
 *  run per call -- 31k declarations in NativeLib, each sanitizing its name --
 *  becomes one lookup. The library object is the key, so a reparsed library
 *  indexes afresh. */
const nativeDefsByGalaxyName = new WeakMap();
function nativeGalaxyNameIndex(library, defs, libraryId) {
  const cached = nativeDefsByGalaxyName.get(library);
  if (cached) return cached;
  const index = new Map();
  const add = (name, funcDef) => {
    if (!name) return;
    const bucket = index.get(name);
    if (bucket === undefined) index.set(name, [funcDef]);
    else if (!bucket.includes(funcDef)) bucket.push(funcDef);
  };
  for (const funcDef of Object.values(defs)) {
    if ((funcDef.library ?? libraryId) !== libraryId) continue;
    add(funcDef.name, funcDef);
    if (funcDef.name) add(sanitizeFuncName(funcDef.name), funcDef);
    add(singleCallTemplateAlias(funcDef, library), funcDef);
  }
  nativeDefsByGalaxyName.set(library, index);
  return index;
}
function findNativeFuncDefByReturnType(ctx, galaxyName, expectedReturnType) {
  const expected = expectedReturnType?.toLowerCase();
  if (!expected) return undefined;
  const nativeLibrary = ctx.nativeLibrary;
  const nativeDefs = nativeLibrary?.elementsByType?.FunctionDef;
  if (!nativeLibrary || !nativeDefs) return undefined;
  const candidates = nativeGalaxyNameIndex(
    nativeLibrary,
    nativeDefs,
    nativeLibrary.id ?? 'Ntve',
  ).get(galaxyName);
  return candidates?.find((funcDef) => funcDef.returnType?.type?.toLowerCase() === expected);
}
function chooseFunctionDefForExpectedReturn(ctx, galaxyName, current, expectedReturnType) {
  const expected = expectedReturnType?.toLowerCase();
  if (!expected) return current;
  if (current?.returnType?.type?.toLowerCase() === expected) return current;
  if (current && (current.library ?? 'Ntve') !== (ctx.nativeLibrary?.id ?? 'Ntve')) return current;
  return findNativeFuncDefByReturnType(ctx, galaxyName, expected) ?? current;
}
export function callExprToFCRef(callExpr, subFuncTypeRef, ctx, expectedReturnTypeHint) {
  if (!callExpr || callExpr.kind !== 121 /* SyntaxKind.CallExpression */) return undefined;
  const calleeExpr = callExpr.expression;
  if (!calleeExpr || calleeExpr.kind !== 113 /* SyntaxKind.Identifier */) return undefined;
  const calleeName = calleeExpr.name;
  // Return values and nested arguments must use the same source-bound
  // resolution as statement calls. A lexical GUI cell is not a native API.
  const sourceResolution = resolveExpressionSourceCall(
    callExpr,
    ctx,
    expressionSourceRecoveryFor(ctx.elements),
    callExpr.parent?.kind === SyntaxKind.ExpressionStatement ? 'action' : 'value',
  );
  if (sourceResolution.status === 'AMBIGUOUS') return undefined;
  let funcDef = ctx.funcNameToFuncDef.get(calleeName);
  const libWrapperMatch = /^lib([A-Za-z0-9]+)_gf_([A-Za-z0-9_]+)$/.exec(calleeName);
  const wrappedLib = libWrapperMatch?.[1];
  const wrappedName = libWrapperMatch?.[2];
  // lib{LIB}_gf_{FuncName} — try plain name lookup for cross-library calls (e.g. libNtve_gf_*)
  if (!funcDef && wrappedName) {
    funcDef = libraryOwnedDefinition(ctx.funcNameToFuncDef.get(wrappedName), wrappedLib, ctx);
    if (funcDef) ctx.funcNameToFuncDef.set(calleeName, funcDef);
  }
  // User-defined library function: lib{LIB}_gf_{FuncName}
  if (!funcDef) {
    const userPrefix = `${libraryPrefix(ctx.libId)}gf_`;
    // An included Galaxy function may use the same gf_ spelling as a map's
    // authored functions. A known ABI is not a new zero-argument map function.
    if (calleeName.startsWith(userPrefix) && !ctx.externalFuncParamTypes?.has(calleeName)) {
      const funcName = calleeName.slice(userPrefix.length);
      const existingId = Object.keys(ctx.elements).find(
        (id) => ctx.elements[id].type === 'FunctionDef' && ctx.elements[id].name === funcName,
      );
      if (existingId) {
        funcDef = ctx.elements[existingId];
      } else {
        const id = idFromKey(`${ctx.libId}|gf|${funcName}`);
        const synth = {
          type: 'FunctionDef',
          id,
          library: ctx.libId,
          name: funcName,
          parameters: [],
        };
        ctx.elements[id] = synth;
        funcDef = synth;
      }
      ctx.funcNameToFuncDef.set(calleeName, funcDef);
    }
  }
  // Cross-library function from a previously converted library: lib{OTHER}_gf_{FuncName}
  if (!funcDef && wrappedLib && wrappedLib !== ctx.libId && ctx.crossLibFuncDefs) {
    const crossRef = ctx.crossLibFuncDefs.get(calleeName);
    if (crossRef) {
      const stub = {
        type: 'FunctionDef',
        id: crossRef.id,
        library: crossRef.library,
        name: wrappedName,
        parameters: crossRef.parameters ?? [],
      };
      funcDef = stub;
      ctx.funcNameToFuncDef.set(calleeName, funcDef);
    }
  }
  funcDef = chooseFunctionDefForExpectedReturn(
    ctx,
    wrappedName ?? calleeName,
    funcDef,
    expectedReturnTypeHint,
  );

  // Without a definition the reference below names nothing in any loaded library
  // (a map whose dependency mod is missing) and the document fails reference
  // validation. The structural pass keeps such a call as a synthesized template.
  if (!funcDef && ctx.structuredExpression)
    return ctx.structuredExpression(callExpr, subFuncTypeRef, ctx, expectedReturnTypeHint);
  const decodedUnknownTail = decodeUnknownSubFunctionTail(
    callExpr,
    ctx,
    callExprToFCRef,
    exprToConditionFCRef,
  );
  const args = decodedUnknownTail?.paramArgs ?? Array.from(callExpr.arguments ?? []);
  const parameters = args.map((arg, i) => {
    const paramDefRef = funcDef?.parameters?.[i];
    // TriggerData domains such as actormsg, gamelink and catalogfieldpath are
    // represented by primitive Galaxy ABI types. Keep the explicit ParamDef
    // as the semantic contract, but also pass the declaration's ABI type so a
    // `+` expression is recovered as string/text concatenation rather than an
    // integer arithmetic template.
    const expectedTypeHint = calleeName
      ? ctx.externalFuncParamTypes?.get(calleeName)?.[i]
      : undefined;
    return exprToParamRef(arg, ctx, paramDefRef, expectedTypeHint);
  });
  const unresolvedWrappedRef =
    !funcDef && wrappedLib && wrappedName
      ? { type: 'FunctionDef', library: wrappedLib, id: wrappedName }
      : undefined;
  const data = {
    functionDef: funcDef
      ? fdRef(funcDef)
      : (unresolvedWrappedRef ?? { type: 'FunctionDef', library: 'Ntve', id: calleeName }),
    parameters,
  };
  if ((decodedUnknownTail?.subFunctions.length ?? 0) > 0) {
    data.subFunctions = decodedUnknownTail.subFunctions;
  }
  if (subFuncTypeRef) data.subFunctionType = subFuncTypeRef;
  return mkFCRef(data, ctx);
}
// ---------------------------------------------------------------------------
// Comparison operator preset lookup
// ---------------------------------------------------------------------------
export function resolveCompOpPreset(opStr, compFuncDef, nativeLibrary) {
  if (!compFuncDef || !nativeLibrary) return undefined;
  const opParamRef = compFuncDef.parameters?.[1];
  if (!opParamRef) return undefined;
  const nb = nativeLibrary;
  const opParamDef = nb.elementsByType?.ParamDef?.[opParamRef.id];
  if (!opParamDef) return undefined;
  const presetRef = opParamDef.paramType?.typeElement;
  if (!presetRef?.id) return undefined;
  const preset = nb.elementsByType?.Preset?.[presetRef.id];
  if (!preset) return undefined;
  for (const valRef of preset.values ?? []) {
    const pv = nb.elementsByType?.PresetValue?.[valRef.id];
    if (pv?.value === opStr) {
      return {
        type: 'PresetValue',
        library: valRef.library ?? presetRef.library ?? 'Ntve',
        id: valRef.id,
      };
    }
  }
  return undefined;
}
// ---------------------------------------------------------------------------
// Comparison expression → FunctionCall element ref
// ---------------------------------------------------------------------------
export function comparisonToFCRef(left, opStr, right, subFuncTypeRef, ctx) {
  const compFuncDef = ctx.funcNameToFuncDef.get('Comparison');
  if (!compFuncDef) return undefined; // NativeLib not loaded
  const paramDefs = compFuncDef.parameters;
  const val1Ref = exprToParamRef(left, ctx, paramDefs?.[0]);
  const presetRef = resolveCompOpPreset(opStr, compFuncDef, ctx.nativeLibrary);
  const opParamData = presetRef ? { preset: presetRef } : { value: opStr };
  if (paramDefs?.[1]) opParamData.parameterDef = paramDefs[1];
  const opRef = mkParamRef(opParamData, ctx);
  const val2Ref = exprToParamRef(right, ctx, paramDefs?.[2]);
  const data = {
    functionDef: fdRef(compFuncDef),
    parameters: [val1Ref, opRef, val2Ref],
  };
  if (subFuncTypeRef) data.subFunctionType = subFuncTypeRef;
  return mkFCRef(data, ctx);
}
// ---------------------------------------------------------------------------
// Expression → condition FunctionCall ref
// ---------------------------------------------------------------------------
export function exprToConditionFCRef(expr, subFuncTypeRef, ctx) {
  if (!expr) return undefined;
  if (expr.kind === 126 /* SyntaxKind.ParenthesizedExpression */) {
    return exprToConditionFCRef(expr.expression, subFuncTypeRef, ctx);
  }
  if (expr.kind === 124 /* SyntaxKind.BinaryExpression */) {
    const opKind = expr.operatorToken.kind;
    const compStr = binaryOpToComparisonStr(opKind);
    if (compStr) {
      return comparisonToFCRef(expr.left, compStr, expr.right, subFuncTypeRef, ctx);
    }
    if (
      opKind === 34 /* SyntaxKind.AmpersandAmpersandToken */ ||
      opKind === 35 /* SyntaxKind.BarBarToken */
    ) {
      return logicalExprToConditionFCRef(expr, subFuncTypeRef, ctx);
    }
  }
  if (expr.kind === 121 /* SyntaxKind.CallExpression */) {
    return callExprToFCRef(expr, subFuncTypeRef, ctx);
  }
  if (expr.kind === 122 /* SyntaxKind.PrefixUnaryExpression */) {
    if (expr.operator?.kind === 32 /* SyntaxKind.ExclamationToken */) {
      const notDef = ctx.funcNameToFuncDef.get('Not');
      const roleMap = notDef
        ? buildFuncDefRoleMap(notDef, ctx.nativeLibrary, ctx.roleToSubFuncType)
        : ctx.roleToSubFuncType;
      const condRole = roleMap.get('cond') ?? roleMap.get('Conditions') ?? roleMap.get('If');
      const notSubFuncs = [];
      // eslint-disable-next-line no-inner-declarations
      function collectNotOperandRefs(e) {
        while (e?.kind === 126 /* SyntaxKind.ParenthesizedExpression */) e = e.expression;
        if (
          e?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
          e.operatorToken?.kind === 35 /* SyntaxKind.BarBarToken */
        ) {
          collectNotOperandRefs(e.left);
          collectNotOperandRefs(e.right);
          return;
        }
        const ref = exprToConditionFCRef(e, condRole, ctx);
        if (ref) notSubFuncs.push(ref);
      }
      collectNotOperandRefs(expr.operand);
      const data = {
        functionDef: notDef ? fdRef(notDef) : { type: 'FunctionDef', library: 'Ntve', id: 'Not' },
        subFunctions: notSubFuncs,
      };
      if (subFuncTypeRef) data.subFunctionType = subFuncTypeRef;
      return mkFCRef(data, ctx);
    }
  }
  if (
    expr.kind === 113 /* SyntaxKind.Identifier */ ||
    expr.kind === 119 /* SyntaxKind.ElementAccessExpression */ ||
    expr.kind === 120 /* SyntaxKind.PropertyAccessExpression */ ||
    expr.kind === 67 /* SyntaxKind.TrueKeyword */ ||
    expr.kind === 68 /* SyntaxKind.FalseKeyword */
  ) {
    return comparisonToFCRef(
      expr,
      '==',
      { kind: 67 /* SyntaxKind.TrueKeyword */ },
      subFuncTypeRef,
      ctx,
    );
  }
  return undefined;
}
export function collectConditionRefs(expr, subFuncTypeRef, ctx) {
  if (!expr) return [];
  if (expr.kind === 126 /* SyntaxKind.ParenthesizedExpression */) {
    return collectConditionRefs(expr.expression, subFuncTypeRef, ctx);
  }
  // A condition compared with a boolean literal, `((a >= 1) && (a <= 2)) == true`,
  // has no Comparison form: its operand is not a parameter value. Unwrap it (or
  // negate it). Any value operand, `F(x) == false` or `lv_flag == true`, stays the
  // Comparison the editor prints; rewriting those too turned 171 + 136 comparisons
  // of a restored Star Party v into `!(x)` and a bare `x`.
  if (
    expr.kind === 124 /* SyntaxKind.BinaryExpression */ &&
    [17 /* SyntaxKind.EqualsEqualsToken */, 18 /* SyntaxKind.ExclamationEqualsToken */].includes(
      expr.operatorToken?.kind,
    )
  ) {
    const unwrap = (node) => {
      while (node?.kind === 126 /* SyntaxKind.ParenthesizedExpression */) node = node.expression;
      return node;
    };
    const booleanValue = (node) => {
      node = unwrap(node);
      if (node?.kind === 67 /* SyntaxKind.TrueKeyword */) return true;
      if (node?.kind === 68 /* SyntaxKind.FalseKeyword */) return false;
      return undefined;
    };
    const leftBool = booleanValue(expr.left);
    const rightBool = booleanValue(expr.right);
    const operand = leftBool === undefined ? expr.left : expr.right;
    const inner = unwrap(operand);
    const conditionOperand =
      (inner?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
        !!binaryOpToComparisonStr(inner.operatorToken?.kind)) ||
      (inner?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
        [34 /* SyntaxKind.AmpersandAmpersandToken */, 35 /* SyntaxKind.BarBarToken */].includes(
          inner.operatorToken?.kind,
        )) ||
      (inner?.kind === 122 /* SyntaxKind.PrefixUnaryExpression */ &&
        inner.operator?.kind === 32); /* SyntaxKind.ExclamationToken */
    if ((leftBool === undefined) !== (rightBool === undefined) && conditionOperand) {
      const expected = leftBool ?? rightBool;
      const negate =
        (expr.operatorToken.kind === 17) /* SyntaxKind.EqualsEqualsToken */ !== expected;
      if (!negate) {
        const refs = collectConditionRefs(operand, subFuncTypeRef, ctx);
        if (refs.length) return refs;
      } else {
        const ref = exprToConditionFCRef(
          {
            kind: 122 /* SyntaxKind.PrefixUnaryExpression */,
            operator: { kind: 32 /* SyntaxKind.ExclamationToken */ },
            operand,
          },
          subFuncTypeRef,
          ctx,
        );
        if (ref) return [ref];
      }
    }
  }
  if (
    expr.kind === 124 /* SyntaxKind.BinaryExpression */ &&
    expr.operatorToken?.kind === 34 /* SyntaxKind.AmpersandAmpersandToken */
  ) {
    const collectSide = (side) => {
      if (side?.kind === 126 /* SyntaxKind.ParenthesizedExpression */) {
        const inner = side.expression;
        if (
          inner?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
          inner.operatorToken?.kind === 34 /* SyntaxKind.AmpersandAmpersandToken */
        ) {
          const groupedRef = exprToConditionFCRef(side, subFuncTypeRef, ctx);
          return groupedRef ? [groupedRef] : [];
        }
      }
      return collectConditionRefs(side, subFuncTypeRef, ctx);
    };
    return [...collectSide(expr.left), ...collectSide(expr.right)];
  }
  const ref = exprToConditionFCRef(expr, subFuncTypeRef, ctx);
  return ref ? [ref] : [];
}
export function logicalExprToConditionFCRef(binExpr, subFuncTypeRef, ctx) {
  const isOr = binExpr.operatorToken.kind === 35; /* SyntaxKind.BarBarToken */
  const funcName = isOr ? 'Or' : 'And';
  const funcDef = ctx.funcNameToFuncDef.get(funcName);
  const roleMap = funcDef
    ? buildFuncDefRoleMap(funcDef, ctx.nativeLibrary, ctx.roleToSubFuncType)
    : ctx.roleToSubFuncType;
  const leafCondRole = roleMap.get('cond') ?? roleMap.get('Conditions') ?? roleMap.get('If');
  const leafRefs = [];
  function collect(e) {
    if (e?.kind === 124 /* SyntaxKind.BinaryExpression */) {
      const opKind = e.operatorToken?.kind;
      const matchOp = isOr
        ? 35 /* SyntaxKind.BarBarToken */
        : 34; /* SyntaxKind.AmpersandAmpersandToken */
      if (opKind === matchOp) {
        collect(e.left);
        collect(e.right);
        return;
      }
    }
    const ref = exprToConditionFCRef(e, leafCondRole, ctx);
    if (ref) leafRefs.push(ref);
  }
  collect(binExpr);
  const data = {
    functionDef: funcDef ? fdRef(funcDef) : { type: 'FunctionDef', library: 'Ntve', id: funcName },
    subFunctions: leafRefs,
  };
  if (subFuncTypeRef) data.subFunctionType = subFuncTypeRef;
  return mkFCRef(data, ctx);
}
//# sourceMappingURL=g2t-call.js.map

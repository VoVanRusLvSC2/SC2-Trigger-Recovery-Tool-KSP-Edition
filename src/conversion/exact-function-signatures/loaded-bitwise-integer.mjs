// Bind actual loaded NativeLib arithmetic/preset elements, never synthesize Native.

import { SyntaxKind as K } from './index-alternate-3.js';

const operators = new Map([
  [K.AmpersandToken, '&'],
  [K.BarToken, '|'],
  [K.CaretToken, '^'],
  [K.LessThanLessThanToken, '<<'],
  [K.GreaterThanGreaterThanToken, '>>'],
]);

const compounds = new Map([
  [K.AmpersandEqualsToken, K.AmpersandToken],
  [K.BarEqualsToken, K.BarToken],
  [K.CaretEqualsToken, K.CaretToken],
  [K.LessThanLessThanEqualsToken, K.LessThanLessThanToken],
  [K.GreaterThanGreaterThanEqualsToken, K.GreaterThanGreaterThanToken],
]);

export function loadedBitwiseExpression(expr, ctx, api) {
  const op = operators.get(expr?.operatorToken?.kind);
  if (!op) return;

  if (api.isRealExpr(expr.left, ctx) || api.isRealExpr(expr.right, ctx)) return;

  const lib = ctx.nativeLibrary,
    def = ctx.funcNameToFuncDef.get('ArithmeticInt2');

  if (
    !lib ||
    def?.library !== lib.id ||
    def.type !== 'FunctionDef' ||
    !def.flags?.includes('Call') ||
    !def.flags.includes('Operator') ||
    def.returnType?.type !== 'int' ||
    def.parameters?.length !== 3
  )
    return;

  const elements = def.parameters.map((ref) => api.lookupElement([lib], ref, ctx.libId));

  if (
    elements.some((p) => p?.type !== 'ParamDef') ||
    elements[0].paramType?.type !== 'int' ||
    elements[2].paramType?.type !== 'int' ||
    elements[1].paramType?.type !== 'preset'
  )
    return;

  const preset = api.lookupElement([lib], elements[1].paramType.typeElement, ctx.libId);

  if (preset?.type !== 'Preset' || !Array.isArray(preset.values)) return;

  const values = preset.values
    .map((ref) => ({ ref, value: api.lookupElement([lib], ref, ctx.libId) }))
    .filter((x) => x.value?.type === 'PresetValue' && x.value.value === op);

  if (values.length !== 1) return;

  const left = api.exprToParamRef(expr.left, ctx, def.parameters[0]);

  const operation = api.mkParamRef({ preset: values[0].ref, parameterDef: def.parameters[1] }, ctx);

  const right = api.exprToParamRef(expr.right, ctx, def.parameters[2]);

  return api.mkFCRef({ functionDef: api.fdRef(def), parameters: [left, operation, right] }, ctx);
}

export const isBitwiseCompoundAssignment = (expr) => compounds.has(expr?.operatorToken?.kind);

export function lowerLiteralBitwiseAssignment(expr, targetType) {
  const operator = compounds.get(expr?.operatorToken?.kind);

  if (!operator || !['int', 'byte'].includes(targetType) || expr.left?.kind !== K.Identifier)
    return;

  const rhs = expr.right;

  // Literal-only RHS ensures the original value is read at the same point,

  // without duplicating an address calculation or reordering effects. Byte

  // assignment retains the same implicit narrowing store as compound assignment.

  const text = rhs?.text ?? '',
    value = Number(rhs?.value);

  if (
    rhs?.kind !== K.NumericLiteral ||
    !/^(?:[0-9]+|0[xX][0-9a-fA-F]+|0[bB][01]+)$/u.test(text) ||
    !Number.isInteger(value) ||
    value !== Number(text) ||
    value < 0 ||
    value > 0x7fffffff
  )
    return;

  if ([K.LessThanLessThanToken, K.GreaterThanGreaterThanToken].includes(operator) && value > 31)
    return;

  return {
    ...expr,
    operatorToken: { kind: K.EqualsToken },
    right: {
      kind: K.BinaryExpression,
      left: expr.left,
      operatorToken: { kind: operator },
      right: rhs,
    },
  };
}

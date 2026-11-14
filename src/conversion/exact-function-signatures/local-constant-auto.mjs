import { SyntaxKind as K } from './index-alternate-3.js';
const argumentKeys = new Set([
  'id',
  'type',
  'library',
  'parameterDef',
  'variable',
  'name',
  'identifier',
  'displayName',
]);
const initializerKeys = new Set([
  'id',
  'type',
  'library',
  'value',
  'valueType',
  'name',
  'identifier',
  'displayName',
]);
const only = (node, keys) =>
  Object.entries(node).every(([k, value]) => value === undefined || keys.has(k));
const parenthesized = (node) => node?.kind === K.ParenthesizedExpression;
const identifier = (node) => node?.kind === K.Identifier;
const variableElement = (node) => node?.type === 'Variable';
const paramElement = (node) => node?.type === 'Param';
export function isKnownLocalTemplateArgument(actuals, ctx) {
  const p = actuals?.length === 1 ? actuals[0] : undefined;
  return (
    !!p?.paramRef ||
    (!!p?.variable &&
      (p.variable.library ?? p.library ?? ctx.library.id) === ctx.library.id &&
      ctx.localVarIds.has(p.variable.id))
  );
}
/** Only scalar numeric local constants with direct literal initializers. */
export function isLocalLiteralConstantAutoArgument(
  expression,
  actuals,
  expectedType,
  ctx,
  resolve,
  nameOf,
) {
  while (parenthesized(expression)) expression = expression.expression;
  if (!identifier(expression) || !['int', 'fixed'].includes(expectedType) || actuals?.length !== 1)
    return false;
  const param = actuals[0];
  if (
    param?.type !== 'Param' ||
    !param.variable ||
    !only(param, argumentKeys) ||
    (param.library ?? ctx.library.id) !== ctx.library.id ||
    (param.variable.library ?? param.library ?? ctx.library.id) !== ctx.library.id
  )
    return false;
  const variable = resolve(param.variable, ctx.library, ctx.nativeLibrary, ctx.allLibraries);
  if (
    !variableElement(variable) ||
    variable.id !== param.variable.id ||
    (variable.library ?? ctx.library.id) !== ctx.library.id ||
    !ctx.localVarIds.has(variable.id) ||
    variable.isConstant !== true ||
    variable.disabled ||
    variable.isArray ||
    variable.arraySizes?.length ||
    !variable.initialValue ||
    variable.variableType?.type !== expectedType ||
    Object.entries(variable.variableType).some(
      ([k, value]) => value !== undefined && k !== 'type',
    ) ||
    expression.name !== nameOf(variable)
  )
    return false;
  if ((variable.initialValue.library ?? variable.library ?? ctx.library.id) !== ctx.library.id)
    return false;
  const initializer = resolve(
    variable.initialValue,
    ctx.library,
    ctx.nativeLibrary,
    ctx.allLibraries,
  );
  if (
    !paramElement(initializer) ||
    (initializer.library ?? ctx.library.id) !== ctx.library.id ||
    !only(initializer, initializerKeys) ||
    initializer.valueType?.type !== expectedType ||
    Object.entries(initializer.valueType).some(
      ([k, value]) => value !== undefined && k !== 'type',
    ) ||
    typeof initializer.value !== 'string'
  )
    return false;
  const pattern = expectedType === 'int' ? /^-?[0-9]+$/u : /^-?[0-9]+(?:\.[0-9]+)?$/u;
  if (!pattern.test(initializer.value) || !Number.isFinite(Number(initializer.value))) return false;
  for (const id of ctx.localVarIds) {
    if (id === variable.id) continue;
    const other = resolve(
      { id, type: 'Variable', library: ctx.library.id },
      ctx.library,
      ctx.nativeLibrary,
      ctx.allLibraries,
    );
    if (variableElement(other) && nameOf(other) === expression.name) return false;
  }
  return true;
}

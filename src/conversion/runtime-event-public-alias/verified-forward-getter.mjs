import { AsyncLocalStorage } from 'node:async_hooks';

import { verifiedGetterDetails } from './getter-capability.mjs';

import { toGalaxyFunctionName as original } from '../native-expression-identity/core-alternate.mjs';

const scope = new AsyncLocalStorage();

export function withVerifiedGetterScope(capability, operation) {
  if (capability === undefined) return operation();

  const details = verifiedGetterDetails(capability);

  if (!details) throw new Error('Verified forward getter capability is absent');

  return scope.run(details, operation);
}

export function verifiedForwardGetterName(definition, ctx) {
  const details = scope.getStore();

  if (!details || !definition) return;

  const facts = details.bindings.filter(
    (b) =>
      definition.library === b.library &&
      definition.id === b.id &&
      definition.name === b.alias &&
      definition.identifier === b.alias,
  );

  if (facts.length !== 1) return;

  const fact = facts[0],
    native = ctx.nativeLibrary;

  if (
    native?.id !== fact.library ||
    native.elementsByType?.FunctionDef?.[definition.id] !== definition
  )
    return;

  if (
    !definition.flags?.includes('Native') ||
    !definition.flags.includes('Call') ||
    definition.scriptCode ||
    definition.disabled ||
    definition.parameters.length !== 0 ||
    definition.returnType?.type !== fact.returnType ||
    definition.returnType.typeElement
  )
    return;

  return fact.alias;
}

export function toGalaxyFunctionName(definition, ctx, fallback) {
  // Callee spelling can depend on the actual legacy loop template. A

  // blanket Native identifier override changed Current to Deprecated on 0432.

  // Preserve the existing rule; explicit original Deprecated aliases remain

  // REVIEW until their engine semantics and Editor expansion are proved.

  return verifiedForwardGetterName(definition, ctx) ?? original(definition, ctx, fallback);
}

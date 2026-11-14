import profile from '../../bindings/unit-snapshot-projection.qualified.json' with { type: 'json' };
import { SyntaxKind as K } from './index-alternate-3.js';
import { declaredCarrier } from './galaxy-program-context.identity.mjs';
const stable = (v) =>
  !v || typeof v !== 'object'
    ? v
    : Array.isArray(v)
      ? v.map(stable)
      : Object.fromEntries(
          Object.keys(v)
            .sort()
            .filter((k) => v[k] !== undefined)
            .map((k) => [k, stable(v[k])]),
        );
const same = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
const fields = [
  'type',
  'id',
  'library',
  'identifier',
  'flags',
  'returnType',
  'parameters',
  'paramType',
  'isReference',
  'scriptCode',
  'expressionCode',
  'actions',
  'localVariables',
  'disabled',
];
const contract = (e) =>
  e && Object.fromEntries(fields.filter((k) => e[k] !== undefined).map((k) => [k, e[k]]));
const unwrap = (n) => {
  while (n?.kind === K.ParenthesizedExpression) n = n.expression;
  return n;
};

/** A source constructor is not a GUI cast. Resolve its actual declaration,
 * then use only the stock projection whose native export was qualified.
 * No function is synthesized, and the operand is evaluated once in place. */
export function qualifiedUnitSnapshot(call, ctx, formal, session) {
  if (
    formal?.type !== 'ParamDef' ||
    formal.isReference !== true ||
    formal.paramType?.type !== 'unit' ||
    !session
  )
    return undefined;
  const callee = unwrap(call?.expression),
    p = session.program,
    s = profile.source;
  if (
    call?.kind !== K.CallExpression ||
    callee?.kind !== K.Identifier ||
    callee.name !== s.symbol ||
    call.arguments.length !== s.parameters.length
  )
    return undefined;
  if (
    p.getBinding(callee).status !== 'BOUND' ||
    p.conflictingDeclarationNames().includes(callee.name)
  )
    return undefined;
  const declaration = p.declarationAt(callee);
  if (
    declaration?.kind !== K.FunctionDeclaration ||
    declaration.body ||
    !declaration.modifiers?.some((m) => m.kind === K.NativeKeyword)
  )
    return undefined;
  if (
    declaredCarrier(declaration.type) !== s.returnType ||
    !same(
      declaration.parameters.map((a) => declaredCarrier(a.type)),
      s.parameters,
    )
  )
    return undefined;
  let source = declaration;
  while (source.parent) source = source.parent;
  const owner = p.verifiedInputIdentity(source.fileName);
  if (
    owner?.owned !== false ||
    !owner.contentSha256 ||
    (p.globals.get(callee.name)?.declarations ?? []).some((d) => d.body)
  )
    return undefined;
  const native = ctx.nativeLibrary,
    t = profile.target;
  if (native?.id !== t.definition.library) return undefined;
  const inputs = (p.snapshot?.dependencies ?? []).filter((d) => d.libraryId === native.id);
  if (inputs.length !== 1 || inputs[0].contentSha256 !== profile.metadata.sha256) return undefined;
  const definition = native.elements?.['FunctionDef:' + t.definition.id],
    parameter = native.elements?.['ParamDef:' + t.formal.id];
  if (!same(contract(definition), t.definition) || !same(contract(parameter), t.formal))
    return undefined;
  return {
    definition,
    formal: parameter,
    value: unwrap(call.arguments[0]),
    metadataSha256: profile.metadata.sha256,
  };
}

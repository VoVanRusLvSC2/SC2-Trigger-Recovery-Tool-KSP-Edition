import { SyntaxKind as K } from '../sdk/array-values/modules/galaxy/language-core/index.js';
import { readStringLiteralValue } from '../types/string-literal-value.mjs';
const un = (node) => {
  while (node?.kind === K.ParenthesizedExpression) node = node.expression;
  return node;
};

// Source shape only. An obfuscated constructor name is not the handle name.
// Never grant API, GUI, startup timing, callback ABI or alias-renaming authority
// from this classification; each needs its own bound source proof.
export function declaredTriggerConstructorFrame(fn) {
  if (
    fn?.kind !== K.FunctionDeclaration ||
    !fn.body ||
    fn.type.kind !== K.VoidKeyword ||
    fn.parameters.length ||
    fn.modifiers?.length
  )
    return;
  const statement = fn.body.statements.find((n) => n.kind !== K.VariableDeclaration),
    assignment = un(statement?.expression);
  const target = un(assignment?.left),
    call = un(assignment?.right),
    callee = un(call?.expression);
  if (
    statement?.kind !== K.ExpressionStatement ||
    assignment?.kind !== K.BinaryExpression ||
    assignment.operatorToken.kind !== K.EqualsToken ||
    target?.kind !== K.Identifier ||
    call?.kind !== K.CallExpression ||
    callee?.kind !== K.Identifier ||
    callee.name !== 'TriggerCreate' ||
    call.arguments.length !== 1 ||
    un(call.arguments[0])?.kind !== K.StringLiteral
  )
    return;
  const literal = un(call.arguments[0]),
    decoded = readStringLiteralValue(literal.text);
  if (!decoded) return;
  return {
    sourceFunction: fn.name.name,
    handle: target.name,
    callback: decoded.value,
    conventionalConstructor: target.name + '_Init',
    conventionalCallback: target.name + '_Func',
    classificationOnly: true,
    guiOrAbiProved: false,
    renamingAuthorized: false,
    startupMovementAuthorized: false,
  };
}

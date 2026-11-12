import {SyntaxKind as K,Scanner} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {createStringLiteral,createBinaryExpression} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/triggers/services/galaxy-conversion/internal/ast-factory.js';

// Editor's metadata initializer path can interpret a string's scalar spelling
// as an implicit default (observed for "0" and "false" in native exports).
// Match canonical scalar spellings, not all strings with the same numeric value.
// Native MCP probes preserve leading zeros, signs, decimals and whitespace.
export function hasDefaultScalarSpelling(text) {
  if(typeof text!=='string'||!text.length)return false;
  const scanner=new Scanner();scanner.setText(text);
  let kind=scanner.scan();
  if(kind===K.PlusToken||kind===K.MinusToken)kind=scanner.scan();
  const matches=kind===K.FalseKeyword||kind===K.NullKeyword||
    kind===K.NumericLiteral&&Number(scanner.getTokenText())===0;
  const canonical=kind===K.FalseKeyword?String(false):kind===K.NullKeyword?String(null):String(Number(scanner.getTokenText()));
  return matches&&scanner.scan()===K.EndOfFileToken&&text===canonical;
}

/** A standard GUI string concatenation retains the exact literal value while
 * making the metadata initializer explicit. No new runtime function, Native,
 * ScriptCode, source edit or persistent cache. Existing untouched GUI bypasses
 * reconstruction and remains protected by the incremental preservation gate. */
export function stringInitializerCarrier(expression,variable) {
  if(variable?.variableType?.type!=='string'||variable.isConstant)return expression;
  let literal=expression;
  while(literal?.kind===K.ParenthesizedExpression)literal=literal.expression;
  if(literal?.kind!==K.StringLiteral||!hasDefaultScalarSpelling(literal.value))return expression;
  return createBinaryExpression(createStringLiteral(''),K.PlusToken,expression);
}

// Comparison-only repair of the SDK's loose StringLiteral.value. Keep every
// existing semantic shape field; only literal payloads use exact decoded bytes.
import assert from 'node:assert/strict';
import {SyntaxKind as K} from "./index-alternate-3.js";
import {readStringLiteralValue} from "./string-literal-value.mjs";

export function literalByteSyntaxShape(node, syntaxShape) {
  function repair(shape, source) {
    while (source?.kind === K.ParenthesizedExpression) source = source.expression;
    if (Array.isArray(shape)) return shape.map((value, i) => repair(value, source?.[i]));
    if (!shape || typeof shape !== 'object' || !source || typeof source !== 'object') return shape;
    if (source.kind === K.StringLiteral) {
      const value = readStringLiteralValue(source.text);
      assert(value, 'UNPROVED_STRING_LITERAL_COMPARISON');
      return {...shape, value: value.bytes.toString('hex')};
    }
    for (const name of Object.keys(shape)) shape[name] = repair(shape[name], source[name]);
    return shape;
  }
  return repair(syntaxShape(node), node);
}

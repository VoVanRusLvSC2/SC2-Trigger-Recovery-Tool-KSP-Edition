// GUI stores a quoted attribute selector as a Galaxy string token. Decode
// that token once before the AST factory escapes its semantic value again.
// Unquoted values are the converter's intermediate scalar representation.
import assert from 'node:assert/strict';
import {readStringLiteralValue} from "./string-literal-value.mjs";

export function decodeAttributeSelectorScalar(value) {
  assert.equal(typeof value,'string','ATTRIBUTE_SELECTOR_SCALAR_REQUIRED');
  if (!value.startsWith('"')) return value;
  const literal=readStringLiteralValue(value);
  assert(literal && !literal.needsPreset,'INVALID_QUOTED_ATTRIBUTE_SELECTOR');
  assert(!/[\u0000-\u001f\u007f]/u.test(literal.value),'ATTRIBUTE_SELECTOR_CONTROL_CHARACTER');
  return literal.value;
}

export function encodeAttributeSelectorScalar(value) {
  assert.equal(typeof value,'string','ATTRIBUTE_SELECTOR_SCALAR_REQUIRED');
  assert(!/[\u0000-\u001f\u007f]/u.test(value),'ATTRIBUTE_SELECTOR_CONTROL_CHARACTER');
  return JSON.stringify(value);
}

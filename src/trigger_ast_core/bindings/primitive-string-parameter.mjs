// A primitive byte literal must reach the existing source-bound Preset binder
// before the legacy scanner's decoded string can discard an escape.
import {xmlControlLiteralParam as previous} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/xml-control-literal.js';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
export function xmlControlLiteralParam(value, sourceToken) {
  if (typeof sourceToken !== 'string' || !/[\\\x00-\x1f\x7f]/u.test(sourceToken)) return previous(value, sourceToken);
  const literal = readStringLiteralValue(sourceToken);
  if (literal && (typeof value !== 'string' || !Buffer.from(value, 'utf8').equals(literal.bytes))) {
    return {scriptCode: literal.xmlToken, valueType: {type: 'string'}};
  }
  return previous(value, sourceToken);
}

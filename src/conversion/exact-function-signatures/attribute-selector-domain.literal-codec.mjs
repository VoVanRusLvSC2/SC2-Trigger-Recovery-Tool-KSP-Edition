import { quoteAttributeSelectorScalar as oldQuote } from '../../libraries/gui/attribute-selector-domain.mjs';
import { encodeAttributeSelectorScalar } from './attribute-selector-scalar.mjs';
export { coerceAttributeSelectorDomain } from '../../libraries/gui/attribute-selector-domain.mjs';

export function quoteAttributeSelectorScalar(data) {
  const value = data.value;
  if (!oldQuote(data)) return false;
  data.value = encodeAttributeSelectorScalar(value);
  return true;
}

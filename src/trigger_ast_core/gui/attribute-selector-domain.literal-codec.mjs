import {quoteAttributeSelectorScalar as oldQuote} from '../../queue_audit_2026-10-15/attribute-selector-domain.mjs';
import {encodeAttributeSelectorScalar} from '../types/attribute-selector-scalar.mjs';
export {coerceAttributeSelectorDomain} from '../../queue_audit_2026-10-15/attribute-selector-domain.mjs';

export function quoteAttributeSelectorScalar(data) {
  const value=data.value;
  if (!oldQuote(data)) return false;
  data.value=encodeAttributeSelectorScalar(value);
  return true;
}

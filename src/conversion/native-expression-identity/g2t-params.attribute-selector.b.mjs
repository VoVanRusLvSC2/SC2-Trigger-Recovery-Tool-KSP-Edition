// Preserve this exact original module's other codecs and fallback behavior.
export * from './g2t-params-alternate.mjs';
import { coerceStringDomainType as original } from './g2t-params-alternate.mjs';
import { coerceAttributeSelectorDomain } from '../../libraries/gui/attribute-selector-domain.mjs';
export function coerceStringDomainType(data, expected) {
  if (!coerceAttributeSelectorDomain(data, expected)) return original(data, expected);
}

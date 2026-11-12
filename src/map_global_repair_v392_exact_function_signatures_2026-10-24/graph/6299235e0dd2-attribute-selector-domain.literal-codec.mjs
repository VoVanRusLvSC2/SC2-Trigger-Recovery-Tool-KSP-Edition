import {quoteAttributeSelectorScalar as oldQuote} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/queue_audit_2026-10-15/attribute-selector-domain.mjs';
import {encodeAttributeSelectorScalar} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/6a0bcf09d962-attribute-selector-scalar.mjs';
export {coerceAttributeSelectorDomain} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/queue_audit_2026-10-15/attribute-selector-domain.mjs';

export function quoteAttributeSelectorScalar(data) {
  const value=data.value;
  if (!oldQuote(data)) return false;
  data.value=encodeAttributeSelectorScalar(value);
  return true;
}

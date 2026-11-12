// Preserve this exact original module's other codecs and fallback behavior.
export * from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v256_closed_aggregate_ownership_2026-10-20/graph/baf968a2ddab6d2f-2c14364ae674-g2t-params.mjs';
import {coerceStringDomainType as original} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v256_closed_aggregate_ownership_2026-10-20/graph/baf968a2ddab6d2f-2c14364ae674-g2t-params.mjs';
import {coerceAttributeSelectorDomain} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/queue_audit_2026-10-15/attribute-selector-domain.mjs';
export function coerceStringDomainType(data,expected){
 if(!coerceAttributeSelectorDomain(data,expected))return original(data,expected);
}

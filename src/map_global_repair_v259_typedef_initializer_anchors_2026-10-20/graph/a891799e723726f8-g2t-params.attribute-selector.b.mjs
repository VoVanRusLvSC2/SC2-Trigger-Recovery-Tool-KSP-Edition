// Preserve this exact original module's other codecs and fallback behavior.
export * from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v259_typedef_initializer_anchors_2026-10-20/graph/5600f789a11b3a70-bc9777438211-g2t-params.mjs';
import {coerceStringDomainType as original} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v259_typedef_initializer_anchors_2026-10-20/graph/5600f789a11b3a70-bc9777438211-g2t-params.mjs';
import {coerceAttributeSelectorDomain} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/queue_audit_2026-10-15/attribute-selector-domain.mjs';
export function coerceStringDomainType(data,expected){
 if(!coerceAttributeSelectorDomain(data,expected))return original(data,expected);
}

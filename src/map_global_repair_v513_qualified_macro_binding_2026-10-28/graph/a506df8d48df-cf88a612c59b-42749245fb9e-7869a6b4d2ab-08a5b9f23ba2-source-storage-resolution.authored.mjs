import {resolveAuthoredSourceValue,resolveAuthoredSourceAggregate} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v513_qualified_macro_binding_2026-10-28/graph/f12e36cfa90f-2c70cb-7d506cf52b50-d9a31d16ab8a-d5bd411a391b-7c392960f347-authored-storage-interfaces.mjs';
import {resolvePreservedSourceValue as includedValue,resolvePreservedSourceAggregate as includedAggregate} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v513_qualified_macro_binding_2026-10-28/graph/6c8e7632f9e0-a-001e9d0cef74-71588ccf11d1-preserved-source-aggregate-interfaces.dependency-functions.mjs';

// Both ownership paths retain their original checks. An authored-section
// binding needs its live AST proof; an include binding keeps its closed file.
export const resolvePreservedSourceValue=binding=>resolveAuthoredSourceValue(binding)??includedValue(binding);
export const resolvePreservedSourceAggregate=binding=>resolveAuthoredSourceAggregate(binding)??includedAggregate(binding);

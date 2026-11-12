import {boundSourceAggregateAccess} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/2c3fb98f23b6-bound-source-access.formals.mjs';
const unresolved=new Set(['any','anyvariable','anycompare','sameas','sameasparent','return','void']);

// Preserve an existing nominal GUI domain. Only missing/relational types may
// be refined from the exact source-owned PropertyDeclaration and array axes.
// The binding scope verifies source identity; names alone never select a type.
export function refineBoundAggregateResult(node,current,convert){
 if(current?.type&&!unresolved.has(current.type))return current;
 const access=boundSourceAggregateAccess(node),candidate=access&&convert(access.elementType);
 return candidate?.type&&!unresolved.has(candidate.type)?candidate:current;
}

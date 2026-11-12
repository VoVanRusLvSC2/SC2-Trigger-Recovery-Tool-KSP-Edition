/** Only ABI-checked Trigger callback guards use this recognition.
 * Calls, members, false comparisons and numeric truthiness are not accepted.
 */
import {unwrapParens} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v258_bound_typedef_abi_2026-10-20/graph/d14d4b948618471b-g2t-core.mjs';
export function triggerBoolGuard(expression,name) {
 const node=unwrapParens(expression);
 if(node?.kind===113)return node.name===name;
 return node?.kind===124&&node.operatorToken?.kind===17&&
   unwrapParens(node.left)?.kind===113&&unwrapParens(node.left).name===name&&
   unwrapParens(node.right)?.kind===67;
}

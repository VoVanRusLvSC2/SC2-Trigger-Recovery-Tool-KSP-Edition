/** Only ABI-checked Trigger callback guards use this recognition.
 * Calls, members, false comparisons and numeric truthiness are not accepted.
 */
import {unwrapParens} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/39db0c9c9123-ae8e39bac3e6-0131c278e7d7-3449b17ca5f9-174ab517065c-g2t-core.generated-call-provenance.mjs';
export function triggerBoolGuard(expression,name) {
 const node=unwrapParens(expression);
 if(node?.kind===113)return node.name===name;
 return node?.kind===124&&node.operatorToken?.kind===17&&
   unwrapParens(node.left)?.kind===113&&unwrapParens(node.left).name===name&&
   unwrapParens(node.right)?.kind===67;
}

/** Only ABI-checked Trigger callback guards use this recognition.
 * Calls, members, false comparisons and numeric truthiness are not accepted.
 */
import {unwrapParens} from "./g2t-core.generated-call-provenance.mjs";
export function triggerBoolGuard(expression,name) {
 const node=unwrapParens(expression);
 if(node?.kind===113)return node.name===name;
 return node?.kind===124&&node.operatorToken?.kind===17&&
   unwrapParens(node.left)?.kind===113&&unwrapParens(node.left).name===name&&
   unwrapParens(node.right)?.kind===67;
}

/** Exact, side-effect-free duration equality for Wait-with-timeout reconstruction.
 * Different literals and arbitrary calls must fall back to the original AST loop.
 */
export function sameStableWaitDuration(left,right){
 const unwrap=n=>{while(n?.kind===126)n=n.expression;return n;};
 left=unwrap(left);right=unwrap(right);
 if(!left||!right||left.kind!==right.kind)return false;
 if(left.kind===113)return left.name===right.name;
 if(left.kind===2)return (left.text??left.value)===(right.text??right.value);
 if(left.kind===122)return left.operator?.kind===right.operator?.kind&&[20,21].includes(left.operator?.kind)&&sameStableWaitDuration(left.operand,right.operand);
 if(left.kind===124)return left.operatorToken?.kind===right.operatorToken?.kind&&[20,21,22,23,24].includes(left.operatorToken?.kind)&&sameStableWaitDuration(left.left,right.left)&&sameStableWaitDuration(left.right,right.right);
 return false;
}

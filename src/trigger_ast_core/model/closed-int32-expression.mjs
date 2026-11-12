import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const min=-2147483648n,max=2147483647n,bounded=n=>n>=min&&n<=max;
/** Exact, total constant fragment. Each intermediate must fit signed int32;
 * unknown types, division, runtime reads, calls and overflowing shifts refuse. */
export function evaluateClosedInt32(node,depth=0){
 if(!node||depth>64)return;
 if(node.kind===K.ParenthesizedExpression)return evaluateClosedInt32(node.expression,depth+1);
 if(node.kind===K.NumericLiteral){
  const text=node.text;if(typeof text!=='string'||text.length>34)return;let n;
  if(/^0[xX][0-9a-f]+$/iu.test(text))n=BigInt(text);
  else if(/^0[0-7]+$/u.test(text))n=BigInt('0o'+text.slice(1));
  else if(/^(?:0|[1-9][0-9]*)$/u.test(text))n=BigInt(text);
  return n!==undefined&&bounded(n)?n:undefined;
 }
 if(node.kind===K.PrefixUnaryExpression){
  const a=evaluateClosedInt32(node.operand,depth+1);if(a===undefined)return;
  const op=node.operator?.kind,n=op===K.PlusToken?a:op===K.MinusToken?-a:op===K.TildeToken?~a:undefined;
  return n!==undefined&&bounded(n)?n:undefined;
 }
 if(node.kind!==K.BinaryExpression)return;
 const a=evaluateClosedInt32(node.left,depth+1),b=evaluateClosedInt32(node.right,depth+1);if(a===undefined||b===undefined)return;
 const op=node.operatorToken?.kind;let n;
 if(op===K.PlusToken)n=a+b;else if(op===K.MinusToken)n=a-b;else if(op===K.AsteriskToken)n=a*b;
 else if(op===K.AmpersandToken)n=a&b;else if(op===K.BarToken)n=a|b;else if(op===K.CaretToken)n=a^b;
 else if(op===K.LessThanLessThanToken&&b>=0n&&b<32n)n=a<<b;
 else if(op===K.GreaterThanGreaterThanToken&&a>=0n&&b>=0n&&b<32n)n=a>>b;
 return n!==undefined&&bounded(n)?n:undefined;
}

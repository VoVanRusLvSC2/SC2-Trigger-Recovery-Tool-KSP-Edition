// Totality only: never replace a Galaxy fixed value with a host float.
// Galaxy fixed has 12 fractional bits; a whole-unit envelope is deliberately
// much wider than its quantization error. The common +/-32766 bound lies inside
// both int32 and fixed ranges. Reference: https://sc2mapster.wiki.gg/wiki/Triggers/Types/Fixed
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const limit=32766n,abs=n=>n<0n?-n:n;
function envelope(token){
 if(typeof token!=='string'||token.length>128)return;
 let n,d=1n;
 if(/^[+-]?0[xX][0-9a-fA-F]+$/u.test(token)){const negative=token[0]==='-';n=BigInt(token.replace(/^[+-]/u,''));if(negative)n=-n;}
 else{
  const m=/^([+-]?)(\d+)(?:\.(\d*))?$/u.exec(token);if(!m)return;
  if(m[3]===undefined&&/^0[0-7]+$/u.test(m[2]))n=BigInt('0o'+m[2].slice(1));
  else{if(m[3]===undefined&&m[2].length>1&&m[2][0]==='0'&&/[89]/u.test(m[2]))return;d=10n**BigInt(m[3]?.length??0);n=BigInt(m[2])*d+BigInt(m[3]||'0');}
  if(m[1]==='-')n=-n;
 }
 const quotient=n/d,remainder=n%d;
 const lo=remainder===0n?quotient:quotient-(n<0n?1n:0n)-1n;
 const hi=remainder===0n?quotient:quotient+(n>0n?1n:0n)+1n;
 return lo>-limit&&hi<limit?{lo,hi}:undefined;
}
export function proveBoundedLiteralArithmetic(node,resolve){
 if(node.kind!==K.BinaryExpression)return;
 const left=resolve(node.left),right=resolve(node.right);if(!left||!right)return;
 const a=envelope(left.token),b=envelope(right.token);if(!a||!b)return;
 let lo,hi;const op=node.operatorToken.kind;
 if(op===K.PlusToken){lo=a.lo+b.lo-1n;hi=a.hi+b.hi+1n;}
 else if(op===K.MinusToken){lo=a.lo-b.hi-1n;hi=a.hi-b.lo+1n;}
 else if(op===K.AsteriskToken){const xs=[a.lo*b.lo,a.lo*b.hi,a.hi*b.lo,a.hi*b.hi];lo=xs.reduce((x,y)=>x<y?x:y)-1n;hi=xs.reduce((x,y)=>x>y?x:y)+1n;}
 else if(op===K.SlashToken&&(b.lo>=1n||b.hi<=-1n)){
  const numerator=abs(a.lo)>abs(a.hi)?abs(a.lo):abs(a.hi),denominator=abs(b.lo)<abs(b.hi)?abs(b.lo):abs(b.hi);
  const bound=(numerator+denominator-1n)/denominator+1n;lo=-bound;hi=bound;
 }else return;
 if(lo<=-limit||hi>=limit)return;
 return {kind:'BOUNDED_READONLY_LITERAL_ARITHMETIC_TOTALITY',operands:[left,right],operandIntervals:[a,b].map(v=>({min:v.lo.toString(),max:v.hi.toString()})),resultInterval:{min:lo.toString(),max:hi.toString()},numericValueFolded:false,integerBigIntBounds:true,fixedRoundingEnvelopeWholeUnits:1,rangeStrictlyInsideBothNumericCarriers:true,sourceOrCandidateChanged:false};
}

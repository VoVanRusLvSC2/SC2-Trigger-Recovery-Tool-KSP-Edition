// Per-conversion only. Fold closed int32 arithmetic without overflow assumptions.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const skip=new Set(['parent','symbol','locals','flowNode','syntaxTokens']);
const sha=s=>createHash('sha256').update(s).digest('hex');
const inRange=n=>n>=-2147483648n&&n<=2147483647n;
function children(n){return Object.entries(n).filter(([k,v])=>!skip.has(k)&&v&&typeof v==='object').flatMap(([,v])=>Array.isArray(v)?v:[v]).filter(v=>v&&typeof v==='object');}
function literal(n){
 if(n.kind!==K.NumericLiteral)return;
 const s=String(n.text??n.value);if(s.length>32||!/^(?:0[xX][0-9a-fA-F]+|0[0-7]*|[1-9][0-9]*)$/u.test(s))return;
 const value=BigInt(/^0[0-7]+$/u.test(s)?'0o'+s.slice(1):s);return inRange(value)?{value,operations:0}:undefined;
}
export function lowerClosedIntegerExpressions(source){
 const ast=new Parser().parseFile('integer-input.galaxy',source);assert.equal(ast.parseDiagnostics.length,0,'INVALID_SOURCE');
 const memo=new WeakMap(),seen=new WeakSet(),pending=[{n:ast,leave:false}];let visits=0;
 while(pending.length){
  const {n,leave}=pending.pop();if(!n||typeof n!=='object')continue;
  if(!leave){if(seen.has(n))continue;seen.add(n);assert(++visits<=5000000,'INTEGER_AST_BOUND');pending.push({n,leave:true});for(const c of children(n))pending.push({n:c,leave:false});continue;}
  let result=literal(n);
  if(n.kind===K.ParenthesizedExpression)result=memo.get(n.expression);
  if(n.kind===K.PrefixUnaryExpression){const a=memo.get(n.operand);if(a){let value;switch(n.operator.kind){case K.PlusToken:value=a.value;break;case K.MinusToken:value=-a.value;break;case K.TildeToken:value=~a.value;break;}if(value!==undefined&&inRange(value))result={value,operations:a.operations+1};}}
  if(n.kind===K.BinaryExpression){const a=memo.get(n.left),b=memo.get(n.right);if(a&&b){let value;switch(n.operatorToken.kind){case K.PlusToken:value=a.value+b.value;break;case K.MinusToken:value=a.value-b.value;break;case K.AsteriskToken:value=a.value*b.value;break;case K.CaretToken:value=a.value^b.value;break;case K.AmpersandToken:value=a.value&b.value;break;case K.BarToken:value=a.value|b.value;break;}if(value!==undefined&&inRange(value))result={value,operations:a.operations+b.operations+1};}}
  if(result)memo.set(n,result);
 }
 const edits=[],todo=[ast];
 while(todo.length){const n=todo.pop(),v=memo.get(n);if(v?.operations>0){assert(Number.isSafeInteger(n.pos)&&Number.isSafeInteger(n.end)&&n.pos>=0&&n.end<=source.length&&n.pos<n.end);const before=source.slice(n.pos,n.end),after='('+v.value.toString()+')';if(before!==after&&before!==v.value.toString())edits.push({start:n.pos,end:n.end,before,after,value:v.value.toString(),operations:v.operations});continue;}for(const c of children(n))todo.push(c);}
 edits.sort((a,b)=>a.start-b.start);for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start,'OVERLAPPING_INTEGER_EDITS');
 let text=source;for(const e of [...edits].reverse()){assert.equal(text.slice(e.start,e.end),e.before);text=text.slice(0,e.start)+e.after+text.slice(e.end);}
 const check=new Parser().parseFile('integer-output.galaxy',text);assert.equal(check.parseDiagnostics.length,0,'INVALID_LOWERED_SOURCE');
 return{text,proof:{kind:'CLOSED_INTEGER_EXPRESSIONS_INT32_NO_OVERFLOW',beforeSha256:sha(source),afterSha256:sha(text),changed:edits.length>0,edits,operators:['+','-','*','^','&','|','unary +','unary -','~'],everyIntermediateInSignedInt32:true,noIdentifiersCallsDivisionRemaindersOrShifts:true,tokenBoundariesPreservedByParentheses:true,persistentCache:false,originalArchiveChanged:false}};
}

// Generalize the scalar rule to structurally proved int expressions. The
// operand remains intact and is evaluated once. The only new arithmetic is
// -1 - operand, which is representable for every signed int32 operand result.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const skip=new Set(['parent','syntaxTokens','symbol','locals','flowNode']);
const children=n=>Object.entries(n).filter(([k,v])=>!skip.has(k)&&v&&typeof v==='object').flatMap(([,v])=>Array.isArray(v)?v:[v]).filter(v=>v&&typeof v==='object');
function walk(n,fn,owner){if(!n||typeof n!=='object')return;if(n.kind===K.FunctionDeclaration)owner=n;fn(n,owner);for(const c of children(n))walk(c,fn,owner);}
function add(map,n){if(n.name?.name){const xs=map.get(n.name.name)??[];xs.push(n);map.set(n.name.name,xs);}}
const integerOperators=new Set([K.PlusToken,K.MinusToken,K.AsteriskToken,K.SlashToken,K.PercentToken,K.LessThanLessThanToken,K.GreaterThanGreaterThanToken,K.AmpersandToken,K.BarToken,K.CaretToken]);
assert([...integerOperators].every(Number.isInteger),'UNKNOWN_INTEGER_OPERATOR_KIND');
const sha=s=>createHash('sha256').update(s).digest('hex');
export function lowerExpressionIntegerComplements(source,document){
 const ast=(document?document.input(source):new Parser().parseFile('complement-input.galaxy',source));assert.equal(ast.parseDiagnostics.length,0,'INVALID_SOURCE');
 const roots=new Map(),locals=new Map();
 for(const n of ast.statements)if(n.kind===K.VariableDeclaration)add(roots,n);
 for(const f of ast.statements.filter(n=>n.kind===K.FunctionDeclaration)){
  const bindings=new Map();for(const p of f.parameters??[])add(bindings,p);
  if(f.body)walk(f.body,n=>{if(n.kind===K.VariableDeclaration)add(bindings,n);});locals.set(f,bindings);
 }
 function binding(identifier,at,fn){
  const own=fn&&locals.get(fn)?.get(identifier.name),matches=own??roots.get(identifier.name);
  if(matches?.length!==1)return;
  const b=matches[0];if(b.type?.kind!==K.IntKeyword)return;
  if(fn&&(!fn.body||at.pos<fn.body.pos))return;
  if(own&&b.kind===K.VariableDeclaration&&(!fn.body.statements.includes(b)||b.pos>=at.pos))return;
  if(!own&&b.pos>=at.pos)return;
  return{name:identifier.name,binding:own?(b.kind===K.ParameterDeclaration?'parameter':'entry-local'):'root-global',declarationPosition:b.pos};
 }
 function proveInt(n,at,fn,depth=0){
  if(!n||depth>64)return;
  if(n.kind===K.ParenthesizedExpression)return proveInt(n.expression,at,fn,depth+1);
  if(n.kind===K.Identifier){const b=binding(n,at,fn);return b&&{kind:'bound-int',...b};}
  if(n.kind===K.NumericLiteral){
   const text=String(n.text??n.value);if(text.length>32||!/^(?:0[xX][0-9a-fA-F]+|0[0-7]*|[1-9][0-9]*)$/u.test(text))return;
   const value=BigInt(/^0[0-7]+$/u.test(text)?'0o'+text.slice(1):text);if(value>2147483647n)return;
   return{kind:'int-literal',value:value.toString()};
  }
  if(n.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken,K.TildeToken].includes(n.operator.kind)){
   const operand=proveInt(n.operand,at,fn,depth+1);return operand&&{kind:'int-unary',operator:K[n.operator.kind],operand};
  }
  if(n.kind===K.BinaryExpression&&integerOperators.has(n.operatorToken.kind)){
   const left=proveInt(n.left,at,fn,depth+1),right=proveInt(n.right,at,fn,depth+1);return left&&right&&{kind:'int-binary',operator:K[n.operatorToken.kind],left,right};
  }
 }
 const candidates=new WeakMap();
 walk(ast,(n,fn)=>{
  if(n.kind!==K.PrefixUnaryExpression||n.operator.kind!==K.TildeToken)return;
  const typeProof=proveInt(n.operand,n,fn);if(!typeProof)return;
  // This parser includes trailing line comments in a token's end span.
  // Verify the operator byte and preserve the entire following trivia span.
  assert(n.operator.pos>=n.pos&&n.operator.pos<n.operand.pos&&source[n.operator.pos]==='~','INVALID_COMPLEMENT_OPERATOR_RANGE');
  candidates.set(n,{typeProof,function:fn?.name.name??null});
 });
 const edits=[];
 function render(n){
  const proof=candidates.get(n);
  if(proof){
   // Preserve trivia between the operator and its operand as well as all
   // internal evaluation order. Nested complements are lowered inside-out.
   const trivia=source.slice(n.pos,n.operator.pos)+source.slice(n.operator.pos+1,n.operand.pos);
   return{value:'(-1 - ('+trivia+render(n.operand).value+'))',complements:1+count(n.operand)};
  }
  let value=source.slice(n.pos,n.end);const nested=[];
  function collect(child){if(candidates.has(child)){nested.push(child);return;}for(const c of children(child))collect(c);}
  for(const c of children(n))collect(c);
  nested.sort((a,b)=>b.pos-a.pos);
  for(const c of nested){const replacement=render(c).value;value=value.slice(0,c.pos-n.pos)+replacement+value.slice(c.end-n.pos);}
  return{value,complements:nested.reduce((total,c)=>total+1+count(c.operand),0)};
 }
 function count(n){let total=0;walk(n,c=>{if(candidates.has(c))total++;});return total;}
 function select(n){
  if(candidates.has(n)){
   const rendered=render(n);edits.push({start:n.pos,end:n.end,before:source.slice(n.pos,n.end),replacement:rendered.value,complements:rendered.complements,...candidates.get(n),operandEvaluations:1,sideEffectsAdded:false,extraArithmeticAlwaysInSignedInt32:true});return;
  }
  for(const c of children(n))select(c);
 }
 select(ast);edits.sort((a,b)=>a.start-b.start);for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start,'OVERLAPPING_COMPLEMENT_EDITS');
 let text=source;for(const e of [...edits].reverse()){assert.equal(text.slice(e.start,e.end),e.before);text=text.slice(0,e.start)+e.replacement+text.slice(e.end);}
 assert.equal((document?document.output(text):new Parser().parseFile('complement-output.galaxy',text)).parseDiagnostics.length,0,'INVALID_LOWERED_SOURCE');
 return{text,proof:{kind:'STRUCTURALLY_TYPED_SIGNED_INT32_COMPLEMENT',sourceSha256:sha(source),outputSha256:sha(text),changed:edits.length>0,edits,complementsLowered:edits.reduce((n,e)=>n+e.complements,0),identity:'~x = -1 - x',operandEvaluations:1,extraArithmeticDomain:{minimum:-2147483648,maximum:2147483647},operandOperationsRetained:true,originalOperandOverflowOrErrorsNotWaived:true,callsArraysUnknownBindingsAndFixedRejected:true,originalArchiveChanged:false,persistentCache:false}};
}

// A literal used as an If predicate needs a GUI Condition, not a new function
// named "True Keyword". Express it using the existing boolean comparison.
// Only If predicate boolean topology is visited; values, call arguments and
// loop/compiler patterns are retained. Neither branch order nor calls change.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from "./index-alternate-3.js";
const skip=new Set(['parent','syntaxTokens','symbol','locals','flowNode']);
const sha=s=>createHash('sha256').update(s).digest('hex');
export function lowerLiteralBooleanIfPredicates(source,document){
 const ast=(document?document.input(source):new Parser().parseFile('boolean-if-input.galaxy',source));assert.equal(ast.parseDiagnostics.length,0,'INVALID_SOURCE');
 const edits=[];
 function predicate(n){
  if(!n)return;
  if(n.kind===K.ParenthesizedExpression){predicate(n.expression);return;}
  if(n.kind===K.PrefixUnaryExpression&&n.operator.kind===K.ExclamationToken){predicate(n.operand);return;}
  if(n.kind===K.BinaryExpression&&[K.AmpersandAmpersandToken,K.BarBarToken].includes(n.operatorToken.kind)){predicate(n.left);predicate(n.right);return;}
  if(![K.TrueKeyword,K.FalseKeyword].includes(n.kind))return;
  const value=n.kind===K.TrueKeyword?'true':'false';assert.equal(source.slice(n.pos,n.pos+value.length),value,'BOOLEAN_LITERAL_TOKEN_CHANGED');
  edits.push({start:n.pos,end:n.pos+value.length,before:value,replacement:'('+value+' == true)',originalValue:value==='true',comparisonValue:value==='true',newCalls:0,operandEvaluationsUnchanged:true,branchesAndShortCircuitOrderPreserved:true});
 }
 function walk(n){
  if(!n||typeof n!=='object')return;if(Array.isArray(n)){for(const x of n)walk(x);return;}
  if(n.kind===K.IfStatement)predicate(n.expression);
  for(const[k,v]of Object.entries(n))if(!skip.has(k))walk(v);
 }
 walk(ast);edits.sort((a,b)=>a.start-b.start);for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start,'OVERLAPPING_BOOLEAN_PREDICATES');
 let text=source;for(const e of [...edits].reverse()){assert.equal(text.slice(e.start,e.end),e.before);text=text.slice(0,e.start)+e.replacement+text.slice(e.end);}
 assert.equal((document?document.output(text):new Parser().parseFile('boolean-if-output.galaxy',text)).parseDiagnostics.length,0,'INVALID_LOWERED_SOURCE');
 return{text,proof:{kind:'LITERAL_IF_PREDICATE_AS_EXISTING_GUI_BOOLEAN_COMPARISON',sourceSha256:sha(source),outputSha256:sha(text),changed:edits.length>0,edits,callArgumentsReturnValuesDeclarationsAndLoopsUntouched:true,sourceOrArchivesChanged:false,persistentCache:false}};
}

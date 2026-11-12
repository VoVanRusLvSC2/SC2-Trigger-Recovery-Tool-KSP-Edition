// Galaxy permits an int in a predicate. Express its existing nonzero test with
// the standard GUI comparison, evaluating the original expression exactly once.
// Scope/type evidence comes from actual source declarations. Unknown types,
// conflicting signatures and unsupported local scopes are left unchanged.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from "./index-alternate-3.js";
const sha=s=>createHash('sha256').update(s).digest('hex'),skip=new Set(['parent','pos','end','line','char','symbol','locals','flowNode','syntaxTokens']);
const arithmetic=new Set([K.PlusToken,K.MinusToken,K.AsteriskToken,K.SlashToken,K.PercentToken,K.AmpersandToken,K.BarToken,K.CaretToken,K.LessThanLessThanToken,K.GreaterThanGreaterThanToken].filter(Number.isInteger));
const comparison=new Set([K.EqualsEqualsToken,K.ExclamationEqualsToken,K.LessThanToken,K.LessThanEqualsToken,K.GreaterThanToken,K.GreaterThanEqualsToken].filter(Number.isInteger));
const logical=new Set([K.BarBarToken,K.AmpersandAmpersandToken]);
const integerToken=n=>n?.kind===K.NumericLiteral&&/^(?:0[xX][0-9a-fA-F]+|[0-9]+)$/u.test(n.text??'')&&/^\d+$/u.test(String(n.value));
function children(n,visit,path=[]){
 if(!n||typeof n!=='object')return;
 if(Array.isArray(n)){for(let i=0;i<n.length;i++)children(n[i],visit,[...path,i]);return;}
 if(typeof n.kind!=='number')return;visit(n,path);
 for(const[k,v]of Object.entries(n))if(!skip.has(k))children(v,visit,[...path,k]);
}
function shape(n){if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.map(shape);return Object.fromEntries(Object.entries(n).filter(([k])=>!skip.has(k)).map(([k,v])=>[k,shape(v)]));}
function parse(text,label){const ast=new Parser().parseFile(label,text);assert.equal(ast.parseDiagnostics.length,0,'INTEGER_PREDICATE_INVALID_SOURCE:'+label);return ast;}
function type(n){if(n?.kind===K.IntKeyword)return'int';if(n?.kind===K.BoolKeyword)return'bool';if(n?.kind===K.ArrayType)return{array:type(n.elementType)};return'unknown';}
function add(map,name,value){if(!map.has(name))map.set(name,[]);map.get(name).push(value);}
// Include no trailing comment in the inserted comparison. Token end positions
// can include // trivia; inserting after that text would hide the new suffix.
function significantEnd(text,start,end){let last=start;
 for(let i=start;i<end;){
  if(/\s/u.test(text[i])){i++;continue;}
  if(text[i]==='/'&&text[i+1]==='/'){const nl=text.indexOf('\n',i+2);i=nl<0?end:Math.min(nl,end);continue;}
  if(text[i]==='"'){i++;let closed=false;while(i<end){if(text[i]==='\\'){i+=2;continue;}if(text[i++]==='"'){closed=true;break;}}assert(closed,'INTEGER_PREDICATE_UNCLOSED_LITERAL');last=i;continue;}
  last=++i;
 }
 return last;
}
export function lowerTypedIntegerPredicates(source,declarations=[],document){
 assert(Array.isArray(declarations),'INTEGER_PREDICATE_DECLARATIONS_REQUIRED');
 const ast=(document?document.input(source):parse(source,'owned')),globals=new Map(),functions=new Map(),externalInputs=[];
 function index(a,sourceIndex){for(const n of a.statements){
  if(n.kind===K.VariableDeclaration)add(globals,n.name.name,{type:type(n.type),sourceIndex,position:n.pos});
  if(n.kind===K.FunctionDeclaration)add(functions,n.name.name,{type:type(n.type),arity:n.parameters.length,sourceIndex,position:n.pos});
 }}
 index(ast,-1);
 for(const[i,input]of declarations.entries()){
  const text=typeof input==='string'?input:input.text;assert.equal(typeof text,'string','INTEGER_PREDICATE_DECLARATION_TEXT');
  externalInputs.push({fileName:typeof input==='string'?String(i):input.fileName,sha256:sha(text),bytes:Buffer.byteLength(text)});
  // Index only small immutable type facts. Do not retain foreign ASTs through
  // parent pointers or cache parsed sources between calls.
  index(parse(text,'external-'+i),i);
 }
 const records=[],edits=[],unsupportedScopes=[];
 for(const[functionIndex,fn]of ast.statements.entries()){
  if(fn.kind!==K.FunctionDeclaration||!fn.body)continue;
  const scope=new Map(),entry=fn.body.statements.filter(n=>n.kind===K.VariableDeclaration);let localCount=0,nestedFunction=false,duplicate=false;
  children(fn.body,n=>{if(n.kind===K.VariableDeclaration)localCount++;if(n.kind===K.FunctionDeclaration)nestedFunction=true;});
  for(const n of[...fn.parameters,...entry]){if(scope.has(n.name.name))duplicate=true;scope.set(n.name.name,{type:type(n.type),position:n.pos,sourceIndex:-1});}
  if(localCount!==entry.length||nestedFunction||duplicate){unsupportedScopes.push(fn.name.name);continue;}
  function variable(name){
   if(scope.has(name))return scope.get(name);
   const candidates=globals.get(name);if(!candidates?.length)return undefined;
   const types=new Set(candidates.map(c=>JSON.stringify(c.type)));return types.size===1?{type:candidates[0].type,bindings:candidates}:undefined;
  }
  function infer(n){
   if(!n)return undefined;
   if(n.kind===K.ParenthesizedExpression)return infer(n.expression);
   if(n.kind===K.TrueKeyword||n.kind===K.FalseKeyword)return{type:'bool',kind:'boolean-literal'};
   if(integerToken(n)&&BigInt(n.value)<=2147483647n)return{type:'int',kind:'int32-literal'};
   if(n.kind===K.Identifier){const v=variable(n.name);return v?{type:v.type,kind:'declared-variable',name:n.name,bindings:v.bindings??[v]}:undefined;}
   if(n.kind===K.ElementAccessExpression){const v=infer(n.expression);return v?.type&&typeof v.type==='object'&&'array'in v.type?{type:v.type.array,kind:'declared-array-element',base:v}:undefined;}
   if(n.kind===K.CallExpression&&n.expression?.kind===K.Identifier){
    const name=n.expression.name;if(scope.has(name)||globals.has(name))return undefined;
    const candidates=functions.get(name);if(!candidates?.length||!candidates.every(c=>c.arity===n.arguments.length))return undefined;
    const types=new Set(candidates.map(c=>JSON.stringify(c.type)));return types.size===1?{type:candidates[0].type,kind:'declared-return',name,arity:n.arguments.length,bindings:candidates}:undefined;
   }
   if(n.kind===K.PrefixUnaryExpression){
    if(n.operator.kind===K.ExclamationToken)return{type:'bool',kind:'logical-not'};
    if(n.operator.kind===K.MinusToken&&integerToken(n.operand)&&String(n.operand.value)==='2147483648')return{type:'int',kind:'int32-min-literal'};
    const operand=infer(n.operand);if(operand?.type==='int'&&[K.PlusToken,K.MinusToken,K.TildeToken].includes(n.operator.kind))return{type:'int',kind:'integer-unary',operand};
    return undefined;
   }
   if(n.kind===K.BinaryExpression){
    const op=n.operatorToken.kind;if(comparison.has(op)||logical.has(op))return{type:'bool',kind:'boolean-operator'};
    if(arithmetic.has(op)){const left=infer(n.left),right=infer(n.right);if(left?.type==='int'&&right?.type==='int')return{type:'int',kind:'integer-operator',operator:op,left,right};}
   }
   return undefined;
  }
  function predicate(n,nodePath){
   if(!n)return;
   if(n.kind===K.ParenthesizedExpression){predicate(n.expression,[...nodePath,'expression']);return;}
   if(n.kind===K.PrefixUnaryExpression&&n.operator.kind===K.ExclamationToken){predicate(n.operand,[...nodePath,'operand']);return;}
   if(n.kind===K.BinaryExpression&&logical.has(n.operatorToken.kind)){predicate(n.left,[...nodePath,'left']);predicate(n.right,[...nodePath,'right']);return;}
   const inferred=infer(n);if(inferred?.type!=='int')return;
   const end=significantEnd(source,n.pos,n.end);assert(end>n.pos,'INTEGER_PREDICATE_EMPTY_EXPRESSION');
   edits.push({start:n.pos,end,replacement:'(('+source.slice(n.pos,end)+') != 0)'});
   records.push({function:fn.name.name,nodePath,expressionSha256:sha(source.slice(n.pos,end)),sourcePosition:n.pos,sourceEnd:end,typeProof:inferred,originalAst:shape(n),originalExpressionEvaluations:1,transformedExpressionEvaluations:1,extraNativeCalls:0,shortCircuitAndBranchOrderPreserved:true,headerInitializersChanged:false});
  }
  children(fn.body,(n,relative)=>{
   const nodePath=['statements',functionIndex,'body',...relative];
   if([K.IfStatement,K.WhileStatement,K.DoStatement].includes(n.kind))predicate(n.expression,[...nodePath,'expression']);
   if(n.kind===K.ForStatement&&n.condition)predicate(n.condition,[...nodePath,'condition']);
  });
 }
 edits.sort((a,b)=>a.start-b.start);for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start,'INTEGER_PREDICATE_OVERLAPPING_EDITS');
 let text=source;for(const e of[...edits].reverse())text=text.slice(0,e.start)+e.replacement+text.slice(e.end);
 const result=(document?document.output(text):parse(text,'coerced')),restored=shape(result.statements);
 for(const r of records){
  const p=r.nodePath.slice(1);let parent=restored;for(const key of p.slice(0,-1))parent=parent[key];const key=p.at(-1),wrapper=parent[key];
  assert.equal(wrapper.kind,K.ParenthesizedExpression);const compare=wrapper.expression;assert.equal(compare.kind,K.BinaryExpression);assert.equal(compare.operatorToken.kind,K.ExclamationEqualsToken);assert.equal(compare.right.kind,K.NumericLiteral);assert.equal(String(compare.right.value),'0');assert.equal(compare.left.kind,K.ParenthesizedExpression);assert.deepEqual(compare.left.expression,r.originalAst,'INTEGER_PREDICATE_OPERAND_CHANGED');parent[key]=compare.left.expression;
 }
 assert.deepEqual(restored,shape(ast.statements),'INTEGER_PREDICATE_CHANGED_OTHER_AST');
 return{text,proof:{kind:'DECLARED_INT_NONZERO_PREDICATES',sourceSha256:sha(source),outputSha256:sha(text),changed:records.length>0,records:records.map(({originalAst,...r})=>r),unsupportedScopes,externalInputs,allOriginalAstRetainedAfterRemovingOnlyProvedComparisons:true,originalFilesChanged:false,persistentCache:false,wholeMapAccepted:false}};
}

// Only literal scalar stores move. Other declarations retain their relative
// order; calls, computed initializers and type effects form hard barriers.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {assertExactAstShape} from './exact-ast-shape.mjs';
import {isIntrinsicScalarType} from '../model/passive-function-entry-storage.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const ignored=new Set(['parent','pos','end','line','char','syntaxTokens','symbol','locals','flowNode','id','comments','__sourceText','hasReturn']);
const assignments=new Set(['EqualsToken','PlusEqualsToken','MinusEqualsToken','AsteriskEqualsToken','SlashEqualsToken','PercentEqualsToken','LessThanLessThanEqualsToken','GreaterThanGreaterThanEqualsToken','AmpersandEqualsToken','BarEqualsToken','CaretEqualsToken'].map(k=>K[k]));
function literal(n){while(n?.kind===K.ParenthesizedExpression)n=n.expression;if(!n)return false;
 if([K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(n.kind))return true;
 let operand=n.operand;while(operand?.kind===K.ParenthesizedExpression)operand=operand.expression;
 return n.kind===K.PrefixUnaryExpression&&[K.MinusToken,K.PlusToken].includes(n.operator?.kind)&&operand?.kind===K.NumericLiteral;
}
function inspect(nodes){const names=new Set(),seen=new WeakSet();let effect=false;const pending=nodes.filter(Boolean);
 while(pending.length){const n=pending.pop();if(seen.has(n))continue;seen.add(n);if(n.kind===K.Identifier)names.add(n.name);
  if(n.kind===K.CallExpression||n.initializer||n.kind===K.BinaryExpression&&assignments.has(n.operatorToken?.kind)||
   [K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(n.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(n.operator?.kind??n.operator))effect=true;
  if(n.kind===K.ArrayType&&n.size)pending.push(n.size);
  forEachChild(n,c=>pending.push(c));
 }return {names,effect};
}
export function canonicalIndependentLiteralGlobalAnchors(text){
 assert(typeof text==='string'&&Buffer.byteLength(text)<=64*1024**2,'LITERAL_GLOBAL_INPUT_BOUND');
 const ast=parse(text,'literal-global-anchors');assert.equal(ast.parseDiagnostics.length,0);
 const globals=ast.statements.filter(n=>n.kind===K.VariableDeclaration),globalNames=new Set(globals.map(n=>n.name.name));
 assert.equal(globalNames.size,globals.length,'LITERAL_GLOBAL_IDENTITIES_UNIQUE');
 assert(!ast.statements.some(n=>n.kind!==K.VariableDeclaration&&n.name&&globalNames.has(n.name.name)),'LITERAL_GLOBAL_NAMESPACE_COLLISION');
 const records=[],edits=[];let region=[];
 function flush(){
  const movable=region.filter(({node})=>node.kind===K.VariableDeclaration&&!node.modifiers?.length&&!node.isReference&&isIntrinsicScalarType(node.type)&&literal(node.initializer)&&
   !region.some(other=>other.node!==node&&other.header.names.has(node.name.name)));
  const moving=new Set(movable),ordered=[...movable].sort((a,b)=>a.node.name.name.localeCompare(b.node.name.name)).concat(region.filter(r=>!moving.has(r)));
  if(ordered.some((r,i)=>r!==region[i])){
   const permutation=ordered.map(r=>r.index);
   region.forEach((r,i)=>edits.push({start:r.node.pos,end:r.node.end,before:text.slice(r.node.pos,r.node.end),value:text.slice(ordered[i].node.pos,ordered[i].node.end)}));
   records.push({positions:region.map(r=>r.index),permutation,moved:movable.map(r=>r.node.name.name),noHeaderReadsOfMovedStores:true,otherDeclarationOrderRetained:true});
  }region=[];
 }
 for(const [index,node]of ast.statements.entries()){
  let header;
  if(node.kind===K.VariableDeclaration){header=inspect([node.type]);if(node.initializer&&!literal(node.initializer)&&node.initializer.kind!==K.NullKeyword)header.effect=true;}
  else if(node.kind===K.FunctionDeclaration){header=inspect([node.type,...node.parameters.map(p=>p.type)]);if(node.parameters.some(p=>p.initializer))header.effect=true;}
  else if([K.StructDeclaration,K.TypedefDeclaration,K.EmptyStatement].includes(node.kind))header=inspect([node]);
  else {flush();continue;}
  if(header.effect){flush();continue;}
  region.push({node,index,header});
 }flush();
 let result=text;for(const edit of [...edits].sort((a,b)=>b.start-a.start)){assert.equal(result.slice(edit.start,edit.end),edit.before);result=result.slice(0,edit.start)+edit.value+result.slice(edit.end);}
 const after=parse(result,'literal-global-anchors-result');assert.equal(after.parseDiagnostics.length,0);const inverse=[...after.statements];
 for(const r of records)r.positions.forEach((newPosition,i)=>{inverse[r.permutation[i]]=after.statements[newPosition];});
 assertExactAstShape(inverse,ast.statements,{ignoredFields:ignored,label:'LITERAL_GLOBAL_OTHER_AST_CHANGED'});
 return {text:result,proof:{kind:'INDEPENDENT_MUTABLE_LITERAL_GLOBAL_ANCHORS',sourceSha256:sha(text),viewSha256:sha(result),records,edits,
  newWrites:0,computedInitializersAndIncludesAreBarriers:true,typesReadingMovedNamesExcluded:true,sourceOrExportChanged:false,
  boundary:'Galaxy declarations have no user aggregate constructors; runtime code, all stores and values remain intact. Debugger order and allocation budgets are not engine acceptance.',wholeProgramOracleRequired:true,wholeMapAccepted:false}};
}

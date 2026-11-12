import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const hash=text=>createHash('sha256').update(text).digest('hex');
const skipped=new Set(['parent','symbol','locals','flowNode','syntaxTokens']);

// This evaluator accepts only finite, closed boolean syntax. It never infers a
// value for a name, call, numeric comparison or expression with side effects.
function truth(node){
 if(!node)return undefined;
 if(node.kind===K.ParenthesizedExpression)return truth(node.expression);
 if(node.kind===K.TrueKeyword)return true;
 if(node.kind===K.FalseKeyword)return false;
 if(node.kind===K.PrefixUnaryExpression&&node.operator?.kind===K.ExclamationToken){const value=truth(node.operand);return value===undefined?undefined:!value;}
 if(node.kind!==K.BinaryExpression)return undefined;
 const left=truth(node.left),right=truth(node.right);
 if(left===undefined||right===undefined)return undefined;
 switch(node.operatorToken?.kind){
  case K.EqualsEqualsToken:return left===right;
  case K.ExclamationEqualsToken:return left!==right;
  case K.AmpersandAmpersandToken:return left&&right;
  case K.BarBarToken:return left||right;
 }
}

/** Auxiliary proof input only. The caller must retain the original raw oracle
 * result and compare the complete programs again after these witnessed edits. */
export function canonicalLiteralBooleanConditions(source){
 const ast=parseImmutableGalaxySyntax(source,'boolean-condition-proof.galaxy');
 assert.equal(ast.parseDiagnostics.length,0,'BOOLEAN_PROOF_INVALID_SOURCE');
 const edits=[];
 function condition(node){
  const value=truth(node);
  if(value!==undefined){
   const replacement=value?'true':'false',before=source.slice(node.pos,node.end);
   if(before!==replacement)edits.push({start:node.pos,end:node.end,before,replacement,value});
   return;
  }
  if(node?.kind===K.ParenthesizedExpression)condition(node.expression);
  else if(node?.kind===K.PrefixUnaryExpression&&node.operator?.kind===K.ExclamationToken)condition(node.operand);
  else if(node?.kind===K.BinaryExpression&&[K.AmpersandAmpersandToken,K.BarBarToken].includes(node.operatorToken?.kind)){condition(node.left);condition(node.right);}
 }
 const pending=[ast];
 while(pending.length){
  const node=pending.pop();
  if(node.kind===K.IfStatement)condition(node.expression);
  for(const[key,value]of Object.entries(node)){
   if(skipped.has(key)||!value||typeof value!=='object')continue;
   for(const child of Array.isArray(value)?value:[value])if(child&&typeof child==='object')pending.push(child);
  }
 }
 edits.sort((a,b)=>a.start-b.start);
 for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start,'BOOLEAN_PROOF_OVERLAPPING_EDITS');
 let text=source;
 for(const edit of [...edits].reverse()){
  assert.equal(text.slice(edit.start,edit.end),edit.before);
  text=text.slice(0,edit.start)+edit.replacement+text.slice(edit.end);
 }
 assert.equal(parseImmutableGalaxySyntax(text,'boolean-condition-proof-output.galaxy').parseDiagnostics.length,0);
 return {text,proof:{kind:'PURE_CLOSED_BOOLEAN_IF_PREDICATE',sourceSha256:hash(source),proofInputSha256:hash(text),edits,
  namesCallsNumbersAndSideEffectsNeverEvaluated:true,branchesAndShortCircuitTopologyUnchanged:true,
  sourceChangedOnDisk:false,rawOracleReplaced:false,acceptanceOverride:false}};
}

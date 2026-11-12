import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGalaxyDocument} from '../model/galaxy-document.collections.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=text=>createHash('sha256').update(text).digest('hex');

// A narrow language identity: concatenating two string LITERALS when one is
// the exact empty token. Never folds a call, variable, null, numeric addition,
// or a string that a permissive decoder merely interprets as empty.
// Only comparison views change. Keep the retained literal's original token.
export function normalizeEmptyStringLiteralConcatenation(text) {
 const document=createGalaxyDocument({fileName:'empty-string-literal-concat.galaxy',text});
 try {
  const edits=[];
  const visit=node=>{
   if(node.kind===K.BinaryExpression&&node.operatorToken.kind===K.PlusToken&&
      node.left.kind===K.StringLiteral&&node.right.kind===K.StringLiteral) {
    const kept=node.left.text==='""'?node.right:node.right.text==='""'?node.left:undefined;
    if(kept) {
     for(const literal of [node.left,node.right])assert.equal(text.slice(literal.pos,literal.pos+literal.text.length),literal.text,'CONCAT_LITERAL_TOKEN_CHANGED');
     let start=node.pos,end=node.right.pos+node.right.text.length,current=node;
     while(current.parent?.kind===K.ParenthesizedExpression&&current.parent.expression===current) {
      current=current.parent;const close=current.syntaxTokens?.findLast(t=>t.kind===K.CloseParenToken);
      assert(close&&text[close.pos]===')'&&text[current.pos]==='(','CONCAT_PAREN_BOUNDARY');
      start=current.pos;end=close.pos+1;
     }
     edits.push({start,end,text:kept.text,originalSha256:sha(text.slice(start,end)),literalSha256:sha(kept.text)});
     return;
    }
   }
   forEachChild(node,visit);
  };
  visit(document.ast);
  edits.sort((a,b)=>a.start-b.start);
  for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start,'OVERLAPPING_CONCAT_PROOFS');
  let output=text;for(const e of [...edits].reverse())output=output.slice(0,e.start)+e.text+output.slice(e.end);
  if(output!==text)document.run('exact-empty-literal-concat',()=>({text:output}));
  return {text:output,proof:{kind:'EXACT_EMPTY_STRING_LITERAL_CONCATENATION',records:edits.map(({text,...r})=>({...r,retainedLiteralToken:text,literalBytesPreserved:true,operandsAreNonNullStringLiterals:true,otherEvaluationRemoved:false})),inputSha256:sha(text),outputSha256:sha(output),sharedAst:document.evidence(),comparisonRepresentationOnly:true,sourceOrCandidateChanged:false,originalOracleChanged:false}};
 } finally {document.dispose();}
}

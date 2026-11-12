import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

// Exactly the existing ordered rules: direct literal concat first, then string
// literal parentheses. A concat exposed by parentheses waits for another pass.
// One input parse; unchanged output needs no redundant parse or second hash.
export function normalizeEmptyStringLiteralConcatenation(text,{parseGalaxy=parseImmutableGalaxySyntax}={}) {
  const ast=parseGalaxy(text,'literal-string-identity.galaxy');
  assert.equal(ast.parseDiagnostics.length,0,'LITERAL_STRING_IDENTITY_SYNTAX');
  const edits=[];let concatSteps=0,parenthesisSteps=0;
  const token=node=>text.slice(node.pos,node.end);
  function visit(node) {
    if(node.kind===K.StringLiteral)return node;
    const mark=edits.length;let expression;
    forEachChild(node,child=>{const projected=visit(child);if(child===node.expression)expression=projected;});
    let retained;
    if(node.kind===K.BinaryExpression&&node.operatorToken.kind===K.PlusToken&&
      node.left.kind===K.StringLiteral&&node.right.kind===K.StringLiteral) {
      retained=token(node.left)==='""'?node.right:token(node.right)==='""'?node.left:undefined;
      if(retained)concatSteps++;
    } else if(node.kind===K.ParenthesizedExpression&&expression) {
      retained=expression;parenthesisSteps++;
    }
    if(retained) {
      // The outer literal projection includes the already proved child edits.
      edits.length=mark;
      edits.push({start:node.pos,end:node.end,text:token(retained)});
    }
    return retained;
  }
  visit(ast);
  const beforeSha256=createHash('sha256').update(text).digest('hex');
  let output=text;
  if(edits.length) {
    output='';let cursor=0;
    for(const edit of edits.toSorted((a,b)=>a.start-b.start)) {
      assert(edit.start>=cursor,'LITERAL_STRING_IDENTITY_OVERLAP');
      output+=text.slice(cursor,edit.start)+edit.text;cursor=edit.end;
    }
    output+=text.slice(cursor);
    assert.equal(parseGalaxy(output,'literal-string-identity-result.galaxy').parseDiagnostics.length,0,'LITERAL_STRING_IDENTITY_OUTPUT');
  }
  return {text:output,proof:{kind:'ORDERED_EXACT_STRING_LITERAL_IDENTITIES',beforeSha256,
    afterSha256:output===text?beforeSha256:createHash('sha256').update(output).digest('hex'),
    records:edits.map(({start,end})=>({start,end,retainedTokenBytesExact:true})),concatSteps,parenthesisSteps,
    runtimeStatementsRemoved:0,sourceOrCandidateChanged:false,wholeProgramEquivalent:false,persistentCache:false}};
}

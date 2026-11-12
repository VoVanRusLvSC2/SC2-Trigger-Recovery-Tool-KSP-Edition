import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

// Comparison view only: removing an empty literal from two literal operands
// preserves the other operand's exact token. Variables, null, calls and text
// expressions never qualify. No decoder or replacement string encoder needed.
export function normalizeEmptyStringLiteralConcatenation(text,{parseGalaxy=parseImmutableGalaxySyntax}={}) {
  const ast=parseGalaxy(text,'empty-string-literal-comparison.galaxy');
  assert.equal(ast.parseDiagnostics.length,0,'EMPTY_STRING_LITERAL_SYNTAX');
  const edits=[];
  function visit(node) {
    if(node.kind===K.BinaryExpression&&node.operatorToken.kind===K.PlusToken&&
      node.left.kind===K.StringLiteral&&node.right.kind===K.StringLiteral) {
      // Inspect original token spelling, rather than relying on a host decoder.
      const left=text.slice(node.left.pos,node.left.end),right=text.slice(node.right.pos,node.right.end);
      const retained=left==='""'?node.right:right==='""'?node.left:undefined;
      if(retained) {
        edits.push({start:node.pos,end:node.end,text:text.slice(retained.pos,retained.end)});
        return;
      }
    }
    forEachChild(node,visit);
  }
  visit(ast);
  let output='',cursor=0;
  for(const edit of edits.toSorted((a,b)=>a.start-b.start)) {
    assert(edit.start>=cursor,'EMPTY_STRING_LITERAL_OVERLAP');
    output+=text.slice(cursor,edit.start)+edit.text;cursor=edit.end;
  }
  output+=text.slice(cursor);
  assert.equal(parseGalaxy(output,'empty-string-literal-result.galaxy').parseDiagnostics.length,0,'EMPTY_STRING_LITERAL_OUTPUT');
  const sha=s=>createHash('sha256').update(s).digest('hex');
  return {text:output,proof:{kind:'EXACT_EMPTY_STRING_LITERAL_CONCATENATION',beforeSha256:sha(text),afterSha256:sha(output),
    records:edits.map(({start,end})=>({start,end,operandsBothLiteral:true,retainedTokenBytesExact:true})),
    runtimeStatementsRemoved:0,sourceOrCandidateChanged:false,wholeProgramEquivalent:false}};
}

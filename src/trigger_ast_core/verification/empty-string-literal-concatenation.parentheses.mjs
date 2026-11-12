import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {normalizeEmptyStringLiteralConcatenation as literals} from './empty-string-literal-concatenation.mjs';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

// A parenthesized string literal is the same immutable value. This deliberately
// leaves parentheses around variables, calls, binary trees and numeric values.
export function normalizeEmptyStringLiteralConcatenation(text,options={}) {
  const base=literals(text,options),source=base.text,parse=options.parseGalaxy??parseImmutableGalaxySyntax;
  const ast=parse(source,'parenthesized-string-literal-comparison.galaxy'),edits=[];
  function visit(node) {
    if(node.kind===K.ParenthesizedExpression) {
      let value=node.expression;
      while(value.kind===K.ParenthesizedExpression)value=value.expression;
      if(value.kind===K.StringLiteral) {
        edits.push({start:node.pos,end:node.end,text:source.slice(value.pos,value.end)});return;
      }
    }
    forEachChild(node,visit);
  }
  visit(ast);let output='',cursor=0;
  for(const edit of edits.toSorted((a,b)=>a.start-b.start)) {
    assert(edit.start>=cursor,'STRING_LITERAL_PARENTHESES_OVERLAP');
    output+=source.slice(cursor,edit.start)+edit.text;cursor=edit.end;
  }
  output+=source.slice(cursor);
  assert.equal(parse(output,'parenthesized-string-literal-result.galaxy').parseDiagnostics.length,0);
  return {text:output,proof:{...base.proof,afterSha256:createHash('sha256').update(output).digest('hex'),
    literalParentheses:edits.map(({start,end})=>({start,end,retainedTokenBytesExact:true}))}};
}

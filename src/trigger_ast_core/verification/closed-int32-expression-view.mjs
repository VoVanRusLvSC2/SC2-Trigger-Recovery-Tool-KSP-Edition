import assert from 'node:assert/strict';
import {evaluateClosedInt32} from '../model/closed-int32-expression.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
export function canonicalClosedInt32ExpressionView(source){
 const ast=parse(source,'closed-int32-expression-view');assert.equal(ast.parseDiagnostics.length,0);const edits=[],records=[];
 function visit(n){
  if([K.BinaryExpression,K.PrefixUnaryExpression,K.ParenthesizedExpression,K.NumericLiteral].includes(n.kind)){
   const value=evaluateClosedInt32(n);
   if(value!==undefined){const replacement=value===-2147483648n?'(-2147483647 - 1)':value<0n?'('+value+')':String(value),before=source.slice(n.pos,n.end);
    if(before!==replacement){edits.push({start:n.pos,end:n.end,before,replacement});records.push({start:n.pos,end:n.end,value:String(value),everyIntermediateSignedInt32:true});}return;
   }
  }
  forEachChild(n,visit);
 }
 visit(ast);const applied=applyReversibleSourceEdits(source,edits);assert.equal(parse(applied.text,'closed-int32-result').parseDiagnostics.length,0);
 return{text:applied.text,proof:{kind:'EXACT_CLOSED_INT32_RADICES_AND_BITWISE_EXPRESSION_VIEW',records,edits:applied.proof,
  sourceOrExportChanged:false,fixedAndRuntimeExpressionsNotEvaluated:true,overflowAssumed:false,passGranted:false,wholeProgramOracleStillRequired:true}};
}

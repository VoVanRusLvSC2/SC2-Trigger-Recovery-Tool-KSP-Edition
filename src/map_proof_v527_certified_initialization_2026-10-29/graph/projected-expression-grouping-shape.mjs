import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

// Same structural payload as expressionGroupingShape. Apply a shallow node
// projection while visiting that payload, without cloning discarded parser
// metadata, token arrays, source text or parent links first. No cache or mutation.
const metadata=new Set(['parent','pos','end','line','char','commentsLineMap','parseDiagnostics','bindDiagnostics','additionalSyntacticDiagnostics','fileName','syntaxTokens','lineMap','__sourceText']);
export function projectedExpressionGroupingShape(root,project=node=>node){
  function visit(input){
    if(!input||typeof input!=='object')return input;
    if(Array.isArray(input))return input.map(visit);
    const node=project(input);
    if(node?.kind===K.ParenthesizedExpression)return visit(node.expression);
    if(!node||typeof node!=='object')return node;
    if(Array.isArray(node))return node.map(visit);
    return Object.fromEntries(Object.entries(node)
      .filter(([key])=>!metadata.has(key)&&!(key==='text'&&node.kind===K.SourceFile))
      .sort(([a],[b])=>a.localeCompare(b))
      .map(([key,value])=>[key,visit(value)]));
  }
  return visit(root);
}

import {
  SyntaxKind as K,
  forEachChild,
} from '../sdk/array-values/modules/galaxy/language-core/index.js';

// Absence of observable script calls is a useful recovery assumption, not proof
// that an unused lobby definition never existed. Never change input documents.
export function attributeUseInGalaxy(ast, sourceLabel) {
  if (ast.parseDiagnostics?.length) throw new Error('Attribute-use source has syntax errors');
  const calls = [];
  function visit(node) {
    if (
      node.kind === K.CallExpression &&
      node.expression?.kind === K.Identifier &&
      /^GameAttribute[A-Za-z0-9_]*$/u.test(node.expression.name)
    )
      calls.push({ function: node.expression.name, offset: node.pos });
    forEachChild(node, visit);
  }
  visit(ast);
  return { source: sourceLabel, calls };
}

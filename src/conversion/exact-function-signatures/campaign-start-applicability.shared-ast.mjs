import { Parser, SyntaxKind as K } from './index-alternate-3.js';

import { inlineGeneratedCampaignStartup as strictExpansion } from './campaign-start-inline.shared-ast.mjs';

// This is an optional specialization, not a precondition for every map.

// A non-applicable case proceeds byte-for-byte unchanged to the normal AST

// reconstruction and all its existing validation/GUI/Editor/benchmark gates.

export function inlineGeneratedCampaignStartup(source, options, document) {
  const ast = document
    ? document.input(source)
    : new Parser().parseFile('campaign-applicability.galaxy', source);

  if (ast.parseDiagnostics.length) return strictExpansion(source, options, document);

  const definitions = ast.statements.filter(
    (n) => n.kind === K.FunctionDeclaration && n.name.name === 'cai_startall',
  );

  if (definitions.length !== 1) return strictExpansion(source, options, document);

  const definition = definitions[0];

  if (!definition.body || definition.parameters.length || definition.type.kind !== K.VoidKeyword)
    return strictExpansion(source, options, document);

  const statements = definition.body.statements;

  const first = statements.findIndex(
    (n) =>
      n.kind === K.ExpressionStatement &&
      n.expression?.kind === K.CallExpression &&
      n.expression.expression?.name === 'AICampaignStart',
  );

  if (first === 0)
    return {
      changed: false,
      script: source,
      reason: 'NO_CUSTOM_AI_PREFIX_SPECIALIZATION_NOT_APPLICABLE',
    };

  let calls = 0;

  const skip = new Set(['parent', 'symbol', 'flowNode', 'syntaxTokens', 'locals']);

  function visit(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      for (const x of n) visit(x);
      return;
    }
    if (
      n.kind === K.CallExpression &&
      n.expression?.kind === K.Identifier &&
      n.expression.name === 'cai_startall'
    )
      calls++;
    for (const [k, v] of Object.entries(n)) if (!skip.has(k)) visit(v);
  }

  visit(ast);

  if (!calls)
    return {
      changed: false,
      script: source,
      reason: 'NO_STATIC_CALLS_SPECIALIZATION_NOT_APPLICABLE',
    };

  return strictExpansion(source, options, document);
}

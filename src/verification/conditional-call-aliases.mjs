import assert from 'node:assert/strict';
import { parseImmutableGalaxySyntax as parse } from '../conversion/exact-function-signatures/immutable-galaxy-syntax.mjs';
import {
  SyntaxKind as K,
  forEachChild,
} from '../conversion/exact-function-signatures/index-alternate-3.js';

// Diagnostic hypothesis only: never use this to rewrite a map or accept an alias.
// Substitute direct calls in parsed syntax; strings and declarations stay intact.
export function assumeCallAliases(source, aliases) {
  assert(aliases && typeof aliases === 'object' && !Array.isArray(aliases));
  const entries = Object.entries(aliases);
  const identifier = /^[A-Za-z_][A-Za-z_0-9]*$/u;
  for (const [from, to] of entries) {
    assert(identifier.test(from) && typeof to === 'string' && identifier.test(to));
    assert(from !== to && !Object.hasOwn(aliases, to), 'Aliases must not chain or cycle');
  }
  const ast = parse(source, 'alias-evidence.galaxy');
  assert.equal(ast.parseDiagnostics.length, 0, 'Invalid Galaxy for alias evidence');
  const replacements = [],
    counts = Object.fromEntries(entries.map(([name]) => [name, 0]));
  function visit(node) {
    if (node.kind === K.CallExpression && node.expression?.kind === K.Identifier) {
      const name = node.expression.name;
      if (Object.hasOwn(aliases, name)) {
        replacements.push({
          start: node.expression.pos,
          end: node.expression.end,
          value: aliases[name],
        });
        counts[name]++;
      }
    }
    forEachChild(node, visit);
  }
  visit(ast);
  replacements.sort((a, b) => b.start - a.start);
  let assumed = source;
  for (const { start, end, value } of replacements)
    assumed = assumed.slice(0, start) + value + assumed.slice(end);
  return { assumed, counts };
}

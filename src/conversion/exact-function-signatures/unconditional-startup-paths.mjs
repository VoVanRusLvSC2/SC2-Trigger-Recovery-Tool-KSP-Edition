import assert from 'node:assert/strict';
import { SyntaxKind as K } from './index-alternate-3.js';

/** Discover only unconditional, direct, zero-argument call prefixes. A branch,
 * return, declaration or other statement stops traversal of that function.
 * A later unsupported tail cannot invalidate a root reached before the tail.
 * This discovers paths; it does not authorize moving stores. The caller must
 * still prove uniqueness, private lifetime and every prefix's native effects. */
export function findUnconditionalStartupPaths({
  sourceFunctions,
  definitions,
  entry,
  root,
  getReturnType,
}) {
  const paths = [],
    entryChains = [],
    frontiers = [];
  const find = (name, prefix, stack) => {
    assert(stack.length < 32, 'HEADER_STARTUP_PATH_BOUND');
    if (stack.includes(name)) return;
    if (name === root) {
      paths.push(prefix);
      entryChains.push([...stack, name]);
      return;
    }
    const fn = sourceFunctions.get(name);
    if (
      !fn ||
      definitions.get(name)?.length !== 1 ||
      fn.parameters.length ||
      getReturnType(fn.type) !== 'void'
    )
      return;
    const statements = fn.body.statements;
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i],
        call = statement.kind === K.ExpressionStatement ? statement.expression : undefined;
      if (
        call?.kind !== K.CallExpression ||
        call.expression?.kind !== K.Identifier ||
        call.arguments.length
      ) {
        frontiers.push({
          function: name,
          statementIndex: i,
          kind: statement.kind,
          start: statement.pos,
          end: statement.end,
        });
        break;
      }
      find(call.expression.name, [...prefix, ...statements.slice(0, i)], [...stack, name]);
    }
  };
  assert(sourceFunctions.has(entry), 'HEADER_STARTUP_ENTRY_ABSENT');
  find(entry, [], []);
  return {
    paths,
    entryChains,
    discovery: {
      kind: 'UNCONDITIONAL_DIRECT_CALL_PREFIX',
      entry,
      root,
      entryChains,
      frontiers,
      conditionalPathsAccepted: false,
      effectOrLifetimeChecksBypassed: false,
    },
  };
}

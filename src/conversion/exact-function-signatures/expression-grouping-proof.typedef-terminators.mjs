import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseImmutableGalaxySyntax } from './immutable-galaxy-syntax.mjs';
import { SyntaxKind as K, Printer, forEachChild } from './index-alternate-3.js';
const sha = (text) => createHash('sha256').update(text).digest('hex');
const metadata = new Set([
  'parent',
  'pos',
  'end',
  'line',
  'char',
  'commentsLineMap',
  'parseDiagnostics',
  'bindDiagnostics',
  'additionalSyntacticDiagnostics',
  'fileName',
  'syntaxTokens',
  'lineMap',
  '__sourceText',
]);
const assignments = new Set([
  K.EqualsToken,
  K.PlusEqualsToken,
  K.MinusEqualsToken,
  K.AsteriskEqualsToken,
  K.SlashEqualsToken,
  K.PercentEqualsToken,
  K.LessThanLessThanEqualsToken,
  K.GreaterThanGreaterThanEqualsToken,
  K.AmpersandEqualsToken,
  K.BarEqualsToken,
  K.CaretEqualsToken,
]);

/** The complete parsed structure, modulo explicit grouping syntax only.
 * Operator trees, literal spellings, types, modifiers, call arguments and
 * statement order all remain part of the witness. */
export function expressionGroupingShape(node) {
  if (node?.kind === K.ParenthesizedExpression) return expressionGroupingShape(node.expression);
  if (Array.isArray(node)) return node.map(expressionGroupingShape);
  if (!node || typeof node !== 'object') return node;
  const entries = Object.entries(node).filter(
    ([key]) => !metadata.has(key) && !(key === 'text' && node.kind === K.SourceFile),
  );
  return Object.fromEntries(
    entries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, expressionGroupingShape(value)]),
  );
}
class GroupedPrinter extends Printer {
  constructor(typedefTerminators) {
    super();
    this.typedefTerminators = typedefTerminators;
  }

  emitNode(node) {
    if (node?.kind === K.TypedefDeclaration && this.typedefTerminators.has(node)) {
      this.write('typedef ');
      this.emitNode(node.type);
      this.write(' ');
      this.emitNode(node.name);
      return;
    }
    if (node?.kind === K.ParenthesizedExpression) {
      this.emitNode(node.expression);
      return;
    }
    if (node?.kind === K.BinaryExpression) {
      if (assignments.has(node.operatorToken?.kind)) {
        super.emitNode(node);
        return;
      }
      this.write('(');
      super.emitNode(node);
      this.write(')');
      return;
    }
    if (node?.kind === K.PrefixUnaryExpression) {
      this.write('(');
      this.emitNode(node.operator);
      this.write('(');
      this.emitNode(node.operand);
      this.write('))');
      return;
    }
    if (node?.kind === K.PostfixUnaryExpression) {
      this.write('((');
      this.emitNode(node.operand);
      this.write(')');
      this.emitNode(node.operator);
      this.write(')');
      return;
    }
    super.emitNode(node);
  }
}

/** Comparison view only. Reprinting is accepted only when reparsing proves
 * exactly the same operator/type/literal/statement tree after unwrapping
 * ParenthesizedExpression. No arithmetic or API equivalence is assumed. */
export function canonicalExpressionGrouping(source) {
  const ast = parseImmutableGalaxySyntax(source, 'grouping-input.galaxy');
  assert.equal(ast.parseDiagnostics.length, 0);
  const typedefTerminators = new WeakSet();
  let preservedTypedefTerminators = 0;
  const pending = [ast];
  while (pending.length) {
    const parent = pending.pop();
    for (const value of Object.values(parent))
      if (Array.isArray(value))
        for (let i = 0; i < value.length; i++) {
          const node = value[i];
          if (node?.kind !== K.TypedefDeclaration) continue;
          // The current parser represents a typedef terminator as the following
          // EmptyStatement. Print that existing node exactly once, never invent another.
          const next = value[i + 1];
          assert(
            next?.kind === K.EmptyStatement && source[next.pos] === ';',
            'TYPEDEF_TERMINATOR_OWNERSHIP_UNPROVEN',
          );
          typedefTerminators.add(node);
          preservedTypedefTerminators++;
        }
    const children = [];
    forEachChild(parent, (n) => {
      children.push(n);
    });
    pending.push(...children);
  }
  const text = new GroupedPrinter(typedefTerminators).printNode(ast),
    parsed = parseImmutableGalaxySyntax(text, 'grouping-output.galaxy');
  assert.equal(parsed.parseDiagnostics.length, 0, 'CANONICAL_GROUPING_SYNTAX');
  const before = JSON.stringify(expressionGroupingShape(ast)),
    after = JSON.stringify(expressionGroupingShape(parsed));
  assert.equal(after, before, 'CANONICAL_GROUPING_CHANGED_PARSED_STRUCTURE');
  let groupedNodes = 0;
  const walk = (n) => {
    if (n.kind === K.ParenthesizedExpression) groupedNodes++;
    forEachChild(n, walk);
  };
  walk(ast);
  return {
    text,
    proof: {
      kind: 'REPARSED_EXPRESSION_GROUPING',
      sourceSha256: sha(source),
      proofInputSha256: sha(text),
      structureSha256: sha(before),
      groupedNodes,
      preservedTypedefTerminators,
      completeParsedStructureUnchanged: true,
      numericSpellingsPreserved: true,
      sourceChangedOnDisk: false,
      rawOracleReplaced: false,
      acceptanceOverride: false,
    },
  };
}

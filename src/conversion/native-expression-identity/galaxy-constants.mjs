import { conversionError } from '../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import { printNode } from './script-template.mjs';
/** Integer constant expressions only: never execute user Galaxy or guess symbol names. */
export class GalaxyConstantIndex {
  folds;
  declarations = new Map();
  constructor(sources, folds = []) {
    this.folds = folds;
    for (const source of sources) this.add(source.statements, source.fileName ?? '', false);
  }
  add(statements, file, shadow) {
    for (const node of statements) {
      if (
        ![
          141 /* SyntaxKind.VariableDeclaration */, 143 /* SyntaxKind.ParameterDeclaration */,
        ].includes(node.kind)
      )
        continue;
      const name = node.name?.name;
      if (!name) continue;
      const initializer =
        node.modifiers?.some((m) => m.kind === 53 /* SyntaxKind.ConstKeyword */) &&
        [74 /* IntKeyword */, 76 /* StringKeyword */].includes(node.type?.kind)
          ? node.initializer
          : undefined;
      const old = this.declarations.get(name);
      if (!shadow && old) {
        if (
          old.ambiguous ||
          !initializer ||
          !old.initializer ||
          printNode(old.initializer) !== printNode(initializer)
        )
          this.declarations.set(name, { file, ambiguous: true });
      } else this.declarations.set(name, { file, initializer });
    }
  }
  stringValue(name) {
    const declaration = this.declarations.get(name);
    const node = declaration?.initializer;
    return !declaration?.ambiguous && node?.kind === 3 && typeof node.value === 'string'
      ? node.value
      : undefined;
  }
  scope(statements) {
    const index = new GalaxyConstantIndex([], this.folds);
    index.declarations = new Map(this.declarations);
    index.add(statements, '<local>', true);
    return index;
  }
  evaluate(expression) {
    const visiting = new Set(),
      used = new Map();
    const checked = (value) =>
      Number.isInteger(value) && value >= -2147483648 && value <= 2147483647 ? value : undefined;
    const evaluate = (node, depth = 0) => {
      if (!node || depth > 128) return undefined;
      if (node.kind === 126 /* SyntaxKind.ParenthesizedExpression */)
        return evaluate(node.expression, depth + 1);
      if (node.kind === 2 /* SyntaxKind.NumericLiteral */)
        return checked(Number(node.value ?? node.text));
      if (node.kind === 113 /* SyntaxKind.Identifier */) {
        const declaration = this.declarations.get(node.name);
        if (!declaration?.initializer || declaration.ambiguous) return undefined;
        if (visiting.has(node.name))
          conversionError('CONSTANT_CYCLE', 'Cyclic Galaxy constant expression', {
            symbol: node.name,
            file: declaration.file,
          });
        visiting.add(node.name);
        const value = evaluate(declaration.initializer, depth + 1);
        visiting.delete(node.name);
        if (value !== undefined) used.set(node.name, declaration.file);
        return value;
      }
      if (node.kind === 122 /* SyntaxKind.PrefixUnaryExpression */) {
        // Permit -2147483648, whose positive operand is outside signed int.
        const value =
          node.operand?.kind === 2 /* SyntaxKind.NumericLiteral */
            ? Number(node.operand.value ?? node.operand.text)
            : evaluate(node.operand, depth + 1);
        if (value === undefined) return undefined;
        switch (node.operator?.kind) {
          case 21 /* SyntaxKind.MinusToken */:
            return checked(-value);
          case 20 /* SyntaxKind.PlusToken */:
            return checked(value);
          case 33 /* SyntaxKind.TildeToken */:
            return checked(value) === undefined ? undefined : ~value;
        }
      }
      if (node.kind !== 124 /* SyntaxKind.BinaryExpression */) return undefined;
      const left = evaluate(node.left, depth + 1),
        right = evaluate(node.right, depth + 1);
      if (left === undefined || right === undefined) return undefined;
      switch (node.operatorToken?.kind) {
        case 20 /* SyntaxKind.PlusToken */:
          return checked(left + right);
        case 21 /* SyntaxKind.MinusToken */:
          return checked(left - right);
        case 22 /* SyntaxKind.AsteriskToken */:
          return checked(left * right);
        case 23 /* SyntaxKind.SlashToken */:
          return right ? checked(Math.trunc(left / right)) : undefined;
        case 24 /* SyntaxKind.PercentToken */:
          return right ? checked(left % right) : undefined;
        case 29 /* SyntaxKind.AmpersandToken */:
          return left & right;
        case 30 /* SyntaxKind.BarToken */:
          return left | right;
        case 31 /* SyntaxKind.CaretToken */:
          return left ^ right;
      }
      return undefined;
    };
    const value = evaluate(expression);
    if (value !== undefined && used.size)
      this.folds.push({
        expression: printNode(expression),
        value,
        declarations: [...used].map(([name, file]) => ({ name, file })),
      });
    return value;
  }
}
//# sourceMappingURL=galaxy-constants.js.map

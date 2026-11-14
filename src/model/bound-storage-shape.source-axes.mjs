import { resolveBoundTypeAlias } from '../types/bound-type-alias.mjs';
import {
  Printer,
  SyntaxKind as K,
} from '../sdk/array-values/modules/galaxy/language-core/index.js';
const printer = new Printer();

// A syntactic a[b][c] ArrayType chain is nested c -> b by the parser.
// Restore source/access order within each chain, then append dimensions from
// an underlying typedef. Reversing the complete alias-expanded list is wrong:
// typedef string[2] Pair; Pair[13] grid has access extents [13,2].
export function boundStorageShape(program, type) {
  const dimensions = [],
    aliases = [],
    seen = new Set();
  let shape = resolveBoundTypeAlias(program, type),
    depth = 0;
  while (shape.status === 'RESOLVED') {
    if (++depth > 64)
      return { status: 'UNPROVEN', reason: 'ARRAY_ALIAS_DEPTH', guiBindingAuthorized: false };
    for (const alias of shape.aliases) {
      const key = JSON.stringify([alias.sourceFile, alias.start, alias.end]);
      if (seen.has(key))
        return { status: 'UNPROVEN', reason: 'ARRAY_ALIAS_CYCLE', guiBindingAuthorized: false };
      seen.add(key);
      aliases.push(alias);
    }
    if (shape.node.kind !== K.ArrayType)
      return {
        ...shape,
        aliases,
        elementType: printer.printNode(shape.node),
        dimensions,
        rank: dimensions.length,
        dimensionOrder: 'SOURCE_ACCESS',
      };
    const segment = [];
    let node = shape.node;
    while (node.kind === K.ArrayType) {
      segment.unshift(printer.printNode(node.size));
      node = node.elementType;
    }
    dimensions.push(...segment);
    shape = resolveBoundTypeAlias(program, node);
  }
  return shape;
}

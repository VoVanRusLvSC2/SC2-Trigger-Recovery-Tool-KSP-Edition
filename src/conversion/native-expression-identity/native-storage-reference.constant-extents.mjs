import { hasImmutableGalaxyOrigin } from '../exact-function-signatures/immutable-galaxy-syntax.collections.mjs';
// Resolve a literal engine variable reference to actual supplied Galaxy storage.
// This is not reflection evaluation: no missing-name/default or callback value
// is inferred. Every owner, field, axis and scalar leaf must be unambiguous.
import { SyntaxKind as K, forEachChild } from '../exact-function-signatures/index-alternate-3.js';
import { getTypeName } from './g2t-core.js';
import { createClosedConstantIntResolver } from '../exact-function-signatures/closed-constant-int.mjs';
const un = (n) => (n?.kind === K.ParenthesizedExpression ? un(n.expression) : n);
const name = /^[A-Za-z_]\w*(?:(?:\.[A-Za-z_]\w*)|(?:\[(?:0|[1-9][0-9]*)\]))*$/u;
export function createNativeStorageReferences(asts, { sourceTexts = [] } = {}) {
  const globals = new Map(),
    structures = new Map(),
    constantInt = createClosedConstantIntResolver(asts);
  for (const ast of asts)
    for (const node of ast.statements) {
      const table =
        node.kind === K.VariableDeclaration
          ? globals
          : node.kind === K.StructDeclaration
            ? structures
            : undefined;
      if (table) {
        const rows = table.get(node.name.name) ?? [];
        rows.push({ node, fileName: ast.fileName });
        table.set(node.name.name, rows);
      }
    }
  const calls = new WeakMap(),
    unscoped = new Set();
  const visit = (n, shadowed) => {
    if (!n) return;
    if (n.kind === K.FunctionDeclaration && n.body) {
      const names = new Set(n.parameters.map((p) => p.name.name));
      const local = (node) => {
        if (node.kind === K.VariableDeclaration) names.add(node.name.name);
        forEachChild(node, local);
      };
      local(n.body);
      shadowed = names;
    }
    if (n.kind === K.CallExpression) calls.set(n, shadowed ?? unscoped);
    forEachChild(n, (c) => visit(c, shadowed));
  };
  for (const ast of asts) visit(ast);
  const allowedTexts = new Set(sourceTexts),
    foreignRoots = new WeakSet();
  const bindForeignView = (call) => {
    if (calls.has(call)) return;
    let root = call,
      depth = 0;
    while (root?.parent) {
      if (++depth > 256) return;
      root = root.parent;
    }
    if (!root || foreignRoots.has(root)) return;
    const text = root.__sourceText;
    if (
      typeof text !== 'string' ||
      !allowedTexts.has(text) ||
      !hasImmutableGalaxyOrigin(root, text, root.fileName)
    )
      return;
    foreignRoots.add(root);
    visit(root);
  };
  const calleeStatus = (call) => {
    bindForeignView(call);
    return !calls.has(call) || call.expression?.kind !== K.Identifier
      ? 'UNTRUSTED_SOURCE_VIEW'
      : calls.get(call).has(call.expression.name)
        ? 'SHADOWED'
        : 'GLOBAL';
  };

  return Object.freeze({
    calleeStatus,
    calleeIsUnshadowed(call) {
      return calleeStatus(call) === 'GLOBAL';
    },
    resolveLiteral(argument, expectedType, forbidden = new Set()) {
      argument = un(argument);
      if (
        argument?.kind !== K.StringLiteral ||
        typeof argument.value !== 'string' ||
        !name.test(argument.value)
      )
        return;
      const path = argument.value,
        tokens = [...path.matchAll(/([A-Za-z_]\w*)|\[([0-9]+)\]/gu)],
        root = tokens.shift()?.[1];
      const owners = globals.get(root) ?? [];
      if (owners.length !== 1 || forbidden.has(root)) return;
      const declaration = owners[0];
      if (declaration.node.modifiers?.length) return;
      let type = declaration.node.type;
      const steps = [];
      for (const token of tokens) {
        if (token[2] !== undefined) {
          if (type?.kind !== K.ArrayType) return;
          const resolvedExtent = constantInt(type.size),
            extent = resolvedExtent?.value,
            index = BigInt(token[2]);
          if (extent === undefined || extent <= 0n || index < 0n || index >= extent) return;
          steps.push({
            kind: 'index',
            index: String(index),
            extent: String(extent),
            extentProof: resolvedExtent.proof,
          });
          type = type.elementType;
        } else {
          if (!type || [K.ArrayType, K.MappedType].includes(type.kind)) return;
          const definitions = structures.get(getTypeName(type)) ?? [];
          if (definitions.length !== 1) return;
          const fields = definitions[0].node.members.filter(
            (f) => f.kind === K.PropertyDeclaration && f.name.name === token[1],
          );
          if (fields.length !== 1 || fields[0].modifiers?.length) return;
          steps.push({
            kind: 'member',
            structure: getTypeName(type),
            name: token[1],
            owner: definitions[0].fileName,
          });
          type = fields[0].type;
        }
      }
      if (
        !type ||
        [K.ArrayType, K.MappedType].includes(type.kind) ||
        getTypeName(type) !== expectedType
      )
        return;
      return {
        kind: 'EXACT_LITERAL_NATIVE_STORAGE_REFERENCE',
        path,
        root,
        type: expectedType,
        fileName: declaration.fileName,
        declarationStart: declaration.node.pos,
        declarationEnd: declaration.node.end,
        steps,
        storageOrCodeChanged: false,
        arbitraryReflectionAllowed: false,
      };
    },
  });
}

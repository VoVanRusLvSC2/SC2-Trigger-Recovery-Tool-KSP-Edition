/** An imported Galaxy record has no native GUI TypeElement unless the loaded
 * TriggerData actually declares one. Preserve the complete user-function body
 * in one existing NativeLib Custom Script action, including its local scope.
 * Never fabricate a duplicate record or replace the type with int.
 */
// @ts-nocheck
import { SyntaxKind } from '../exact-function-signatures/index-alternate.js';
import { getTypeName, unwrapArrayType } from './g2t-core-alternate-3.mjs';
import { syntaxChildren } from './script-template-alternate-2.mjs';
import { externalStructureDeclaration } from './external-structure-fields.mjs';
export function importedLocalScope(body, ctx) {
  const pending = [body],
    seen = new Set(),
    declarations = [],
    types = new Map();
  while (pending.length) {
    const n = pending.pop();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    if (seen.size > 250000) throw Error('Imported local scope scan bound exceeded');
    if (n.kind === SyntaxKind.VariableDeclaration) {
      const type = getTypeName(unwrapArrayType(n.type).baseType),
        contract = externalStructureDeclaration(ctx.structureByGalaxyTypeName, type);
      declarations.push(n);
      if (contract) types.set(type, contract);
    }
    pending.push(...syntaxChildren(n));
  }
  if (!types.size) return;
  // The existing Custom Script binding rewriter uses name maps, not a lexical
  // binder. Reject local names which could be mistaken for a parameter/global.
  for (const n of declarations) {
    const name = n.name?.name;
    if (ctx.globalVarByGalaxyName.has(name) || ctx.paramRefByGalaxyName?.has(name))
      throw Error('Imported local Custom Script scope has a shadowed binding: ' + name);
  }
  return {
    types: [...types].map(([type, contract]) => ({
      type,
      file: contract.file,
      signature: contract.signature,
    })),
    scope: 'complete user-function body; original local declarations and control flow retained',
  };
}

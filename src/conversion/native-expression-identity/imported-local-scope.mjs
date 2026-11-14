/** An imported Galaxy record has no native GUI TypeElement unless the loaded
 * TriggerData actually declares one. Preserve the complete user-function body
 * in one existing NativeLib Custom Script action, including its local scope.
 * Never fabricate a duplicate record or replace the type with int.
 */
// @ts-nocheck
import { SyntaxKind } from '../exact-function-signatures/index-alternate-3.js';
import { getTypeName, unwrapArrayType } from './g2t-core.generated-call-provenance.mjs';
import { syntaxChildren } from './script-template.mjs';
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
      // A GUI value-structure local is not a Galaxy reference local. Preserve
      // aliasing by retaining the complete body before creating any GUI locals.
      // Admit only a structure actually declared in this conversion operation.
      const reference = /^structref<(.+)>$/u.exec(type);
      if (reference) {
        const own = ctx.structureByGalaxyTypeName.get(reference[1]);
        const imported = externalStructureDeclaration(ctx.structureByGalaxyTypeName, reference[1]);
        if (own || imported)
          types.set(
            type,
            imported ?? { file: 'owned GUI structure', signature: JSON.stringify(own) },
          );
      }
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

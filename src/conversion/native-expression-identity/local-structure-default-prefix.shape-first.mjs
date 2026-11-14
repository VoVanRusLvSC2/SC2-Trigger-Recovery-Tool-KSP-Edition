// Fold only a complete, source-ordered scalar structure default prefix.
// GUI structure members already generate these assignments. Calls, partial
// bundles, foreign structures and mismatching values remain ordinary actions.
import { SyntaxKind as K } from '../exact-function-signatures/index-alternate-3.js';
import { getTypeName, structureMemberKey } from './g2t-core.generated-call-provenance.mjs';
import { syntaxChildren } from './script-template.mjs';
const refKey = (ref, owner) => `${ref.library ?? owner}|${ref.type}|${ref.id}`;
export function foldLocalStructureDefaultPrefix(statements, ctx, body) {
  const unchanged = () => ({ statements, folded: [] });
  const start = statements.findIndex((n) => n.kind !== K.VariableDeclaration);
  if (start < 0) return unchanged();
  // Most functions have no local structure. Reject by declaration shape before
  // walking their executable AST; the complete binding/shadowing proof below
  // is unchanged for every potentially applicable structure prefix. No cache.
  const declarations = statements.slice(0, start);
  if (!declarations.some((n) => ctx.structureByGalaxyTypeName?.has(getTypeName(n.type))))
    return unchanged();
  const byName = new Map();
  const pending = [body],
    seen = new Set();
  while (pending.length) {
    const n = pending.pop();
    if (!n || seen.has(n)) continue;
    seen.add(n);
    if (seen.size > 250000) throw Error('Local structure prefix scan bound exceeded');
    if (n.kind === K.VariableDeclaration) {
      const name = n.name?.name;
      byName.set(name, (byName.get(name) ?? 0) + 1);
    }
    pending.push(...syntaxChildren(n));
  }
  const folded = [];
  let cursor = start;
  // Prefix order must coincide with GUI declaration order: no moving a later
  // structure's initialization ahead of an intervening observable assignment.
  for (const declaration of declarations) {
    const name = declaration.name?.name;
    const structureRef = ctx.structureByGalaxyTypeName?.get(getTypeName(declaration.type));
    if (!structureRef) continue;
    if (
      declaration.initializer ||
      byName.get(name) !== 1 ||
      ctx.paramRefByGalaxyName?.has(name) ||
      ctx.globalVarByGalaxyName?.has(name)
    )
      return unchanged();
    if ((structureRef.library ?? ctx.libId) !== ctx.libId) return unchanged();
    const structure = ctx.elements[structureRef.id];
    if (structure?.type !== 'Structure' || !structure.variables?.length) return unchanged();
    const members = [];
    for (const ref of structure.variables) {
      if ((ref.library ?? ctx.libId) !== ctx.libId) return unchanged();
      const variable = ctx.elements[ref.id],
        param = variable?.initialValue && ctx.elements[variable.initialValue.id];
      if (
        variable?.type !== 'Variable' ||
        variable.isArray ||
        variable.variableType?.type === 'struct' ||
        !param?.preset
      )
        return unchanged();
      // A preset-only Param cannot execute an initializer or read mutable state.
      if (Object.keys(param).some((k) => !['type', 'id', 'library', 'preset'].includes(k)))
        return unchanged();
      const statement = statements[cursor++],
        write = statement?.expression;
      if (
        statement?.kind !== K.ExpressionStatement ||
        write?.kind !== K.BinaryExpression ||
        write.operatorToken?.kind !== K.EqualsToken
      )
        return unchanged();
      const left = write.left,
        right = write.right;
      if (
        left?.kind !== K.PropertyAccessExpression ||
        left.expression?.kind !== K.Identifier ||
        left.expression.name !== name ||
        right?.kind !== K.Identifier
      )
        return unchanged();
      const member = ctx.structureMemberByKey?.get(
        structureMemberKey(structureRef.id, left.name.name),
      );
      const preset = ctx.galaxyConstToPreset?.get(right.name);
      if (
        byName.has(right.name) ||
        ctx.paramRefByGalaxyName?.has(right.name) ||
        ctx.globalVarByGalaxyName?.has(right.name)
      )
        return unchanged();
      if (
        !member ||
        refKey(member, ctx.libId) !== refKey(ref, ctx.libId) ||
        !preset ||
        refKey(preset, ctx.libId) !== refKey(param.preset, ctx.libId)
      )
        return unchanged();
      members.push({ member: ref.id, preset: { ...preset }, sourceStatement: statement });
    }
    folded.push({ local: name, structure: structureRef.id, members });
  }
  if (!folded.length) return unchanged();
  return { statements: [...statements.slice(0, start), ...statements.slice(cursor)], folded };
}

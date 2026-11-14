/** Original evidence only; comments/strings/function declarations aren't calls.
 * No defaults or attribute definitions are invented by this selector.
 */
import assert from 'node:assert/strict';
export function originalAttributePresence({
  expandedScript,
  parseGalaxy,
  attributeModel,
  exactAttributeSource,
}) {
  const ast = parseGalaxy(expandedScript, 'original-attribute-presence.galaxy');
  assert(!ast.parseDiagnostics?.length, 'Original Galaxy cannot establish attribute presence');
  const names = new Set(['GameAttributeGameValue', 'GameAttributePlayerValue']),
    calls = [];
  const pending = [ast];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (node.kind === 121 && node.expression?.kind === 113 && names.has(node.expression.name))
      calls.push({ function: node.expression.name, pos: node.pos });
    for (const [key, value] of Object.entries(node)) {
      if (['parent', 'symbol', 'locals', 'flowNode'].includes(key)) continue;
      if (Array.isArray(value)) pending.push(...value.filter((v) => v && typeof v === 'object'));
      else if (value && typeof value === 'object') pending.push(value);
    }
  }
  const originalDefinitionCount = attributeModel?.attributes?.length ?? 0;
  const exactHeaderDefinitionCount = exactAttributeSource?.used
    ? (exactAttributeSource.model?.attributes?.length ?? 0)
    : 0;
  return {
    present: originalDefinitionCount > 0 || exactHeaderDefinitionCount > 0 || calls.length > 0,
    originalDefinitionCount,
    exactHeaderDefinitionCount,
    originalGalaxyCalls: calls,
    rule: 'ORIGINAL_ATTRIBUTE_DATA_OR_ACTUAL_AST_CALL_OR_EXACT_ORIGINAL_HEADER',
  };
}

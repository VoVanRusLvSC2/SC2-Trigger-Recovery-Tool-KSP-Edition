import assert from 'node:assert/strict';

// Names come from the generator's startup naming policy, not a corpus list.
// Ordinary NoScriptPrefix functions must not redeclare generator-owned entry
// points. Inline/Event grammars do not emit such runtime function definitions.
export function assertGeneratedEntryOwnership(library, reservedRuntimeNames) {
  if (library.implicit !== true) return;
  assert(
    Array.isArray(reservedRuntimeNames) &&
      reservedRuntimeNames.every((n) => typeof n === 'string' && n),
    'GENERATED_ENTRY_NAMES_REQUIRED',
  );
  const reserved = new Set(reservedRuntimeNames),
    conflicts = [];
  for (const element of Object.values(library.elements)) {
    if (element.type !== 'FunctionDef' || element.disabled || element.library !== library.id)
      continue;
    const flags = element.flags ?? [];
    if (
      !flags.includes('NoScriptPrefix') ||
      flags.some((f) => ['Event', 'Operator', 'Template', 'Inline'].includes(f))
    )
      continue;
    const name = element.identifier ?? element.name;
    if (reserved.has(name))
      conflicts.push({ library: library.id, type: element.type, id: element.id, name });
  }
  assert.equal(
    conflicts.length,
    0,
    'GENERATED_ENTRY_GUI_OWNERSHIP_CONFLICT:' + JSON.stringify(conflicts),
  );
}

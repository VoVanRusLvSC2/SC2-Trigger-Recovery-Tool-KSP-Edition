import assert from 'node:assert/strict';
import {
  primarySourcePrototypeKind,
  planPrimarySourcePrototypes,
} from './primary-source-prototypes.mjs';

// Bodyless declarations are neither executable authored phases nor storage
// providers. Reconstruct their source contract before separating those paths.
export function excludeVerifiedSourcePrototypes(input, sections) {
  const selected = sections.filter((s) => s.kind === primarySourcePrototypeKind);
  if (!selected.length) return sections;
  const original = planPrimarySourcePrototypes(input);
  for (const section of selected) {
    const rows = original.filter(
      (s) =>
        s.library === section.library &&
        s.fileName === section.fileName &&
        s.start === section.start &&
        s.end === section.end,
    );
    assert.equal(rows.length, 1, 'SOURCE_PROTOTYPE_SELECTION_ORIGIN_REQUIRED');
    assert.deepEqual(section, rows[0], 'SOURCE_PROTOTYPE_SELECTION_ORIGIN_CHANGED');
  }
  return sections.filter((s) => s.kind !== primarySourcePrototypeKind);
}

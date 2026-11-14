/** Extend proved ordinal grouping for digit-prefixed GUI labels (e.g. "11 Easy").







 * Source constants retain the leading underscore required by Galaxy identifiers.







 * Require the entire group to have that form and exact unique 0..N-1 literals;







 * never infer a missing ordinal or accept sparse/computed/duplicate values.







 */

export function recoverOrdinalPresetOwners(statements, libId, { libraryPrefix, getTypeName }) {
  const prefix = libraryPrefix(libId) + 'ge_',
    groups = new Map();

  for (const s of statements) {
    if (
      s.kind !== 141 ||
      !s.modifiers?.some((m) => m.kind === 53) ||
      getTypeName(s.type) !== 'int' ||
      s.initializer?.kind !== 2
    )
      continue;

    const name = s.name?.name,
      value = Number(s.initializer.value);

    if (!name?.startsWith(prefix) || !Number.isSafeInteger(value) || value < 0) continue;

    const rest = name.slice(prefix.length);

    for (let i = rest.indexOf('_'); i > 0; i = rest.indexOf('_', i + 1)) {
      const owner = rest.slice(0, i),
        stem = rest.slice(i + 1);

      if (!/^[A-Za-z_][A-Za-z_0-9]*$/u.test(owner) || !/^[A-Za-z_0-9]+$/u.test(stem)) continue;

      const list = groups.get(owner) ?? [];
      list.push({ name, value, stem });
      groups.set(owner, list);
    }
  }

  const out = new Map();

  for (const [owner, rows] of [...groups].sort((a, b) => a[0].length - b[0].length)) {
    if (rows.length < 2) continue;

    // A leading underscore escapes a digit-starting GUI label, not an owner boundary.

    const ordinaryAnchor = rows.some(
      (r) => r.value === 0 && (!r.stem.includes('_') || /^_\d[A-Za-z_0-9]*$/u.test(r.stem)),
    );

    const numericLabelAnchor = rows.every((r) => /^_\d+_[A-Za-z_0-9]+$/u.test(r.stem));

    if (!ordinaryAnchor && !numericLabelAnchor) continue;

    const ordered = [...rows].sort((a, b) => a.value - b.value);

    if (
      !ordered.every((r, i) => r.value === i) ||
      new Set(rows.map((r) => r.name)).size !== rows.length
    )
      continue;

    for (const r of ordered)
      if (!out.has(r.name))
        out.set(r.name, { presetName: owner, valueName: r.stem, ordinal: r.value });
  }

  return out;
}

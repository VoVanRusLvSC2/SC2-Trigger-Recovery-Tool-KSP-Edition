import assert from 'node:assert/strict';
const identity = (r, owner) => JSON.stringify([r.library ?? owner, r.type, r.id]);

// Preserve original per-file declaration order without moving an item into a
// different folder or moving unrelated GUI items. Numeric-looking IDs have no
// ordering authority. Independent replay calls this with repairOrder=false.
export function orderGuiAuthoredSourceSections({
  elements,
  library,
  rootRefs,
  sections,
  records,
  repairOrder = false,
}) {
  const selected = sections.filter((s) => s.library === library);
  if (!selected.length) return { files: [], changed: false };
  assert(Array.isArray(rootRefs), 'AUTHORED_SOURCE_ORDER_ROOTS_REQUIRED');
  const by = new Map(),
    groups = new Map(),
    wanted = new Map();
  for (const e of new Set(Object.values(elements))) {
    const key = identity(e, library);
    assert(!by.has(key), 'AUTHORED_SOURCE_ORDER_DUPLICATE_ID');
    by.set(key, e);
  }
  for (const section of selected) {
    assert(
      typeof section.fileName === 'string' && Number.isInteger(section.start),
      'AUTHORED_SOURCE_ORDER_ORIGINAL_POSITION_REQUIRED',
    );
    const matches = records.filter(
      (r) =>
        r.kind === 'ORIGINAL_AUTHORED_SECTION' &&
        r.library === library &&
        r.sectionSha256 === section.sha256 &&
        r.sourceSha256 === section.sourceSha256,
    );
    assert.equal(matches.length, 1, 'AUTHORED_SOURCE_ORDER_RECORD_MISSING_OR_AMBIGUOUS');
    const key = identity(matches[0], library);
    assert(by.has(key) && !wanted.has(key), 'AUTHORED_SOURCE_ORDER_ELEMENT_MISSING_OR_DUPLICATED');
    const rows = groups.get(section.fileName) ?? [];
    rows.push({ key, start: section.start });
    groups.set(section.fileName, rows);
    wanted.set(key, section.fileName);
  }
  const rank = new Map();
  for (const rows of groups.values())
    rows.sort((a, b) => a.start - b.start).forEach((r, i) => rank.set(r.key, i));
  const containers = [
    { owner: library, refs: rootRefs },
    ...[...by.values()]
      .filter((e) => e.type === 'Category')
      .map((e) => ({ owner: e.library ?? library, refs: e.items ?? [] })),
  ];
  let changed = false;
  if (repairOrder)
    for (const { owner, refs } of containers) {
      const slots = new Map();
      for (const [position, ref] of refs.entries()) {
        const key = identity(ref, owner),
          file = wanted.get(key);
        if (file === undefined) continue;
        const rows = slots.get(file) ?? [];
        rows.push({ position, key, ref });
        slots.set(file, rows);
      }
      for (const rows of slots.values()) {
        const ordered = [...rows].sort((a, b) => rank.get(a.key) - rank.get(b.key));
        for (let i = 0; i < rows.length; i++)
          if (rows[i].key !== ordered[i].key) {
            refs[rows[i].position] = ordered[i].ref;
            changed = true;
          }
      }
    }
  const seen = new Set(),
    actual = new Map([...groups].map(([file]) => [file, []])),
    stack = [{ refs: rootRefs, owner: library, index: 0 }];
  while (stack.length) {
    const frame = stack.at(-1);
    if (frame.index === frame.refs.length) {
      stack.pop();
      continue;
    }
    const ref = frame.refs[frame.index++],
      key = identity(ref, frame.owner),
      e = by.get(key);
    assert(e, 'AUTHORED_SOURCE_ORDER_DANGLING_TREE_ITEM');
    assert(!seen.has(key), 'AUTHORED_SOURCE_ORDER_TREE_CYCLE_OR_MULTIPLE_OWNER');
    seen.add(key);
    if (e.disabled) continue;
    if (wanted.has(key)) actual.get(wanted.get(key)).push(key);
    if (e.type === 'Category')
      stack.push({ refs: e.items ?? [], owner: e.library ?? library, index: 0 });
  }
  const files = [];
  for (const [file, rows] of groups) {
    assert.deepEqual(
      actual.get(file),
      rows.map((r) => r.key),
      'AUTHORED_SOURCE_ORDER_CHANGED_OR_UNREACHABLE',
    );
    files.push({ fileName: file, identities: rows.map((r) => JSON.parse(r.key)) });
  }
  return {
    kind: 'EXACT_ORIGINAL_AUTHORED_SECTION_ORDER',
    files,
    changed,
    folderMembershipPreserved: true,
    guiEmissionAuthorized: false,
  };
}

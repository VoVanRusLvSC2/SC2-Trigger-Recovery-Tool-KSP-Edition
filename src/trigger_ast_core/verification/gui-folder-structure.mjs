import assert from 'node:assert/strict';

// Inserting recovered items is allowed; original typed elements, folders and
// their ordered memberships must survive. No names or map-specific IDs enter it.
export function verifyGuiFolderStructure(before, after, xmlTree, implicitLibrary = 'Map') {
  function observe(xml) {
    const elements = new Set(), groups = new Map();
    if (!xml?.trim()) return {elements, groups};
    function visit(node, library) {
      if (node.tag === 'Library') library = node.attributes.Id;
      if (node.tag === 'Element') {
        const a = node.attributes;
        const key = JSON.stringify([library, a.Type, a.Id]);
        assert(!elements.has(key), 'DUPLICATE_GUI_TYPED_ID'); elements.add(key);
        if (a.Type !== 'Category') return;
      }
      if (node.tag === 'Root' || node.tag === 'Element' && node.attributes.Type === 'Category') {
        const key = JSON.stringify([library, node.tag, node.attributes.Id ?? '']);
        assert(!groups.has(key), 'DUPLICATE_GUI_GROUP');
        groups.set(key, node.children.filter(n => n.tag === 'Item').map(n =>
          JSON.stringify([n.attributes.Library ?? library, n.attributes.Type, n.attributes.Id])));
      }
      for (const child of node.children ?? []) visit(child, library);
    }
    visit(xmlTree(xml), implicitLibrary);
    return {elements, groups};
  }
  const a = observe(before), b = observe(after);
  for (const key of a.elements) assert(b.elements.has(key), 'ORIGINAL_GUI_ELEMENT_REMOVED: ' + key);
  for (const [key, members] of a.groups) {
    const output = b.groups.get(key); assert(output, 'ORIGINAL_GUI_FOLDER_REMOVED: ' + key);
    let cursor = 0;
    for (const member of members) {
      const index = output.indexOf(member, cursor);
      assert(index >= 0, 'ORIGINAL_GUI_MEMBERSHIP_REMOVED_OR_REORDERED: ' + key);
      cursor = index + 1;
    }
  }
  return {kind: 'ORIGINAL_TYPED_ELEMENTS_AND_ORDERED_GUI_GROUPS', originalElements: a.elements.size,
    preservedGroups: a.groups.size, addedElements: b.elements.size - a.elements.size,
    foldersAndOriginalOrderingPreserved: true, semanticEquivalenceProved: false};
}

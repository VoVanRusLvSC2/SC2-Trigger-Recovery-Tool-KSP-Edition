/**
 * Optional metadata pass for MAP's generated implicit map document.
 * No converter files are patched. Callers supply the existing strict XML parser.
 * Only flags and references in the generated Functions/Actions folders change;
 * action bodies, IDs, parameters, return types and unknown raw XML remain intact.
 */
export function applyEditorProfile(raw, { parseXml, triggerStrings = '' }) {
  const tree = parseXml(raw)
  if (tree.tag !== 'TriggerData') throw new TypeError('Expected TriggerData')
  const root = tree.children.find(node => node.tag === 'Root')
  if (!root || root.selfClosing) throw new TypeError('A populated implicit map Root is required')
  const definitions = tree.children.filter(node => node.tag === 'Element')
  const used = new Set(definitions.map(node => node.attributes.Id))
  const edits = [], notes = [], changes = []
  const textOf = node => raw.slice(node.openEnd, node.closeStart).trim()
  const categoryName = node => {
    const identifier = node.children.find(child => child.tag === 'Identifier')
    return identifier ? textOf(identifier) : undefined
  }
  const folders = new Map(definitions.filter(node => node.attributes.Type === 'Category')
    .map(node => [categoryName(node), node]))
  // Preserve authored custom folder hierarchies: this pass is deliberately
  // restricted to MAP's known generated folders rather than every Category.
  if (!folders.has('Functions') || !folders.has('Actions')) throw new TypeError('Generated Functions/Actions folders not found')
  const roles = new Map(), counts = { function: 0, condition: 0, action: 0, skippedNative: 0 }
  for (const node of definitions.filter(node => node.attributes.Type === 'FunctionDef')) {
    const flags = new Set(node.children.map(child => child.tag).filter(tag => tag.startsWith('Flag')))
    if (flags.has('FlagNative') || flags.has('FlagHidden')) { counts.skippedNative++; continue }
    const result = node.children.find(child => child.tag === 'ReturnType')
      ?.children.find(child => child.tag === 'Type')?.attributes.Value ?? 'void'
    // An explicit action role is evidence; a bool action is not silently
    // reinterpreted as a predicate merely because it returns bool.
    const role = flags.has('FlagCondition') ? 'condition' : flags.has('FlagAction') ? 'action'
      : result === 'bool' ? 'condition' : result === 'void' ? 'action' : 'function'
    if (role === 'condition' && result !== 'bool') throw new TypeError('Condition has a non-bool return type: ' + node.attributes.Id)
    roles.set(node.attributes.Id, role); counts[role]++
    const tag = role === 'condition' ? 'FlagCondition' : role === 'action' ? 'FlagAction' : 'FlagCall'
    if (!flags.has(tag)) {
      // Keep existing Call/CreateThread/NoScriptPrefix/Template flags. A condition
      // can also be a value call; toggling unrelated flags could change Galaxy.
      edits.push({ start: node.openEnd, end: node.openEnd, replacement: '\n      <' + tag + '/>' })
      changes.push({ id: node.attributes.Id, role, addedFlag: tag })
    }
  }
  const names = { function: 'Functions', condition: 'Conditions', action: 'Actions' }
  const additions = new Map(Object.values(names).map(name => [name, []]))
  const assigned = new Map()
  for (const [name, category] of folders) {
    if (!Object.values(names).includes(name)) continue
    for (const item of category.children.filter(child => child.tag === 'Item' && child.attributes.Type === 'FunctionDef')) {
      if (item.attributes.Library && item.attributes.Library !== 'Map') continue
      const id = item.attributes.Id, role = roles.get(id)
      if (!role) continue
      if (assigned.has(id)) throw new TypeError('Multiple generated folder owners: ' + id)
      assigned.set(id, name)
      const target = names[role]
      if (name !== target) {
        edits.push({ start: item.start, end: item.end, replacement: '' })
        // Carry the entire reference token, including future/vendor attributes.
        // Trivia stays at its original anchor; the known Item follows its ID.
        additions.get(target).push({ id, raw: raw.slice(item.start,item.end) })
        changes.push({ id, role, fromFolder: name, toFolder: target })
      }
    }
  }
  // Definitions outside generated folders are left in their authored locations.
  // This avoids changing nested user categories or treating a library stub as GUI.
  const stringLines = []
  for (const [name, ids] of additions) {
    if (!ids.length) continue
    const items = ids.map(item => '\n      ' + item.raw).join('')
    const category = folders.get(name)
    if (category) {
      if (category.selfClosing) throw new TypeError('Generated category expansion requires a separate policy')
      edits.push({ start: category.closeStart, end: category.closeStart, replacement: items + '\n    ' })
    } else {
      let value = 0xf0000000
      while (used.has(value.toString(16).toUpperCase().padStart(8, '0'))) value++
      const id = value.toString(16).toUpperCase().padStart(8, '0'); used.add(id)
      edits.push({ start: root.closeStart, end: root.closeStart, replacement: '\n      <Item Type="Category" Id="' + id + '"/>\n    ' })
      edits.push({ start: tree.closeStart, end: tree.closeStart,
        replacement: '\n    <Element Type="Category" Id="' + id + '">\n      <Identifier>' + name + '</Identifier>' + items + '\n    </Element>\n' })
      stringLines.push('Category/Name/' + id + '=' + name)
      notes.push({ newFolder: name, id })
    }
  }
  // Apply disjoint spans once. Sorting on end handles an insertion at the same
  // offset as a deletion; overlapping source edits are rejected, never guessed.
  const parts = []; let cursor = 0
  for (const edit of edits.sort((a,b) => a.start-b.start || a.end-b.end)) {
    if (edit.start < cursor) throw new TypeError('Overlapping editor profile edits')
    parts.push(raw.slice(cursor,edit.start),edit.replacement); cursor=edit.end
  }
  parts.push(raw.slice(cursor))
  const xml = parts.join(''); parseXml(xml)
  const newline = triggerStrings.includes('\r\n') ? '\r\n' : '\n'
  const strings = triggerStrings + (stringLines.length && triggerStrings && !triggerStrings.endsWith('\n') ? newline : '')
    + stringLines.map(line => line + newline).join('')
  return { xml, triggerStrings: strings, counts, changes, notes,
    scope: 'generated folder/flag metadata only; not an OOM fix or business-logic repair' }
}

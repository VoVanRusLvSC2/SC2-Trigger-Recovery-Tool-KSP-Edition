import sax from 'sax'

/** Strict XML parse with original UTF-16 spans. SAX validates entities and nesting. */
export function xmlTree(text) {
  const parser = sax.parser(true, { trim: false, normalize: false })
  const roots = []
  const stack = []
  parser.onopentag = node => {
    const item = { tag: node.name, attributes: { ...node.attributes }, start: parser.startTagPosition - 1,
      openEnd: parser.position, end: parser.position, children: [], selfClosing: node.isSelfClosing }
    const parent = stack.at(-1)
    item.scope = node.name === 'Library' ? node.attributes.Id : parent?.scope
    if (node.name === 'Standard' && parent) parent.scope = node.attributes.Id
    if (parent) parent.children.push(item)
    else roots.push(item)
    stack.push(item)
  }
  parser.onclosetag = () => {
    const node = stack.pop()
    node.end = parser.position
    node.closeStart = node.selfClosing ? node.openEnd : text.lastIndexOf('</', node.end - 1)
  }
  parser.write(text).close()
  if (roots.length !== 1 || stack.length) throw new TypeError('Expected one complete XML root')
  return roots[0]
}

const key = node => node.tag === 'Element'
  ? `Element:${node.attributes.Type}:${node.attributes.Id}`
  : node.tag === 'Library' ? `Library:${node.attributes.Id}`
  : node.attributes.Id !== undefined ? `${node.tag}:${node.attributes.Type ?? ''}:${node.attributes.Library === node.scope ? '' : node.attributes.Library ?? ''}:${node.attributes.Id}` : node.tag
const slice = (text, node) => text.slice(node.start, node.end)

function mergeOpening(raw, original, oldNode, newNode) {
  let open = raw.slice(original.start, original.openEnd)
  for (const name of new Set([...Object.keys(oldNode.attributes), ...Object.keys(newNode.attributes)])) {
    const value = newNode.attributes[name]
    if (oldNode.attributes[name] === value) continue
    // Consume complete attribute tokens: a name-looking substring inside an
    // unknown attribute's quoted value is not an attribute to edit.
    const attributes = [...open.matchAll(/\s+([^\s"'<>/=]+)(\s*=\s*)(["'])([\s\S]*?)\3/g)]
    const match = attributes.find(attribute => attribute[1] === name)
    if (value === undefined) {
      if (match) open = open.slice(0, match.index) + open.slice(match.index + match[0].length)
      continue
    }
    const escape = quote => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll(quote, quote === '"' ? '&quot;' : '&apos;')
      .replaceAll('\r', '&#13;').replaceAll('\n', '&#10;').replaceAll('\t', '&#9;')
    if (match) {
      const quote = match[3], prefix = match[0].slice(0, match[0].length - match[4].length - 1)
      open = open.slice(0, match.index) + prefix + escape(quote) + quote + open.slice(match.index + match[0].length)
    }
    else open = open.replace(/\/?\>$/, ending => ` ${name}="${escape('"')}"${ending}`)
  }
  return open
}

/** Preserve trivia, mixed text, unknown attributes and unknown children in their original places.
 * Reconcile each tag's ordered sequence by scoped identity and occurrence.
 * Raw node payload follows its identity; trivia and unknown sibling anchors stay
 * in their original slots. Added siblings occupy sequence slots, then overflow
 * immediately after the last existing sibling of that tag.
 */
function mergeNode(raw, original, before, oldNode, after, newNode) {
  if (slice(before, oldNode) === slice(after, newNode)) return slice(raw, original)
  const opening = mergeOpening(raw, original, oldNode, newNode)
  if (original.selfClosing) {
    if (oldNode.selfClosing && newNode.selfClosing) {
      return opening
    }
    throw new TypeError('LOSSLESS_CONTAINER_EXPANSION_REQUIRES_POLICY')
  }
  if (!oldNode.children.length && !newNode.children.length) {
    return opening + after.slice(newNode.openEnd, newNode.closeStart) + raw.slice(original.closeStart, original.end)
  }
  const groups = nodes => {
    const map = new Map()
    for (const node of nodes) { const k = node.tag; if (!map.has(k)) map.set(k, []); map.get(k).push(node) }
    return map
  }
  const originals = groups(original.children), olds = groups(oldNode.children), news = groups(newNode.children)
  const edits = [{start: original.start, end: original.openEnd, replacement: opening}]
  for (const k of new Set([...olds.keys(), ...news.keys()])) {
    const a = olds.get(k) ?? [], b = news.get(k) ?? [], o = originals.get(k) ?? []
    if (a.length === b.length && a.every((node, index) => slice(before, node) === slice(after, b[index]))) continue
    const sequenceUnchanged = a.length === b.length && a.every((node, index) => key(node) === key(b[index]))
    const available = new Map()
    for (const node of o) {
      const identity = key(node)
      if (!available.has(identity)) available.set(identity, [])
      available.get(identity).push(node)
    }
    const matches = new Map()
    for (const node of a) {
      const identity = key(node), originalNode = available.get(identity)?.shift()
      if (!originalNode) throw new TypeError('LOSSLESS_SOURCE_BASELINE_MISMATCH')
      if (!matches.has(identity)) matches.set(identity, [])
      matches.get(identity).push({original: originalNode, before: node})
    }
    if ([...available.values()].some(nodes => nodes.length)) throw new TypeError('LOSSLESS_SOURCE_BASELINE_MISMATCH')
    const replacements = b.map(node => {
      const match = matches.get(key(node))?.shift()
      const replacement = match ? mergeNode(raw, match.original, before, match.before, after, node) : slice(after, node)
      if (sequenceUnchanged) {
        // Canonical serialization sorts definitions. An unchanged canonical
        // identity sequence must not reorder the author's raw definitions.
        if (replacement !== slice(raw, match.original)) edits.push({start: match.original.start, end: match.original.end, replacement})
      }
      return replacement
    })
    if (sequenceUnchanged) continue
    for (let i = 0; i < o.length; i++) {
      const replacement = replacements[i] ?? ''
      if (replacement !== slice(raw, o[i])) edits.push({start: o[i].start, end: o[i].end, replacement})
    }
    if (replacements.length > o.length) {
      const at = o.at(-1)?.end ?? original.closeStart
      edits.push({start: at, end: at, replacement: replacements.slice(o.length).join('')})
    }
  }
  // Assemble once rather than copy the full parent for each sibling edit.
  const parts = []
  let cursor = original.start
  for (const edit of edits.sort((a, b) => a.start - b.start || a.end - b.end)) {
    if (edit.start < cursor || edit.end > original.end) throw new TypeError('LOSSLESS_OVERLAPPING_EDITS')
    if (edit.start === original.start && edit.end === original.openEnd && edit.replacement === raw.slice(edit.start, edit.end)) continue
    parts.push(raw.slice(cursor, edit.start), edit.replacement)
    cursor = edit.end
  }
  parts.push(raw.slice(cursor, original.end))
  return parts.join('')
}

export function writeLosslessXml(source, generated) {
  if (source.canonical === generated) return source.raw
  const original = xmlTree(source.raw), before = xmlTree(source.canonical), after = xmlTree(generated)
  const merged = mergeNode(source.raw, original, source.canonical, before, generated, after)
  const result = source.raw.slice(0, original.start) + merged + source.raw.slice(original.end)
  xmlTree(result)
  return result
}

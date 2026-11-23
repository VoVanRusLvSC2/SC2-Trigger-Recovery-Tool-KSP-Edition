/** An actually empty dependency TriggerData carries no semantic libraries.
 * Do not skip documents with any attributes, children, definitions or malformed XML.
 * The loader's dependency chain and resource identity are kept unchanged.
 */
import { createHash } from 'node:crypto';
export function isStrictlyEmpty(xml, parseXml) {
  const tree = parseXml(xml);
  if (tree.tag !== 'TriggerData' || Object.keys(tree.attributes).length || tree.children.length)
    return false;
  // Reject non-whitespace text inside the nominally empty root.
  const raw = tree.selfClosing ? '' : xml.slice(tree.openEnd, tree.closeStart);
  return raw.trim() === '';
}

export function removeEmptyDependencyDocuments(documents, parseXml, reuse) {
  const retained = [],
    omitted = [];
  for (const [index, document] of documents.entries()) {
    const classify = () => isStrictlyEmpty(document.triggerData, parseXml);
    if (reuse ? reuse(document, classify) : classify()) {
      omitted.push({
        index,
        sourcePath: document.sourcePath,
        bytes: Buffer.byteLength(document.triggerData),
        sha256: createHash('sha256').update(document.triggerData).digest('hex'),
        reason: 'Strictly empty TriggerData root; no library or executable element',
      });
    } else retained.push(document);
  }
  return { retained, omitted };
}

/** An actually empty dependency TriggerData carries no semantic libraries.
 * Do not skip documents with any attributes, children, definitions or malformed XML.
 * The loader's dependency chain and resource identity are kept unchanged.
 */
import { createHash } from 'node:crypto';
export function removeEmptyDependencyDocuments(documents, parseXml) {
  const retained = [],
    omitted = [];
  for (const [index, document] of documents.entries()) {
    const tree = parseXml(document.triggerData);
    if (
      tree.tag === 'TriggerData' &&
      Object.keys(tree.attributes).length === 0 &&
      tree.children.length === 0
    ) {
      // Reject non-whitespace text inside the nominally empty root.
      const raw = tree.selfClosing ? '' : document.triggerData.slice(tree.openEnd, tree.closeStart);
      if (raw.trim() === '') {
        omitted.push({
          index,
          sourcePath: document.sourcePath,
          bytes: Buffer.byteLength(document.triggerData),
          sha256: createHash('sha256').update(document.triggerData).digest('hex'),
          reason: 'Strictly empty TriggerData root; no library or executable element',
        });
        continue;
      }
    }
    retained.push(document);
  }
  return { retained, omitted };
}

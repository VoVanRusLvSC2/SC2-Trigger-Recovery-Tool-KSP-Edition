/** Assemble disjoint original-offset XML edits once. No cross-run cache.
 * Descending stable order matches the previous repeated-slice implementation.
 * Reject overlapping or invalid offsets rather than silently corrupting XML.
 */
import assert from 'node:assert/strict';
export function applyDisjointXmlPatches(xml, patches) {
  const ordered = [...patches].sort((a, b) => b.start - a.start),
    chunks = [];
  let cursor = xml.length;
  for (const patch of ordered) {
    assert(Number.isSafeInteger(patch.start) && Number.isSafeInteger(patch.end));
    assert(
      patch.start >= 0 && patch.end >= patch.start && patch.end <= cursor,
      'Invalid/overlapping XML patch',
    );
    assert(patch.text === undefined || typeof patch.text === 'string');
    chunks.push(xml.slice(patch.end, cursor), patch.text ?? '');
    cursor = patch.start;
  }
  chunks.push(xml.slice(0, cursor));
  return chunks.reverse().join('');
}

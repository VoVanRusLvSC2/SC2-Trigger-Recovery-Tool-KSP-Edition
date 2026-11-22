import { xmlTree } from '../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
import { parseTriggerXmlSync } from '../sdk/array-values/modules/triggers/shared/trigger-document/sax-reader.js';

/** A parser view only. Explicit libraries stay siblings, never children of a
 * synthetic library. Verify ownership and cardinality before the SAX reader's
 * first-definition-wins tables can hide duplicate or unsupported elements. */
export function readOwnedGuiLibraries(xml, implicitLibraryId = 'Map', options) {
  const root = xmlTree(xml);
  if (root.tag !== 'TriggerData') throw Error('GUI_TRIGGER_DATA_ROOT_REQUIRED');
  const standards = root.children.filter((n) => n.tag === 'Standard'),
    embedded = root.children.filter((n) => n.tag === 'Library');
  if (standards.length > 1) throw Error('GUI_IMPLICIT_LIBRARY_AMBIGUOUS');
  const direct = root.children.filter((n) => !['Standard', 'Library'].includes(n.tag));
  const implicitOwner = standards[0]?.attributes.Id ?? implicitLibraryId,
    scopes = [];
  if (direct.some((n) => ['Element', 'Root'].includes(n.tag)) || standards.length) {
    if (!/^[A-Za-z0-9_]+$/u.test(implicitOwner)) throw Error('GUI_IMPLICIT_LIBRARY_ID_INVALID');
    scopes.push({ owner: implicitOwner, nodes: direct });
  }
  for (const lib of embedded) scopes.push({ owner: lib.attributes.Id, nodes: lib.children });
  const expected = new Map();
  for (const { owner, nodes } of scopes) {
    if (!owner || expected.has(owner)) throw Error('GUI_LIBRARY_OWNER_DUPLICATED');
    const elements = new Set();
    for (const node of nodes) {
      if (node.tag === 'Library') throw Error('GUI_NESTED_LIBRARY_UNSUPPORTED');
      if (node.tag !== 'Element') continue;
      const { Type: type, Id: id } = node.attributes,
        k = JSON.stringify([type, id]);
      if (!type || !id) throw Error('GUI_TYPED_ELEMENT_IDENTITY_REQUIRED');
      if (elements.has(k)) throw Error('GUI_TYPED_ELEMENT_DUPLICATED');
      elements.add(k);
    }
    expected.set(owner, elements);
  }
  const needsImplicit =
    standards.length === 0 && scopes.some((s) => s.owner === implicitOwner && s.nodes === direct);
  const view = needsImplicit
    ? xml.slice(0, root.openEnd) + `<Standard Id="${implicitOwner}"/>` + xml.slice(root.openEnd)
    : xml;
  const parsed = parseTriggerXmlSync(view, options);
  if (parsed.size !== expected.size) throw Error('GUI_LIBRARY_PARSE_COVERAGE_LOST');
  for (const [owner, elements] of expected) {
    const lib = parsed.get(owner);
    if (!lib) throw Error('GUI_LIBRARY_PARSE_COVERAGE_LOST');
    const actual = new Set(
      Object.values(lib.elements ?? {}).map((e) => JSON.stringify([e.type, e.id])),
    );
    if (elements.size !== actual.size || [...elements].some((k) => !actual.has(k)))
      throw Error('GUI_ELEMENT_PARSE_COVERAGE_LOST');
  }
  return parsed;
}

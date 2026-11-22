import { indexGuiXmlElements } from '../../utilities/index-gui-xml-elements.mjs';
import { xmlTree } from '../../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
import {
  parseTriggerXmlSync,
  readImplicitTriggerModel,
  readTriggerTreeAndModel,
} from './sax-reader-alternate-3.js';
import { readRecoveryModel } from '../../utilities/recovery-parse-scope.mjs';

export function isInitializerAdapterCandidate(element) {
  return (
    element.type === 'FunctionDef' &&
    element.scriptCode &&
    (element.scriptCode.includes('#SUBFUNCS') ||
      element.flags?.includes('Event') ||
      element.flags?.includes('SubFunctions'))
  );
}

function parseReadOnly(xml, owner) {
  const libraries = readOwnedGuiLibraries(xml, owner, { retainSource: false });
  // Capture the observation before any consumer gets the model. Only the full
  // SDK verifier can decide whether a candidate is an authorized adapter.
  const hasAdapter = [...libraries.values()].some((library) =>
    hasGuiFunctionDefinition(library, isInitializerAdapterCandidate),
  );
  return { libraries, hasAdapter };
}

export function hasGuiFunctionDefinition(library, predicate) {
  const definitions = library.elementsByType.FunctionDef ?? {};
  if (Object.values(definitions).some(predicate)) return true;
  // The SAX typed table uses ordinary objects. Inherited property names
  // can exist in the flat table while being absent from the typed table.
  return Object.getOwnPropertyNames(Object.prototype).some((id) => {
    const definition = library.elements['FunctionDef:' + id];
    return definition !== undefined && predicate(definition);
  });
}

export function hasInitializerAdapterCandidate(xml, owner) {
  return readRecoveryModel(xml, parseReadOnly, owner).hasAdapter;
}

export function readOnlyOwnedGuiLibraries(xml, owner = 'Map') {
  return readRecoveryModel(xml, parseReadOnly, owner).libraries;
}

/** A parser view only. Explicit libraries stay siblings, never children of a
 * synthetic library. Verify ownership and cardinality before the SAX reader's
 * first-definition-wins tables can hide duplicate or unsupported elements. */
export function readOwnedGuiLibraries(xml, implicitLibraryId = 'Map', options) {
  let shared;
  if (options?.retainSource === false && xml.length >= 256 * 1024) {
    try {
      shared = readTriggerTreeAndModel(xml, implicitLibraryId);
    } catch {
      // Use the regular reader to retain the original error and its precedence.
    }
  }
  const root = shared?.root ?? xmlTree(xml);
  if (root.tag !== 'TriggerData') throw Error('GUI_TRIGGER_DATA_ROOT_REQUIRED');
  const standards = root.children.filter((n) => n.tag === 'Standard'),
    embedded = root.children.filter((n) => n.tag === 'Library');
  if (standards.length > 1) throw Error('GUI_IMPLICIT_LIBRARY_AMBIGUOUS');
  const direct = root.children.filter((n) => !['Standard', 'Library'].includes(n.tag));
  const implicitOwner = standards[0]?.attributes.Id ?? implicitLibraryId,
    scopes = [];
  if (direct.some((n) => ['Element', 'Root'].includes(n.tag)) || standards.length) {
    if (!/^[A-Za-z0-9_]+$/u.test(implicitOwner)) throw Error('GUI_IMPLICIT_LIBRARY_ID_INVALID');
    scopes.push({ owner: implicitOwner, group: root, nodes: direct });
  }
  for (const lib of embedded)
    scopes.push({ owner: lib.attributes.Id, group: lib, nodes: lib.children });
  const expected = new Map();
  for (const { owner, group, nodes } of scopes) {
    if (!owner || expected.has(owner)) throw Error('GUI_LIBRARY_OWNER_DUPLICATED');
    const index = indexGuiXmlElements(group);
    if (
      index.duplicate ||
      index.missingIdentity ||
      (group !== root && nodes.some((n) => n.tag === 'Library'))
    ) {
      const seen = new Set();
      for (const node of nodes) {
        if (node.tag === 'Library') throw Error('GUI_NESTED_LIBRARY_UNSUPPORTED');
        if (node.tag !== 'Element') continue;
        const { Type: type, Id: id } = node.attributes;
        if (!type || !id) throw Error('GUI_TYPED_ELEMENT_IDENTITY_REQUIRED');
        const key = JSON.stringify([type, id]);
        if (seen.has(key)) throw Error('GUI_TYPED_ELEMENT_DUPLICATED');
        seen.add(key);
      }
    }
    expected.set(owner, index);
  }
  const needsImplicit =
    standards.length === 0 && scopes.some((s) => s.owner === implicitOwner && s.nodes === direct);
  let parsed = shared?.libraries;
  if (!parsed && needsImplicit && options?.retainSource === false) {
    parsed = readImplicitTriggerModel(xml, implicitOwner);
  } else if (!parsed) {
    const view = needsImplicit
      ? xml.slice(0, root.openEnd) + `<Standard Id="${implicitOwner}"/>` + xml.slice(root.openEnd)
      : xml;
    parsed = parseTriggerXmlSync(view, options);
  }
  if (parsed.size !== expected.size) throw Error('GUI_LIBRARY_PARSE_COVERAGE_LOST');
  for (const [owner, index] of expected) {
    const lib = parsed.get(owner);
    if (!lib) throw Error('GUI_LIBRARY_PARSE_COVERAGE_LOST');
    // The SAX flat table registers one entry per typed identity. Verify
    // membership against the authored index and count to catch lost nodes.
    const actual = Object.values(lib.elements ?? {});
    if (
      actual.length !== index.entries.length ||
      actual.some((e) => !index.byType.get(e.type)?.has(e.id))
    )
      throw Error('GUI_ELEMENT_PARSE_COVERAGE_LOST');
  }
  return parsed;
}

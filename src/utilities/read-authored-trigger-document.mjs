/** Audit helper for both explicit libraries and SC2's implicit map root.
 * A parser-only Standard tag supplies missing scope metadata. Original bytes
 * are preserved in TriggerDocument.raw/CST and never written back to the map.
 * Nonempty XML may never produce a vacuously successful empty inventory.
 */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
export async function readAuthoredTriggerDocument(raw, sdk, triggerStrings = '') {
  const root = sdk + '/dist/modules/triggers/';
  const [{ TriggerDocument }, { parseTriggerXmlSync, readTriggerLibrariesFast }, { xmlTree }] =
    await Promise.all([
      import(pathToFileURL(root + 'services/galaxy-conversion/trigger-document.js')),
      import(pathToFileURL(root + 'shared/trigger-document/sax-reader.js')),
      import(pathToFileURL(root + 'shared/trigger-document/lossless-xml.js')),
    ]);
  const cst = xmlTree(raw),
    standards = cst.children.filter((n) => n.tag === 'Standard');
  assert(standards.length <= 1, 'Ambiguous implicit map scope');
  const rootElements = cst.children.filter((n) => n.tag === 'Element');
  let input = raw;
  if (!standards.length && rootElements.length) {
    const ids = new Set(
      cst.children.filter((n) => n.tag === 'Library').map((n) => n.attributes.Id),
    );
    assert(!ids.has('Map'), 'Implicit root conflicts with an explicit Map library');
    input = raw.slice(0, cst.openEnd) + '<Standard Id="Map"/>' + raw.slice(cst.openEnd);
  }
  const parsed = parseTriggerXmlSync(input),
    strings = new Map([...parsed.keys()].map((id) => [id, triggerStrings]));
  const loaded = await readTriggerLibrariesFast([parsed], strings);
  const doc = new TriggerDocument(raw, new Map([...loaded].map(([id, r]) => [id, r.library])));
  let xmlElements = 0;
  const count = (n) => {
    if (n.tag === 'Element') xmlElements++;
    n.children.forEach(count);
  };
  count(cst);
  const parsedElements = [...doc.libraries.values()].reduce(
    (n, l) => n + Object.keys(l.elements ?? {}).length,
    0,
  );
  assert.equal(parsedElements, xmlElements, 'XML definitions were omitted by the audit parser');
  assert(xmlElements === 0 || doc.libraries.size > 0, 'Nonempty document lost all scopes');
  return {
    document: doc,
    scopeProof: {
      implicitMapRootSupplied: input !== raw,
      originalBytesPreserved: true,
      xmlElements,
      parsedElements,
    },
  };
}

/** Check all typed DTO references, including parameter/action arrays and root
 * items. The older field-name-limited checker omitted these collections.
 */
export function validateAuthoredReferences(document, externals = new Map()) {
  const all = new Map([...externals, ...document.libraries]),
    issues = [];
  const skip = new Set(['xmlSource', 'rawXml', 'parent']);
  for (const [owner, library] of document.libraries) {
    const visit = (value, source, field, definition) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach((v, i) => visit(v, source, field + '[' + i + ']', definition));
        return;
      }
      if (value !== definition && typeof value.id === 'string' && typeof value.type === 'string') {
        const target = all.get(value.library ?? owner),
          element =
            target?.elementsByType?.[value.type]?.[value.id] ?? target?.elements?.[value.id];
        if (!element || element.type !== value.type)
          issues.push({
            owner: source,
            field,
            reference: {
              id: value.id,
              type: value.type,
              ...(value.library ? { library: value.library } : {}),
            },
            reason: 'UNRESOLVED_TYPED_REFERENCE',
          });
      }
      for (const [key, v] of Object.entries(value))
        if (!skip.has(key)) visit(v, source, field + '.' + key, definition);
    };
    for (const element of Object.values(library.elements ?? {}))
      visit(element, element.id, 'element', element);
    // Libraries expose root category references separately from definitions.
    if (library.rootRefs) visit(library.rootRefs, owner, 'library.rootRefs', undefined);
  }
  return {
    valid: issues.length === 0,
    issues,
    scope: 'All typed model references and library root arrays',
  };
}

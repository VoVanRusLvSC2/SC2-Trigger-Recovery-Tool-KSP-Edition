import assert from 'node:assert/strict';
import { arrayValuesSdkRoot, isLocalTriggerSdk, loadAuthoredSdk } from '../sdk/runtime.mjs';
const { TriggerDocument, parseTriggerXmlSync, readTriggerLibrariesFast, xmlTree } =
  await loadAuthoredSdk();
export { validateAuthoredReferences } from '../utilities/read-authored-trigger-document.mjs';
export async function readAuthoredTriggerDocument(
  raw,
  sdk = arrayValuesSdkRoot,
  strings = '',
  parserOptions,
) {
  assert(isLocalTriggerSdk(sdk), 'Authored scope reader requires the bundled array-values SDK');
  const cst = xmlTree(raw),
    standards = cst.children.filter((n) => n.tag === 'Standard');
  assert(standards.length <= 1);
  let input = raw;
  if (!standards.length && cst.children.some((n) => n.tag === 'Element')) {
    assert(!cst.children.some((n) => n.tag === 'Library' && n.attributes.Id === 'Map'));
    input = raw.slice(0, cst.openEnd) + '<Standard Id="Map"/>' + raw.slice(cst.openEnd);
  }
  const parsed = parseTriggerXmlSync(input, parserOptions),
    loaded = await readTriggerLibrariesFast(
      [parsed],
      new Map([...parsed.keys()].map((id) => [id, strings])),
    ),
    document = new TriggerDocument(
      raw,
      new Map([...loaded].map(([id, result]) => [id, result.library])),
    );
  let xmlElements = 0;
  function count(n) {
    if (n.tag === 'Element') xmlElements++;
    for (const c of n.children) count(c);
  }
  count(cst);
  const parsedElements = [...document.libraries.values()].reduce(
    (n, l) => n + Object.keys(l.elements ?? {}).length,
    0,
  );
  assert.equal(parsedElements, xmlElements);
  assert(xmlElements === 0 || document.libraries.size > 0);
  return {
    document,
    scopeProof: {
      implicitMapRootSupplied: input !== raw,
      originalBytesPreserved: true,
      xmlElements,
      parsedElements,
    },
  };
}

// A final XML formatting pass, after attribute owner/value binding. No new
// definitions, labels, defaults, namespace remapping, functions or expressions.
import assert from 'node:assert/strict';
import { xmlTree } from '../../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
import { parseOwnedTriggerDocument } from './trigger-document-scope.mjs';
import { applyDisjointXmlPatches } from '../../utilities/apply-disjoint-xml-patches.mjs';
import { quoteAttributeSelectorScalar } from '../exact-function-signatures/attribute-selector-domain.literal-codec.mjs';
const escape = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
export function finalizeAttributeSelectorQuotes(triggerXml) {
  const tree = xmlTree(triggerXml),
    libraries = parseOwnedTriggerDocument(triggerXml),
    patches = [],
    changes = [];
  const implicit = [...libraries.values()].find((l) => l.implicit)?.id;
  function walk(n, owner) {
    if (n.tag === 'Library') owner = n.attributes.Id;
    if (n.tag === 'Element' && n.attributes.Type === 'Param') {
      const p = libraries.get(owner)?.elementsByType.Param[n.attributes.Id];
      if (p && ['attributegame', 'attributeplayer'].includes(p.valueType?.type)) {
        const data = structuredClone(p);
        if (quoteAttributeSelectorScalar(data)) {
          const values = n.children.filter((c) => c.tag === 'Value'),
            types = n.children.filter((c) => c.tag === 'ValueType');
          assert(
            values.length === 1 && !values[0].selfClosing && types.length === 1,
            'AMBIGUOUS_ATTRIBUTE_SELECTOR_SCALAR',
          );
          assert.equal(types[0].attributes.Type, p.valueType.type);
          patches.push({
            start: values[0].openEnd,
            end: values[0].closeStart,
            text: escape(data.value),
          });
          changes.push({
            owner,
            paramId: p.id,
            valueType: p.valueType.type,
            before: p.value,
            after: data.value,
            rule: 'EDITOR_ATTRIBUTE_OUTER_DELIMITERS_NO_ESCAPING',
          });
        }
      }
    }
    for (const c of n.children) walk(c, owner);
  }
  walk(tree, implicit);
  const output = applyDisjointXmlPatches(triggerXml, patches),
    parsed = parseOwnedTriggerDocument(output);
  for (const c of changes) {
    const p = parsed.get(c.owner)?.elementsByType.Param[c.paramId];
    assert.equal(p.value, c.after);
    assert.equal(p.valueType.type, c.valueType);
  }
  return { triggerXml: output, changes, definitionsOrDefaultsAdded: false, ownerIdsChanged: false };
}

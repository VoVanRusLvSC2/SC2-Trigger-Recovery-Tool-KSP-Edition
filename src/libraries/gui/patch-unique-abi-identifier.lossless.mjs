// Candidate fix, deliberately separate from the active binder. The old regex
// can consume a following Element when the intended target is self-closing.
import assert from 'node:assert/strict';
import { xmlTree } from '../../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js';
export function patchUniqueIdentifier(xml, { type, id, stem }) {
  assert(
    /^(Variable|FunctionDef|ParamDef|Trigger)$/u.test(type) &&
      /^[A-Fa-f0-9]{8}$/u.test(id) &&
      /^[A-Za-z_][A-Za-z0-9_]*$/u.test(stem),
  );
  const tree = xmlTree(xml),
    found = [];
  function walk(n) {
    if (n.tag === 'Element' && n.attributes.Type === type && n.attributes.Id === id) found.push(n);
    for (const c of n.children) walk(c);
  }
  walk(tree);
  if (found.length !== 1) return null;
  const node = found[0],
    raw = xml.slice(node.start, node.end);
  // Keep the former conservative refusal even for an Identifier-looking text
  // fragment. Also refuse a nonstandard explicit Identifier attribute.
  if (/<Identifier(?:\s|>)/u.test(raw) || node.attributes.Identifier !== undefined) return null;
  const identifier = `<Identifier>${stem}</Identifier>\n`;
  if (!node.selfClosing)
    return xml.slice(0, node.closeStart) + identifier + xml.slice(node.closeStart);
  const head = xml.slice(node.start, node.openEnd);
  assert(head.endsWith('/>'));
  return (
    xml.slice(0, node.start) +
    head.slice(0, -2) +
    '>' +
    identifier +
    '</Element>' +
    xml.slice(node.end)
  );
}

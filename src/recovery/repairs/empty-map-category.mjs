/** Empty map Root needs one visible category for Editor View Script context.
 * Only category metadata is added; no code/value/flag/function changes. */
export function ensureEmptyMapCategory(xml, parseXml) {
  const document = parseXml(xml),
    root = document.children.find((c) => c.tag === 'Root');
  if (!root || root.selfClosing || root.children.some((c) => c.tag === 'Item'))
    return { xml, added: false };
  let id = 'F0000001';
  while (xml.includes('Id="' + id + '"')) id = (parseInt(id, 16) + 1).toString(16).toUpperCase();
  const item = `<Item Type="Category" Id="${id}"/>`,
    element = `\n<Element Type="Category" Id="${id}"><Identifier>Triggers</Identifier></Element>`;
  const result =
    xml.slice(0, root.closeStart) +
    item +
    xml.slice(root.closeStart, root.end) +
    element +
    xml.slice(root.end);
  parseXml(result);
  return {
    xml: result,
    added: true,
    id,
    name: 'Triggers',
    scope: 'Empty GUI category only; executable program unchanged',
  };
}

/** Match the Editor's original quoted string representation of attribute selectors.
 * Fixes actual Editor exports of numeric GameAttribute*Value IDs. The linked
 * Galaxy, labels, definitions and defaults are deliberately left untouched.
 */
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, v) =>
    v[0] === '#'
      ? String.fromCodePoint(
          v[1].toLowerCase() === 'x' ? parseInt(v.slice(2), 16) : Number(v.slice(1)),
        )
      : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[v.toLowerCase()],
  );
const encode = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
export function quoteAttributeLiterals({ triggerXml, attributes, parseXml }) {
  const defs = new Map(attributes.attributes.map((a) => [String(a.id), a]));
  if (defs.size !== attributes.attributes.length) throw Error('Ambiguous attribute definitions');
  const edits = [],
    changes = [];
  function visit(n) {
    if (n.tag === 'Element' && n.attributes.Type === 'Param') {
      const ts = n.children.filter((c) => c.tag === 'ValueType'),
        vs = n.children.filter((c) => c.tag === 'Value');
      if (
        ts.length === 1 &&
        ['attributegame', 'attributeplayer', 'attributevalue'].includes(ts[0].attributes.Type)
      ) {
        if (vs.length > 1) throw Error('Ambiguous attribute literal value');
        const v = vs[0],
          type = ts[0].attributes.Type;
        if (
          v &&
          !v.selfClosing &&
          !n.children.some((c) =>
            [
              'ScriptCode',
              'FunctionCall',
              'Variable',
              'Parameter',
              'Preset',
              'ValueParam',
            ].includes(c.tag),
          )
        ) {
          const original = triggerXml.slice(v.openEnd, v.closeStart),
            decoded = decode(original.trim());
          let value = decoded;
          if (decoded.startsWith('"')) {
            try {
              value = JSON.parse(decoded);
            } catch {
              throw Error('Malformed quoted attribute literal');
            }
          }
          if (typeof value !== 'string') throw Error('Attribute literal must be a string');
          const pair = /^(\d+)(?:\|([^|]+))?$/.exec(value),
            a = pair && defs.get(pair[1]);
          if (a) {
            if (type === 'attributevalue') {
              const token = pair[2];
              if (
                !/^\d{4}$/.test(token ?? '') ||
                !a.values.some((x) => String(x.id) === String(Number(token)))
              )
                throw Error('Unknown attribute value token');
            } else if (pair[2] || a.type !== (type === 'attributeplayer' ? 'Player' : 'Global'))
              throw Error('Attribute literal domain mismatch');
            if (decoded !== JSON.stringify(value)) {
              edits.push({
                start: v.openEnd,
                end: v.closeStart,
                text: encode(JSON.stringify(value)),
              });
              changes.push({
                scope: n.scope ?? '',
                paramId: n.attributes.Id,
                valueType: type,
                value,
                oldXmlValue: original,
                newXmlValue: encode(JSON.stringify(value)),
              });
            }
          }
        }
      }
    }
    for (const c of n.children) visit(c);
  }
  visit(parseXml(triggerXml));
  let result = triggerXml,
    end = Infinity;
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    if (e.end > end) throw Error('Overlapping attribute literal edits');
    result = result.slice(0, e.start) + e.text + result.slice(e.end);
    end = e.start;
  }
  parseXml(result);
  return { triggerXml: result, changes };
}

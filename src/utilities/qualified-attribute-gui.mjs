import assert from 'node:assert/strict';
import { restoreAttributeGui } from './attribute-gui.mjs';
import { restoreAttributeDisplayText } from '../recovery/repairs/attribute-display-fixed.mjs';
import { quoteAttributeLiterals } from './attribute-literal-quotes.mjs';
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
const key = (n) => (n.scope ?? '') + ':' + n.attributes.Type + ':' + n.attributes.Id;
function nodes(xml, parseXml) {
  const out = [];
  function visit(n) {
    if (n.tag === 'Element') out.push(n);
    for (const c of n.children) visit(c);
  }
  visit(parseXml(xml));
  return out;
}
function patch(xml, edits) {
  let end = Infinity;
  for (const e of edits.sort((a, b) => b.start - a.start)) {
    assert(e.end <= end, 'Overlapping owned parameter edits');
    xml = xml.slice(0, e.start) + e.text + xml.slice(e.end);
    end = e.start;
  }
  return xml;
}
/** The projection exists only inside this function. Runtime qualified strings
 * are restored byte-for-value before returning; display/value selectors use
 * the proven local definition. Foreign or ambiguous namespaces are untouched.
 */
export function restoreQualifiedAttributeGui({
  triggerXml,
  attributes,
  schema,
  localizedStrings,
  preferredLocale = 'enUS',
  parseXml,
  namespace,
}) {
  assert(Number.isSafeInteger(namespace) && namespace > 0, 'Explicit verified namespace required');
  const els = nodes(triggerXml, parseXml),
    index = new Map(els.map((n) => [key(n), n]));
  assert.equal(index.size, els.length, 'Duplicate scoped elements');
  const resolve = (r, n) =>
    index.get(
      (r.attributes.Library ?? n.scope ?? '') + ':' + r.attributes.Type + ':' + r.attributes.Id,
    );
  const uses = new Map();
  for (const e of els)
    for (const r of e.children.filter((c) => c.tag === 'Parameter')) {
      const n = resolve(r, e);
      if (n) uses.set(key(n), (uses.get(key(n)) ?? 0) + 1);
    }
  const defs = new Map(attributes.attributes.map((a) => [String(a.id), a])),
    edits = [],
    owned = new Map();
  for (const call of els.filter((e) => e.attributes.Type === 'FunctionCall')) {
    const f = call.children.find((c) => c.tag === 'FunctionDef');
    if (!f) continue;
    const b = schema.bindings.find(
      (b) =>
        (f.attributes.Library ?? call.scope) === b.libraryId && f.attributes.Id === b.functionDefId,
    );
    if (!b) continue;
    for (const r of call.children.filter((c) => c.tag === 'Parameter')) {
      const p = resolve(r, call),
        d = p?.children.find((c) => c.tag === 'ParameterDef');
      if (
        !d ||
        (d.attributes.Library ?? p.scope) !== b.libraryId ||
        d.attributes.Id !== b.firstParamId
      )
        continue;
      const v = p.children.find((c) => c.tag === 'Value'),
        t = p.children.find((c) => c.tag === 'ValueType');
      if (
        !v ||
        v.selfClosing ||
        !t ||
        !['string', b.valueType].includes(t.attributes.Type) ||
        p.children.some((c) =>
          ['ScriptCode', 'FunctionCall', 'Variable', 'Parameter', 'Preset', 'ValueParam'].includes(
            c.tag,
          ),
        )
      )
        continue;
      let value = decode(triggerXml.slice(v.openEnd, v.closeStart).trim());
      const wasQuoted = value.startsWith('"');
      if (wasQuoted) value = JSON.parse(value);
      const m = /^\[bnet:local\/0\.0\/(\d+)\](\d+)$/.exec(value);
      if (!m) {
        if (wasQuoted && /^\d+$/.test(value) && defs.has(value))
          edits.push({ start: v.openEnd, end: v.closeStart, text: value });
        continue;
      }
      if (Number(m[1]) !== namespace || !defs.has(m[2])) continue;
      assert.equal(defs.get(m[2]).type, b.attributeType, 'Owned attribute API domain differs');
      assert.equal(uses.get(key(p)), 1, 'Qualified parameter has shared ownership');
      owned.set(key(p), { value, type: b.valueType, id: m[2] });
      edits.push({ start: v.openEnd, end: v.closeStart, text: m[2] });
    }
  }
  // Existing quoted value selectors need the same temporary unquoted view;
  // quoteAttributeLiterals restores their observed Editor string representation.
  for (const p of els.filter((e) => e.attributes.Type === 'Param')) {
    const t = p.children.find((c) => c.tag === 'ValueType'),
      v = p.children.find((c) => c.tag === 'Value');
    if (t?.attributes.Type !== 'attributevalue' || !v || v.selfClosing) continue;
    const raw = decode(triggerXml.slice(v.openEnd, v.closeStart).trim());
    if (!raw.startsWith('"')) continue;
    const value = JSON.parse(raw),
      m = /^(\d+)\|(\d{4})$/.exec(value);
    if (m && defs.get(m[1])?.values.some((x) => String(x.id) === String(Number(m[2]))))
      edits.push({ start: v.openEnd, end: v.closeStart, text: encode(value) });
  }
  const projected = patch(triggerXml, edits),
    gui = restoreAttributeGui({ triggerXml: projected, attributes, schema, parseXml });
  const display = restoreAttributeDisplayText({
    triggerXml: gui.triggerXml,
    attributes,
    localizedStrings,
    preferredLocale,
    parseXml,
  });
  const quoted = quoteAttributeLiterals({ triggerXml: display.triggerXml, attributes, parseXml });
  const restoration = [];
  let restored = 0;
  for (const p of nodes(quoted.triggerXml, parseXml)) {
    const original = owned.get(key(p));
    if (!original) continue;
    const v = p.children.find((c) => c.tag === 'Value'),
      t = p.children.find((c) => c.tag === 'ValueType');
    assert.equal(t?.attributes.Type, original.type, 'Projected attribute was not linked');
    assert(v && !v.selfClosing);
    restoration.push({
      start: v.openEnd,
      end: v.closeStart,
      text: encode(JSON.stringify(original.value)),
    });
    restored++;
  }
  assert.equal(restored, owned.size, 'Qualified runtime parameter was lost');
  const xml = patch(quoted.triggerXml, restoration);
  parseXml(xml);
  return {
    triggerXml: xml,
    changes: gui.changes,
    displayChanges: display.changes,
    unresolved: display.unresolved,
    qualifiedRuntimeValues: [...owned].map(([param, v]) => ({ param, ...v })),
    literalQuotes: quoted.changes,
    namespace,
    runtimeQualifiedValuesPreserved: true,
  };
}
